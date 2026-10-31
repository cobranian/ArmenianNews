/**
 * Bake the rendered app into each showcase's index.html.
 *
 * The site is a single-page app: the shipped HTML is an empty <div id="root">,
 * so the articles only exist for a crawler that runs JavaScript. Google does,
 * but on a slower second pass. This renders every (site, lang, view) triple
 * from sites.config.js with a headless browser and writes the resulting
 * markup back into its own dist/<site>/<path>/index.html — one file per
 * (site, lang, view) triple, so the count follows sites.config.js rather than
 * this comment: seven languages × four views = twenty-eight pages today. The
 * snapshot's articles are therefore in the raw HTML on the first pass. The
 * hourly build reruns this, so the baked HTML is never staler than the
 * snapshot it ships with.
 *
 * The baked markup is HYDRATED by main.jsx (hydrateRoot), not thrown away —
 * with createRoot the browser painted nothing until React had rebuilt the
 * whole page (first paint 1.48 s vs 0.23 s without JS, simulated mobile LCP
 * 9.9 s vs 2.3 s, 17 Oct 2026). Hydration only pays if the baked HTML is
 * EXACTLY the first client render, so this script no longer snapshots the
 * mounted DOM (effects already ran, adjacent text nodes merged): it sets
 * window.__PRERENDER__ = { now } and main.jsx answers with renderToString.
 * `now` is baked as <div id="root" data-now> so the visitor's first render
 * uses the same instant (src/renderClock.js). `npm run hydration-check`
 * proves the result hydrates without a mismatch.
 *
 * Browser: uses puppeteer-core against an already-installed Chrome/Edge.
 * Set PUPPETEER_EXECUTABLE_PATH to override the auto-detected path.
 *
 *   npm run prerender            # after `npm run build`, bakes every page
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import { findChrome } from './lib/chrome.mjs'
import { SITES, ALL_VIEWS, pathFor } from '../sites.config.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const executablePath = findChrome()
if (!executablePath) {
  console.error('No Chrome/Edge found. Set PUPPETEER_EXECUTABLE_PATH.')
  process.exit(1)
}

for (const site of Object.values(SITES)) {
  const outDir = path.join(root, 'dist', site.id)
  if (!existsSync(path.join(outDir, 'index.html'))) {
    console.error(`dist/${site.id}/index.html not found. Run \`npm run build\` first.`)
    process.exit(1)
  }
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox'],
})

let baked = 0
try {
  // Un serveur de prévisualisation par vitrine : les deux dist/ sont des
  // racines distinctes. Les pages d'un même site partagent le sien.
  for (const site of Object.values(SITES)) {
    const server = await preview({
      root,
      preview: { port: 4174, host: '127.0.0.1' },
      build: { outDir: path.join('dist', site.id) },
    })
    const origin = server.resolvedUrls.local[0].replace(/\/$/, '')

    try {
      for (const page of site.pages) {
        for (const view of ALL_VIEWS) {
          const rel = pathFor(page.lang, view)
          const file = path.join(root, 'dist', site.id, rel.replace(/^\//, ''), 'index.html')
          const tab = await browser.newPage()
          try {
            const now = Date.now()
            await tab.evaluateOnNewDocument((n) => {
              window.__PRERENDER__ = { now: n }
            }, now)
            await tab.goto(origin + rel, { waitUntil: 'networkidle0' })
            await tab.waitForSelector('html[data-prerendered="ok"]', { timeout: 30000 })

            // .reveal is no longer stamped is-visible here: the baked HTML must
            // be the client's first render, and .reveal is only hidden under
            // html.js (global.css), so the raw HTML reads fine without script.

            // La page doit avoir démarré dans SA langue : si le prérendu de /hy/
            // cuit du contenu anglais, la résolution de langue par URL est
            // cassée et on servirait un <html lang="hy"> plein d'anglais.
            const domLang = await tab.evaluate(() => document.documentElement.lang)
            if (domLang !== page.lang) {
              throw new Error(`${site.id}${rel} : rendu en "${domLang}" au lieu de "${page.lang}"`)
            }

            // La jumelle de la garde ci-dessus, et elle est nécessaire : le
            // serveur de prévisualisation retombe sur l'index racine pour un
            // chemin qu'il ne trouve pas. Sans ce contrôle, une erreur de slug
            // ferait cuire l'ACCUEIL dans le fichier de /radio — une page
            // parfaitement valide, au mauvais contenu, sans le moindre signal.
            const domView = await tab.evaluate(
              () => document.querySelector('[data-view]')?.dataset.view,
            )
            if (domView !== view) {
              throw new Error(`${site.id}${rel} : rendu en vue "${domView}" au lieu de "${view}"`)
            }

            const rendered = await tab.$eval('#root', (el) => el.innerHTML)
            // Le fuseau du navigateur du prérendu : l'agenda y a lu ses heures
            // murales, le premier rendu du lecteur doit faire de même.
            const tz = await tab.evaluate((n) => new Date(n).getTimezoneOffset(), now)
            if (!rendered.trim()) {
              throw new Error(`${site.id}${rel} : #root vide — refus de cuire une page blanche`)
            }

            const html = await readFile(file, 'utf-8')
            const marker = '<div id="root"></div>'
            if (!html.includes(marker)) throw new Error(`marker ${marker} not found in ${file}`)

            await writeFile(
              file,
              html.replace(marker, () => `<div id="root" data-now="${now}" data-tz="${tz}">${rendered}</div>`),
              'utf-8',
            )
            console.log(
              `✓ ${site.id}${rel} (${page.lang}, ${view}) — ${rendered.length.toLocaleString('en-US')} chars`,
            )
            baked++
          } finally {
            // Ce `close()` NE DOIT PAS pouvoir masquer l'erreur d'origine, et
            // ça s'est payé : quand Chrome meurt, tout appel au protocole
            // échoue — y compris celui-ci. Une exception jetée depuis un
            // `finally` REMPLACE celle du `try`, donc la CI n'a rapporté qu'un
            // `ConnectionClosedError at CdpPage.close`, désignant la fermeture
            // de l'onglet alors que la panne était à `newPage()` quinze lignes
            // plus haut. Une journée de prérendus manqués a été diagnostiquée
            // sur cette fausse piste. Fermer un onglet est un nettoyage : son
            // échec ne vaut jamais la raison pour laquelle on nettoie.
            await tab.close().catch(() => {})
          }
        }
      }
    } finally {
      await new Promise((res) => server.httpServer.close(res))
    }
  }
} finally {
  await browser.close()
}

console.log(`✓ ${baked} pages prérendues`)
