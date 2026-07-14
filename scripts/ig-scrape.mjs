/**
 * LOCAL-ONLY: harvest each curated account's latest Instagram posts.
 *
 * Instagram blocks datacenter IPs, so this is NOT run in CI — you run it
 * locally, then commit + push (the hourly workflow deploys). The hourly job only
 * re-shuffles the pool this script writes; without a run, the wall re-serves the
 * same posts forever while looking fresh.
 *
 * It drives a real Chrome on your machine and calls Instagram's own
 * `web_profile_info` endpoint from inside the logged-in page, so the session
 * cookies ride along. That is ONE request per account, where scraping the grid
 * and then each post for its date would be ~90 navigations — enough for
 * Instagram to cut us off with "Please wait a few minutes".
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
import { readFile } from 'node:fs/promises'
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

// Task 2 adds the writes here.
await finish()
