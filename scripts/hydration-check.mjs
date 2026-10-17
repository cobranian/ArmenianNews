/**
 * L'hydratation tient-elle ? (après `npm run build` puis `npm run prerender`)
 *
 * main.jsx REPREND le HTML prérendu (hydrateRoot) au lieu de le jeter. Au
 * moindre écart entre ce HTML et le premier rendu client, React 18 abandonne
 * et refait toute la racine — en silence pour le lecteur, qui retrouve
 * simplement l'ancienne lenteur. Ni les tests, ni `npm run check`, ni le lint
 * ne peuvent le voir : il faut un navigateur, et une visite qui ne ressemble
 * PAS au prérendu (autre heure, autre thème, écran de téléphone).
 *
 * Pour chaque page React des deux vitrines, trois visites :
 *   - bureau, thème par défaut ;
 *   - téléphone (390 px, pointer: coarse) ;
 *   - thème clair enregistré, horloge avancée de 3 h.
 * Une visite échoue si React signale un écart ([hydratation] dans la
 * console) ou si le titre du héros a été REMPLACÉ (nœud différent après
 * montage — la preuve que la racine a été refaite).
 *
 *   npm run hydration-check
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import { findChrome } from './lib/chrome.mjs'
import { SITES, ALL_VIEWS, pathFor } from '../sites.config.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const executablePath = findChrome()
if (!executablePath) {
  console.error('Aucun Chrome/Edge trouvé. Posez PUPPETEER_EXECUTABLE_PATH.')
  process.exit(1)
}
for (const site of Object.values(SITES)) {
  if (!existsSync(path.join(root, 'dist', site.id, 'index.html'))) {
    console.error(`dist/${site.id}/index.html absent — npm run build puis npm run prerender.`)
    process.exit(1)
  }
}

const VISITS = [
  { name: 'bureau', viewport: { width: 1400, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  // Autre fuseau que la machine du prérendu (UTC en CI, l'heure suisse au
  // poste) : l'agenda y a divergé en production, jamais sur le banc local.
  { name: 'clair+3h+Tokyo', viewport: { width: 1400, height: 900 }, theme: 'light', shiftMs: 3 * 3600 * 1000, tz: 'Asia/Tokyo' },
  { name: 'Los Angeles', viewport: { width: 1400, height: 900 }, tz: 'America/Los_Angeles' },
]

const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox'] })
let failures = 0
let visits = 0
try {
  for (const site of Object.values(SITES)) {
    const server = await preview({
      root,
      preview: { port: 4175, host: '127.0.0.1' },
      build: { outDir: path.join('dist', site.id) },
    })
    const origin = server.resolvedUrls.local[0].replace(/\/$/, '')
    try {
      for (const page of site.pages) {
        for (const view of ALL_VIEWS) {
          const rel = pathFor(page.lang, view)
          for (const v of VISITS) {
            // Un contexte neuf par visite : sans lui, le thème clair d'une visite
            // restait dans localStorage pour toutes les suivantes.
            const ctx = await browser.createBrowserContext()
            const tab = await ctx.newPage()
            try {
              await tab.setViewport(v.viewport)
              if (v.tz) await tab.emulateTimezone(v.tz)
              const warnings = []
              // Un build React de développement (NODE_ENV=development npm run
              // build) donne le détail de chaque écart — texte serveur/client
              // et pile de composants — en arguments %s : on les recompose.
              tab.on('console', async (m) => {
                const text = m.text()
                if (!/hydrat|did not match|Expected server HTML|Minified React error #4(18|19|21|22|23|25)/i.test(text)) return
                const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?')))
                let i = 1
                const full = typeof args[0] === 'string'
                  ? args[0].replace(/%s/g, () => String(args[i++] ?? '')) + args.slice(i).join(' ')
                  : text
                warnings.push(full.replace(/\s+/g, ' '))
              })
              tab.on('pageerror', (e) => warnings.push(`pageerror: ${e.message}`))
              await tab.evaluateOnNewDocument(({ theme, shiftMs }) => {
                if (theme) {
                  try { localStorage.setItem('theme', theme) } catch { /* rien */ }
                }
                if (shiftMs) {
                  const RealDate = Date
                  const shift = shiftMs
                  // Avance l'horloge : le lecteur ne visite jamais à l'heure du prérendu.
                  globalThis.Date = class extends RealDate {
                    constructor(...a) { super(...(a.length ? a : [RealDate.now() + shift])) }
                    static now() { return RealDate.now() + shift }
                  }
                }
                // Retient le titre du héros DÈS qu'il est analysé, avant tout script — par référence, sans attribut : un attribut ajouté serait lui-même un écart.
                new MutationObserver((_, obs) => {
                  const h = document.querySelector('.hero__title, h1')
                  if (h) { window.__hydrationProbe = h; obs.disconnect() }
                }).observe(document, { childList: true, subtree: true })
              }, { theme: v.theme, shiftMs: v.shiftMs })
              await tab.goto(origin + rel, { waitUntil: 'networkidle0' })
              await new Promise((r) => setTimeout(r, 300))
              const kept = await tab.evaluate(
                () => document.querySelector('.hero__title, h1') === window.__hydrationProbe,
              )
              visits++
              if (warnings.length || !kept) {
                failures++
                console.error(`✗ ${site.id}${rel} [${v.name}]${kept ? '' : ' — titre REMPLACÉ'}`)
                for (const w of [...new Set(warnings)].slice(0, 5)) console.error(`    ${w.slice(0, 700)}`)
              } else {
                console.log(`✓ ${site.id}${rel} [${v.name}]`)
              }
            } finally {
              await ctx.close().catch(() => {})
            }
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

console.log(`\n${visits - failures}/${visits} visites hydratées sans écart`)
process.exit(failures ? 1 : 0)
