/**
 * LOCAL-ONLY: harvest each curated account's latest Instagram posts.
 *
 * Instagram blocks datacenter IPs, so this is NOT run in CI — you run it
 * locally, then commit + push (the hourly workflow deploys). The hourly job only
 * re-shuffles the pool this script writes; without a run, the wall re-serves the
 * same posts forever while looking fresh.
 *
 * It drives a real Chrome on your machine and calls Instagram's own profile-grid
 * feed from inside the logged-in page, so the session cookies ride along. That is
 * ONE request per account, where scraping the grid and then each post for its
 * date would be ~90 navigations — enough for Instagram to cut us off with
 * "Please wait a few minutes".
 *
 * Start a Chrome logged into Instagram once (same debug window fb-scrape uses):
 *
 *   chrome.exe --remote-debugging-port=9222 --user-data-dir=.cache/ig-chrome-profile
 *
 * then:
 *
 *   node scripts/ig-scrape.mjs --connect --dry   # report what it finds, write nothing
 *   node scripts/ig-scrape.mjs --connect         # download images + rewrite the pool
 */
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const DRY = process.argv.includes('--dry')
const CONNECT = process.argv.includes('--connect')

const PER_ACCOUNT = 9
// The public web-client id Instagram's own front-end sends on this endpoint.
// Without it the request comes back 401 even with a valid session.
const IG_APP_ID = '936619743392459'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POOL = path.join(root, 'src/data/instagram.json')
const IG_DIR = path.join(root, 'src/data/ig')
// Dedicated profile so we never clash with your open Chrome (no profile lock).
const PROFILE = path.join(root, '.cache/ig-chrome-profile')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The pool before this run. Accepts the pre-migration `permalinks` shape so the
// first run can still fall back to it for an account that fails.
const previousPosts = (acc) =>
  acc.posts || (acc.permalinks || []).map((url) => ({ url, date: null }))

const pool = JSON.parse(await readFile(POOL, 'utf-8'))

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
      args: ['--no-first-run', '--no-default-browser-check'],
    })

const page = (await browser.pages())[0] || (await browser.newPage())
const finish = async () => (CONNECT ? browser.disconnect() : browser.close())

await page.goto('https://www.instagram.com/', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
})
await sleep(3000)

// Guard: without a session every account 401s, which would otherwise read as
// nine independent source failures ("keeping previous posts" ×9) rather than the
// one thing actually wrong. Test the session cookie, not the DOM — logged out,
// instagram.com serves a landing page with no login field in it, so looking for
// one silently concludes we ARE logged in.
const cookies = await page.cookies('https://www.instagram.com')
if (!cookies.some((c) => c.name === 'sessionid' && c.value)) {
  console.log('✗ Not logged in — log into Instagram in the debug Chrome window, then retry.')
  await finish()
  process.exit(1)
}

// One request per account, issued from the page so the session cookies ride
// along. Throws on a non-200 — the caller degrades that account.
//
// This is the profile-grid feed. Its sibling `web_profile_info` is the endpoint
// you'll find in every guide online, and it still answers 200 with the account's
// bio and post COUNT — but its `edges` array now comes back empty, so it reads as
// a working call that found no posts. Don't go back to it.
const harvest = (handle) =>
  page.evaluate(
    async (h, appId) => {
      const res = await fetch(
        `/api/v1/feed/user/${encodeURIComponent(h)}/username/?count=12`,
        { headers: { 'x-ig-app-id': appId }, credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!Array.isArray(json?.items)) throw new Error('unexpected payload shape')
      return json.items.map((it) => ({
        shortcode: it.code,
        ts: it.taken_at,
        // A carousel post carries no image of its own — its first slide does.
        image:
          it.image_versions2?.candidates?.[0]?.url ||
          it.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ||
          null,
        // 1 = photo, 2 = video/reel, 8 = carousel.
        isVideo: it.media_type === 2,
      }))
    },
    handle,
    IG_APP_ID,
  )

// Newest first. Instagram floats PINNED posts to the head of the list whatever
// their age, so sorting on the timestamp is what actually makes this "recent".
const newest = (items) =>
  [...items]
    .filter((p) => p.shortcode && p.ts)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, PER_ACCOUNT)

const results = []
for (const acc of pool.accounts) {
  try {
    const posts = newest(await harvest(acc.handle))
    if (!posts.length) throw new Error('no posts returned')
    results.push({ acc, posts, ok: true })
    const newestDate = new Date(posts[0].ts * 1000).toISOString().slice(0, 10)
    console.log(`  ✓ ${acc.handle} (${posts.length} posts, newest ${newestDate})`)
  } catch (err) {
    results.push({ acc, posts: [], ok: false })
    console.log(`  ✗ ${acc.handle}: ${err.message} — keeping previous posts`)
  }
  // Stay under Instagram's rate limiter.
  await sleep(2000)
}

const okCount = results.filter((r) => r.ok).length
console.log(`\n→ ${okCount}/${pool.accounts.length} accounts harvested`)

if (DRY) {
  for (const { acc, posts } of results) {
    for (const p of posts) {
      console.log(`   ${acc.handle} ${p.shortcode} ${new Date(p.ts * 1000).toISOString()}`)
    }
  }
  console.log('\n(dry run — nothing written)')
  await finish()
  process.exit(0)
}

// Nothing worked — the endpoint moved, or the session died mid-run. An intact
// pool beats a gutted one.
if (!okCount) {
  console.log('✗ No account harvested — nothing written.')
  await finish()
  process.exit(1)
}

// Reels live at /reel/<shortcode>/ and photos at /p/<shortcode>/. Social.jsx
// reads the shortcode out of either, and Instagram redirects between them.
const permalink = (p) =>
  `https://www.instagram.com/${p.isVideo ? 'reel' : 'p'}/${p.shortcode}/`

// Instagram's CDN serves the image to anyone with the URL, but wants a plausible
// referer. A failed download is NOT fatal: the post stays in the pool and its
// tile falls back to the deterministic Armenian motif (src/components/motifs.jsx).
async function download(p) {
  const res = await fetch(p.image, {
    headers: { referer: 'https://www.instagram.com/', 'user-agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 10000) throw new Error(`too small (${buf.length}B)`)
  await writeFile(path.join(IG_DIR, `${p.shortcode}.jpg`), buf)
  return buf.length
}

const accounts = []
for (const { acc, posts, ok } of results) {
  if (!ok) {
    // Degrade this account alone, exactly as scrape.mjs backfills a dead source.
    accounts.push({ handle: acc.handle, name: acc.name, url: acc.url, posts: previousPosts(acc) })
    continue
  }
  const kept = []
  for (const p of posts) {
    try {
      const bytes = await download(p)
      console.log(`  ✓ ${p.shortcode}.jpg (${(bytes / 1024).toFixed(0)} KB)`)
    } catch (err) {
      console.log(`  ✗ ${p.shortcode}.jpg: ${err.message} — keeping motif fallback`)
    }
    kept.push({ url: permalink(p), date: new Date(p.ts * 1000).toISOString() })
  }
  accounts.push({ handle: acc.handle, name: acc.name, url: acc.url, posts: kept })
}

const json = {
  _comment:
    'Instagram POOL — the recent posts of each curated account, harvested by `npm run ig-scrape` (drives a local logged-in Chrome; Instagram blocks CI). The hourly job re-randomises which of these show and in what order into instagram-feed.json. Each tile shows src/data/ig/<shortcode>.jpg, else a deterministic Armenian motif. The `accounts` list is hand-curated — the scraper rewrites their `posts`, never the list itself. Hand-editing a post is fine: add {url, date} and save its image as src/data/ig/<shortcode>.jpg.',
  accounts,
}
await writeFile(POOL, JSON.stringify(json, null, 2) + '\n')
console.log(`\n✓ wrote src/data/instagram.json (${accounts.reduce((n, a) => n + a.posts.length, 0)} posts)`)

// Drop images no post points at any more, so replacing the pool doesn't leave
// the bundle carrying every photo we have ever harvested.
const live = new Set(
  accounts.flatMap((a) => a.posts.map((p) => p.url.match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1])),
)
let dropped = 0
for (const file of await readdir(IG_DIR)) {
  if (!file.endsWith('.jpg') || live.has(file.replace(/\.jpg$/, ''))) continue
  await unlink(path.join(IG_DIR, file))
  dropped++
}
console.log(`✓ removed ${dropped} orphaned image(s) from src/data/ig/`)

await finish()
