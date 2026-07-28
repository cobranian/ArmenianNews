/**
 * Screenshot the Don Narek carousel from the built site.
 *
 * Serves dist/ch with Vite's preview server, opens the page in a headless
 * browser, and captures the #reseaux section — which opens on its Facebook
 * tab — at desktop + mobile widths. dist/ch (not dist/org) because that's the
 * showcase armenie-info.web.app itself serves — the two-showcase split
 * (Task 8) turned dist/ into a bare parent directory with no index.html of
 * its own; targeting it would serve nothing and the capture would fail.
 * PNGs are written back into dist/ch so the hourly deploy publishes them to
 * the live site (armenie-info.web.app/don-narek-desktop.png), which is
 * exactly the URL README.md documents — dist/ is gitignored, so nothing
 * large ever lands in git history.
 *
 * Browser: uses puppeteer-core against an already-installed Chrome/Edge.
 * Set PUPPETEER_EXECUTABLE_PATH to override the auto-detected path.
 *
 *   npm run screenshot            # after `npm run build`
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import { findChrome } from './lib/chrome.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(root, 'dist', 'ch')

const executablePath = findChrome()
if (!executablePath) {
  console.error('No Chrome/Edge found. Set PUPPETEER_EXECUTABLE_PATH.')
  process.exit(1)
}

const VIEWS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 414, height: 900 },
]

const server = await preview({
  root,
  preview: { port: 4173, host: '127.0.0.1' },
  build: { outDir: path.join('dist', 'ch') },
})
const url = server.resolvedUrls.local[0]
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--force-color-profile=srgb'],
})

try {
  for (const v of VIEWS) {
    const page = await browser.newPage()
    await page.setViewport({ width: v.width, height: v.height, deviceScaleFactor: 2 })
    await page.goto(url, { waitUntil: 'networkidle0' })
    // Trigger the reveal-on-scroll animation, then let it settle.
    await page.evaluate(() => document.querySelector('#reseaux')?.scrollIntoView())
    await new Promise((r) => setTimeout(r, 1200))
    const el = await page.$('#reseaux')
    await el.screenshot({ path: path.join(OUT, `don-narek-${v.name}.png`) })
    console.log(`✓ dist/ch/don-narek-${v.name}.png`)
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise((res) => server.httpServer.close(res))
}
