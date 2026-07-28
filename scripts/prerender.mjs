/**
 * Bake the rendered app into each showcase's index.html.
 *
 * The site is a single-page app: the shipped HTML is an empty <div id="root">,
 * so the articles only exist for a crawler that runs JavaScript. Google does,
 * but on a slower second pass. This renders every page listed in
 * sites.config.js with a headless browser and writes the resulting markup
 * back into its own dist/<site>/index.html (four files: dist/ch/index.html,
 * dist/org/index.html, dist/org/hy/index.html, dist/org/ru/index.html), so
 * the snapshot's articles are in the raw HTML on the first pass. The hourly
 * build reruns this, so the baked HTML is never staler than the snapshot it
 * ships with.
 *
 * main.jsx uses createRoot (not hydrateRoot): React clears the container and
 * re-renders on load, so the baked markup is never reconciled and cannot
 * mismatch. That is deliberate — do not "fix" it by hydrating.
 *
 * Browser: uses puppeteer-core against an already-installed Chrome/Edge.
 * Set PUPPETEER_EXECUTABLE_PATH to override the auto-detected path.
 *
 *   npm run prerender            # after `npm run build`, bakes all four pages
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import { findChrome } from './lib/chrome.mjs'
import { SITES } from '../sites.config.js'

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
        const file = path.join(root, 'dist', site.id, page.path.replace(/^\//, ''), 'index.html')
        const tab = await browser.newPage()
        try {
          await tab.goto(origin + page.path, { waitUntil: 'networkidle0' })

          // .reveal starts at opacity:0 and only becomes visible once
          // useReveal's IntersectionObserver fires on scroll. Serialising as-is
          // would ship a transparent page. Stamp every .reveal visible before
          // reading the DOM.
          await tab.evaluate(() => {
            document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'))
          })

          // La page doit avoir démarré dans SA langue : si le prérendu de /hy/
          // cuit du contenu anglais, la résolution de langue par URL est
          // cassée et on servirait un <html lang="hy"> plein d'anglais.
          const domLang = await tab.evaluate(() => document.documentElement.lang)
          if (domLang !== page.lang) {
            throw new Error(
              `${site.id}${page.path} : rendu en "${domLang}" au lieu de "${page.lang}"`,
            )
          }

          const rendered = await tab.$eval('#root', (el) => el.innerHTML)
          if (!rendered.trim()) {
            throw new Error(`${site.id}${page.path} : #root vide — refus de cuire une page blanche`)
          }

          const html = await readFile(file, 'utf-8')
          const marker = '<div id="root"></div>'
          if (!html.includes(marker)) throw new Error(`marker ${marker} not found in ${file}`)

          await writeFile(file, html.replace(marker, `<div id="root">${rendered}</div>`), 'utf-8')
          console.log(
            `✓ ${site.id}${page.path} (${page.lang}) — ${rendered.length.toLocaleString('en-US')} chars`,
          )
          baked++
        } finally {
          await tab.close()
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
