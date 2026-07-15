/**
 * LOCAL-ONLY: scrape Don Narek's latest Facebook posts using your own Chrome.
 *
 * Facebook blocks server-side scraping, so this drives a real Chrome window on
 * your machine to read the PUBLIC page, extracts each post's picture + link,
 * downloads the images into src/data/fb/, and rewrites src/data/facebook.json.
 * It is NOT run in CI — you run it locally, then commit + push (the hourly
 * workflow deploys). Facebook's markup is obfuscated, so this is best-effort.
 *
 * Facebook requires a logged-in session, so first start a dedicated Chrome and
 * log into Facebook in it once (see README / the launch command below), then:
 *
 *   node scripts/fb-scrape.mjs --connect --dry   # report what it finds, write nothing
 *   node scripts/fb-scrape.mjs --connect         # download images + rewrite facebook.json
 *
 * --connect attaches to a Chrome already running with --remote-debugging-port=9222
 * (reusing your logged-in session). Without it, it launches a fresh (logged-out)
 * Chrome — only useful for pages that need no login.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const DRY = process.argv.includes('--dry')
const CONNECT = process.argv.includes('--connect')
const PAGE_URL = 'https://www.facebook.com/DonNarek'
// Scrape the main profile timeline; we then keep only the posts that fall
// under Facebook's "Other posts" heading (i.e. the regular chronological feed,
// excluding the pinned/featured posts shown above it).
const SCRAPE_URL = PAGE_URL
const OTHER_POSTS_RX = /^(other posts|autres publications)$/i
const AUTHOR = 'Don Narek'
const WANT = 30

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FB_DIR = path.join(root, 'src/data/fb')
// Dedicated profile so we never clash with your open Chrome (no profile lock).
const PROFILE = path.join(root, '.cache/fb-chrome-profile')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Drop Facebook's per-view tracking params so the saved link is clean/stable.
const cleanLink = (h) =>
  h.replace(/&(?:__cft__\[\d+\]|__tn__|idorvanity)=[^&]*/g, '').replace(/[?&]+$/, '')

const browser = CONNECT
  ? await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: { width: 1280, height: 1600 },
    })
  : await puppeteer.launch({
      executablePath: CHROME,
      headless: false,
      defaultViewport: { width: 1280, height: 1600 },
      userDataDir: PROFILE,
      args: ['--no-first-run', '--no-default-browser-check', '--lang=fr-FR'],
    })

const page = (await browser.pages())[0] || (await browser.newPage())
const finish = async () => (CONNECT ? browser.disconnect() : browser.close())
await page.setUserAgent(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
)

async function dismiss() {
  // Cookie banner + login modal, in FR and EN.
  await page.evaluate(() => {
    const rx = /(allow all|accept|autoriser|tout accepter|only allow|refuser)/i
    for (const b of document.querySelectorAll('[role="button"], button')) {
      if (rx.test(b.textContent || '')) b.click()
    }
    for (const c of document.querySelectorAll('[aria-label="Close"], [aria-label="Fermer"]')) {
      c.click()
    }
  })
  await page.keyboard.press('Escape').catch(() => {})
}

console.log('→ opening', SCRAPE_URL)
await page.goto(SCRAPE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
// The timeline hydrates slowly — wait for the feed to actually render.
await page.waitForSelector('div[role="article"]', { timeout: 30000 }).catch(() => {})
await sleep(4000)
await dismiss()
await sleep(2000)

// Test the session COOKIE, not the DOM. Logged out, Facebook may serve a
// "Continue as…" chooser with no email field in it — so hunting for one concludes
// we ARE logged in, and the run then scrolls a login page, finds zero posts, and
// dies on a navigation instead of saying the one thing that is wrong.
const cookies = await page.cookies('https://www.facebook.com')
if (!cookies.some((c) => c.name === 'c_user' && c.value)) {
  console.log('✗ Not logged in — log into Facebook in the debug Chrome window, then retry.')
  await finish()
  process.exit(1)
}

// Read the "Other posts" boundary + every post currently in the DOM. Facebook
// VIRTUALIZES the feed (offscreen posts are removed, only ~2-3 articles exist at
// any moment), so we run this after every scroll and accumulate — extracting
// once would only ever see the top of the wall.
const survey = () =>
  page.evaluate((boundarySrc) => {
    // Posts above the "Other posts" heading are pinned/featured — excluded.
    const rx = new RegExp(boundarySrc, 'i')
    const heading = [...document.querySelectorAll('h2,h3,h4,span,div[role="heading"]')].find((e) =>
      rx.test((e.textContent || '').trim()),
    )
    const boundaryY = heading ? heading.getBoundingClientRect().top + window.scrollY : null

    const POST_RX = /pfbid|\/posts\/|story_fbid|[?&]fbid=|\/videos\/|\/reel\//
    const permalinkFor = (node) => {
      let el = node
      for (let i = 0; i < 10 && el; i++, el = el.parentElement) {
        for (const a of el.querySelectorAll ? el.querySelectorAll('a[href]') : []) {
          if (POST_RX.test(a.href)) return a.href
        }
      }
      return null
    }
    const idOf = (h) => {
      const m =
        h.match(/pfbid[0-9A-Za-z]+/) ||
        h.match(/fbid=(\d+)/) ||
        h.match(/\/posts\/(\d+)/) ||
        h.match(/story_fbid=(\d+)/) ||
        h.match(/\/(?:videos|reel)\/(\d+)/)
      return m ? m[0] : h
    }
    const posts = []
    for (const im of document.querySelectorAll('img')) {
      // Only real content photos (t39...); skip profile/cover pics (t1.6435-9)
      // and small avatars/icons/reaction thumbs.
      if (!/fbcdn|scontent/.test(im.src) || /\/t1\.\d/.test(im.src)) continue
      const rect = im.getBoundingClientRect()
      const w = Math.max(im.naturalWidth || 0, rect.width)
      const h = Math.max(im.naturalHeight || 0, rect.height)
      if (w < 180 || h < 180) continue // grid thumbnails are a bit smaller
      const permalink = permalinkFor(im)
      if (!permalink) continue
      const absY = rect.top + window.scrollY // stable document position
      posts.push({ id: idOf(permalink), permalink, image: im.src, absY })
    }
    return { posts, boundaryY, y: window.scrollY, docHeight: document.documentElement.scrollHeight }
  }, OTHER_POSTS_RX.source)

// Scroll with REAL wheel events on the focused tab. window.scrollBy() does not
// drive Facebook's infinite loader — the document just runs to its current
// bottom (~900px) and the wall never grows past the first post. A wheel event on
// a foregrounded page does, and the document height climbs into the tens of
// thousands as the feed pages in.
await page.bringToFront()
await page.mouse.move(640, 800)

const acc = new Map()
let boundaryY = null
let lastY = -1
let stuck = 0
for (let i = 0; i < 60 && acc.size < WANT + 5; i++) {
  const r = await survey()
  if (boundaryY === null) boundaryY = r.boundaryY
  for (const p of r.posts) if (!acc.has(p.id)) acc.set(p.id, p)
  process.stdout.write(`\r   scrolling… y=${Math.round(r.y)} of ${r.docHeight}, ${acc.size} posts `)
  // Bottom of the wall: the viewport stops advancing. Facebook pages in lazily,
  // so give it a few rounds before believing it.
  if (Math.abs(r.y - lastY) < 2) {
    if (++stuck >= 4) break
  } else {
    stuck = 0
  }
  lastY = r.y
  await page.mouse.wheel({ deltaY: 1200 })
  await sleep(1500)
  await dismiss()
}
process.stdout.write('\n')
const last = await survey()
if (boundaryY === null) boundaryY = last.boundaryY
for (const p of last.posts) if (!acc.has(p.id)) acc.set(p.id, p)
await page.screenshot({ path: path.join(root, '.cache/fb-debug.png') }).catch(() => {})

if (boundaryY === null) {
  console.log('⚠ "Other posts" heading not found — taking all timeline posts.')
  boundaryY = 0
} else {
  console.log(`→ "Other posts" boundary at y=${Math.round(boundaryY)}`)
}
// Keep only posts below the heading, newest first (DOM order = chronological).
const found = [...acc.values()]
  .filter((p) => p.absY >= boundaryY - 4)
  .sort((a, b) => a.absY - b.absY)
console.log(`→ found ${found.length} posts with an image`)
found.slice(0, WANT).forEach((p, i) => {
  console.log(`  [${i + 1}] ${p.permalink}`)
  console.log(`       img ${p.image.slice(0, 90)}…`)
})

if (DRY || !found.length) {
  console.log(DRY ? '\n(dry run — nothing written)' : '\nNo posts found — nothing written.')
  await finish()
  process.exit(found.length ? 0 : 1)
}

// The grid only holds small thumbnails; open each photo's page to get the
// full-resolution image, then download it.
const fullImageFor = async (permalink, fallback) => {
  try {
    await page.goto(permalink, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1800)
    await dismiss()
    const big = await page.evaluate(() => {
      let best = null
      let area = 0
      for (const im of document.querySelectorAll('img')) {
        // Content photos: t39.30808 (classic full-res), t39.99422 (newer
        // format) and t51.* ; skip profile/cover pics (t1.*).
        if (!/fbcdn|scontent/.test(im.src) || /\/t1\.\d/.test(im.src)) continue
        if (!/\/t39\.|\/t51\./.test(im.src)) continue
        const a = (im.naturalWidth || 0) * (im.naturalHeight || 0)
        if (a > area) {
          area = a
          best = im.src
        }
      }
      return best
    })
    return big || fallback
  } catch {
    return fallback
  }
}

// Download images + build the posts array.
const posts = []
let n = 0
for (const p of found.slice(0, WANT)) {
  n++
  const id = `dn-${String(n).padStart(2, '0')}`
  const file = `${id}.jpg`
  try {
    const src = await fullImageFor(p.permalink, p.image)
    // Download THROUGH the logged-in browser, not a bare fetch(). Facebook now
    // serves many images (t39.99422 / t51) only to a session with cookies; an
    // anonymous fetch gets a ~3KB access-denied placeholder. Navigating the tab
    // sends the session, so we read the real bytes off the response.
    const res = await page.goto(src, { waitUntil: 'load', timeout: 45000 })
    if (!res || !res.ok()) throw new Error(`HTTP ${res ? res.status() : 'no response'}`)
    const buf = await res.buffer()
    if (buf.length < 15000) throw new Error(`too small (${buf.length}B)`)
    await writeFile(path.join(FB_DIR, file), buf)
    posts.push({ id, author: AUTHOR, url: cleanLink(p.permalink), image: file })
    console.log(`  ✓ ${file} (${(buf.length / 1024).toFixed(0)} KB)`)
  } catch (e) {
    console.log(`  ✗ ${id}: ${e.message} — keeping motif fallback`)
    posts.push({ id, author: AUTHOR, url: cleanLink(p.permalink) })
  }
}

const json = {
  _comment:
    'Don Narek Facebook wall — the carousel shows ONLY each post picture and its author; no Facebook page chrome. Generated by `node scripts/fb-scrape.mjs` (drives local Chrome to read the public page), newest first, capped at 30. Images bundled from src/data/fb/. Re-run the scraper to refresh; hand-edit is fine too.',
  page: 'DonNarek',
  url: PAGE_URL,
  posts,
}
await writeFile(path.join(root, 'src/data/facebook.json'), JSON.stringify(json, null, 2) + '\n')
console.log(`\n✓ wrote src/data/facebook.json (${posts.length} posts)`)

await finish()
