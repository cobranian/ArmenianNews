/**
 * Screenshot the Don Narek carousel from the built site.
 *
 * Serves dist/ch with Vite's preview server, opens the page in a headless
 * browser, and captures the #facebook strand at desktop + mobile widths.
 * dist/ch (not dist/org) because that's the showcase armenie-info.web.app
 * itself serves — the two-showcase split (Task 8) turned dist/ into a bare
 * parent directory with no index.html of its own; targeting it would serve
 * nothing and the capture would fail.
 *
 * IT CAPTURES #facebook, NOT #reseaux, AND THAT IS THE WHOLE POINT. It used
 * to shoot the section, which was harmless only while Don Narek opened it.
 * The day the five Instagram strands moved ahead of him, the section shot
 * still succeeded and the PNG named after him no longer contained him:
 *
 *   - `.reveal` holds every shelf at `opacity: 0` until useReveal's
 *     IntersectionObserver sees it, and a shelf ~3000px below the scroll
 *     position is never seen — Don Narek was captured fully transparent;
 *   - his card images are `loading="lazy"` and at that distance Chrome never
 *     even requests them.
 *
 * Both are silent: `el.screenshot()` returns fine, the CI step is
 * `continue-on-error`, and nothing reads the PNG. The published picture was
 * simply black. Shooting the strand itself makes the capture independent of
 * where the strand sits in the section — reorder the wall again and this
 * script still shoots Don Narek.
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

/* The Don Narek strand. Social.jsx pins this id on the strand itself, not on
   a position in the section — which is why this capture survives a reorder. */
const SELECTOR = '#facebook'

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
    // Trip the reveal-on-scroll animation for this strand, and promote its
    // cards to eager: `networkidle0` settles long before a lazy image below
    // the fold is requested, and the element capture reaches past the
    // viewport, so waiting on intersection alone would still shoot holes.
    await page.evaluate((sel) => {
      const strand = document.querySelector(sel)
      strand?.scrollIntoView()
      strand?.querySelectorAll('img').forEach((img) => {
        img.loading = 'eager'
      })
    }, SELECTOR)
    // Then wait for the pixels, not for a duration.
    await page
      .waitForFunction(
        (sel) => {
          const imgs = [...document.querySelectorAll(`${sel} img`)]
          return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)
        },
        { timeout: 20000 },
        SELECTOR,
      )
      .catch(() => console.warn('  ↯ images encore en vol — capture quand même'))
    // Let the reveal transition finish.
    await new Promise((r) => setTimeout(r, 1200))
    const el = await page.$(SELECTOR)
    await el.screenshot({ path: path.join(OUT, `don-narek-${v.name}.png`) })
    console.log(`✓ dist/ch/don-narek-${v.name}.png`)
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise((res) => server.httpServer.close(res))
}
