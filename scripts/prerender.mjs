/**
 * Bake the rendered app into dist/index.html.
 *
 * The site is a single-page app: the shipped HTML is an empty <div id="root">,
 * so the articles only exist for a crawler that runs JavaScript. Google does,
 * but on a slower second pass. This renders the page with a headless browser
 * and writes the resulting markup back into dist/index.html, so the snapshot's
 * articles are in the raw HTML on the first pass. The hourly build reruns this,
 * so the baked HTML is never staler than the snapshot it ships with.
 *
 * main.jsx uses createRoot (not hydrateRoot): React clears the container and
 * re-renders on load, so the baked markup is never reconciled and cannot
 * mismatch. That is deliberate — do not "fix" it by hydrating.
 *
 * Browser: uses puppeteer-core against an already-installed Chrome/Edge.
 * Set PUPPETEER_EXECUTABLE_PATH to override the auto-detected path.
 *
 *   npm run prerender            # after `npm run build`
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import puppeteer from 'puppeteer-core'
import { findChrome } from './lib/chrome.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INDEX = path.join(root, 'dist', 'index.html')

const executablePath = findChrome()
if (!executablePath) {
  console.error('No Chrome/Edge found. Set PUPPETEER_EXECUTABLE_PATH.')
  process.exit(1)
}

if (!existsSync(INDEX)) {
  console.error('dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}

const server = await preview({ root, preview: { port: 4174, host: '127.0.0.1' } })
const url = server.resolvedUrls.local[0]
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle0' })

  // .reveal starts at opacity:0 and only becomes visible once useReveal's
  // IntersectionObserver fires on scroll. Serialising as-is would ship a
  // transparent page. Stamp every .reveal visible before reading the DOM.
  await page.evaluate(() => {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'))
  })

  const rendered = await page.$eval('#root', (el) => el.innerHTML)
  if (!rendered.trim()) throw new Error('#root rendered empty — refusing to bake a blank page')

  const html = await readFile(INDEX, 'utf-8')
  const marker = '<div id="root"></div>'
  if (!html.includes(marker)) throw new Error(`marker ${marker} not found in dist/index.html`)

  await writeFile(INDEX, html.replace(marker, `<div id="root">${rendered}</div>`), 'utf-8')
  console.log(`✓ baked ${rendered.length.toLocaleString('en-US')} chars into dist/index.html`)
} finally {
  await browser.close()
  await new Promise((res) => server.httpServer.close(res))
}
