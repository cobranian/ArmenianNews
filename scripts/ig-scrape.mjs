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
import {
  keepable,
  pageCount,
  pickImage,
  shortcodeOf,
  wantedFor,
} from './lib/ig-harvest.mjs'

const DRY = process.argv.includes('--dry')
const CONNECT = process.argv.includes('--connect')

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

// La liste d'exclusion vit à la racine du pool et ne s'applique qu'ICI : c'est
// ce script qui décide de ce qui entre. Ni selectInstagram ni Social.jsx ne la
// relisent — un filtre écrit à deux endroits finit par diverger, et le pool est
// simplement dépourvu de ces posts.
const EXCLUDE = new Set(pool.exclude || [])

// --only <handle[,handle]> : récolter un compte sans réécrire les 26 autres.
// Ajouter un compte coûterait sinon 27 requêtes, une réécriture complète du
// pool et un re-téléchargement de toutes les images.
const onlyFlag = process.argv.findIndex((a) => a === '--only' || a.startsWith('--only='))
const onlyRaw =
  onlyFlag === -1
    ? null
    : process.argv[onlyFlag].includes('=')
      ? process.argv[onlyFlag].split('=').slice(1).join('=')
      : process.argv[onlyFlag + 1]
const ONLY = onlyRaw ? onlyRaw.split(',').map((s) => s.trim()).filter(Boolean) : null

// Une faute de frappe ne doit pas se lire comme un échec réseau : sans cette
// garde, `--only simonianjewels` récolterait zéro compte et annoncerait
// "rien écrit", ce qui ressemble à une panne Instagram. La garde doit rester
// AVANT le lancement de Chrome — sinon une faute de frappe ouvre quand même
// une fenêtre pour rien.
if (ONLY) {
  const inconnus = ONLY.filter((h) => !pool.accounts.some((a) => a.handle === h))
  if (inconnus.length) {
    console.log(`✗ handle absent du pool : ${inconnus.join(', ')}`)
    process.exit(1)
  }
  console.log(`→ --only : ${ONLY.join(', ')}`)
}

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

// One request per page, issued from the page so the session cookies ride along.
// Throws on a non-200 — the caller degrades that account.
//
// This is the profile-grid feed. Its sibling `web_profile_info` is the endpoint
// you'll find in every guide online, and it still answers 200 with the account's
// bio and post COUNT — but its `edges` array now comes back empty, so it reads as
// a working call that found no posts. Don't go back to it.
const harvestPage = (handle, count, maxId) =>
  page.evaluate(
    async (h, appId, n, cursor) => {
      const qs = new URLSearchParams({ count: String(n) })
      if (cursor) qs.set('max_id', cursor)
      const res = await fetch(
        `/api/v1/feed/user/${encodeURIComponent(h)}/username/?${qs}`,
        { headers: { 'x-ig-app-id': appId }, credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!Array.isArray(json?.items)) throw new Error('unexpected payload shape')
      return {
        items: json.items.map((it) => ({
          shortcode: it.code,
          ts: it.taken_at,
          // A carousel post carries no image of its own — its first slide does.
          // The full candidate list travels: picking a size is a Node-side
          // decision (scripts/lib/ig-harvest.mjs), not a browser-side one.
          candidates:
            it.image_versions2?.candidates ||
            it.carousel_media?.[0]?.image_versions2?.candidates ||
            [],
          // 1 = photo, 2 = video/reel, 8 = carousel.
          isVideo: it.media_type === 2,
        })),
        nextMaxId: json.next_max_id || null,
      }
    },
    handle,
    IG_APP_ID,
    count,
    maxId || null,
  )

// Suit `next_max_id` jusqu'à tenir `want` posts NON EXCLUS, ou jusqu'à
// épuisement du compte. Une boucle de pagination sur un compte dont on ignore
// la taille est un chèque en blanc : `wantedFor` plafonne déjà à MAX_COUNT, et
// la pause entre les pages est la même précaution que celle entre les comptes —
// ce script existe parce qu'Instagram coupe l'accès sur un rythme trop soutenu.
async function harvestAll(handle, want) {
  const per = pageCount(want, EXCLUDE.size)
  const vus = new Map()
  let cursor = null
  let pages = 0
  do {
    const { items, nextMaxId } = await harvestPage(handle, per, cursor)
    const before = vus.size
    for (const it of keepable(items, EXCLUDE)) {
      if (it.shortcode && it.ts && !vus.has(it.shortcode)) vus.set(it.shortcode, it)
    }
    cursor = nextMaxId
    pages++
    // Une page vide n'est pas le seul signe d'un compte épuisé : un
    // `next_max_id` qui reboucle sur des posts déjà vus (aucun ajout à `vus`)
    // en est un autre, et sans ce second garde-fou la boucle ne terminerait
    // jamais — `cursor` resterait non nul et `vus.size` resterait sous `want`.
    if (!items.length || vus.size === before) break
    if (cursor) await sleep(1500)
  } while (cursor && vus.size < want)
  return { items: [...vus.values()], pages }
}

// Newest first. Instagram floats PINNED posts to the head of the list whatever
// their age, so sorting on the timestamp is what actually makes this "recent".
const newest = (items, want) => [...items].sort((a, b) => b.ts - a.ts).slice(0, want)

const results = []
for (const acc of pool.accounts) {
  if (ONLY && !ONLY.includes(acc.handle)) {
    results.push({ acc, posts: [], ok: false, skipped: true })
    continue
  }
  const want = wantedFor(acc)
  try {
    const { items, pages } = await harvestAll(acc.handle, want)
    const posts = newest(items, want)
    if (!posts.length) throw new Error('no posts returned')
    results.push({ acc, posts, ok: true })
    const newestDate = new Date(posts[0].ts * 1000).toISOString().slice(0, 10)
    const p = pages > 1 ? `, ${pages} pages` : ''
    console.log(`  ✓ ${acc.handle} (${posts.length} posts, newest ${newestDate}${p})`)
    // Le seul état où le pool contient autre chose que ce qui a été demandé.
    // Ce n'est pas une erreur — le compte peut simplement avoir peu publié —
    // mais rien d'autre ne le signalerait.
    if (posts.length < want) {
      console.log(`    ↯ ${acc.handle} voulait ${want} posts, le compte en rend ${posts.length}`)
    }
  } catch (err) {
    results.push({ acc, posts: [], ok: false })
    console.log(`  ✗ ${acc.handle}: ${err.message} — keeping previous posts`)
  }
  // Stay under Instagram's rate limiter.
  await sleep(2000)
}

const okCount = results.filter((r) => r.ok).length
const tentes = results.filter((r) => !r.skipped).length
console.log(`\n→ ${okCount}/${tentes} accounts harvested`)

if (DRY) {
  let total = 0
  for (const { acc, posts, skipped } of results) {
    if (skipped) continue
    for (const p of posts) {
      const src = pickImage(p.candidates)
      console.log(
        `   ${acc.handle} ${p.shortcode} ${new Date(p.ts * 1000).toISOString()} ` +
          `${src ? (p.candidates.find((c) => c.url === src)?.width ?? '?') + 'px' : 'sans image'}`,
      )
    }
    total += posts.length
  }
  console.log(`\n(dry run — ${total} posts retenus, rien écrit)`)
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
  const src = pickImage(p.candidates)
  if (!src) throw new Error('no usable image candidate')
  const res = await fetch(src, {
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
    accounts.push({ ...acc, posts: previousPosts(acc) })
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
  // Spread the curated account so hand-maintained fields (name, url, group…)
  // survive the rewrite — the scraper owns `posts`, and nothing else.
  accounts.push({ ...acc, posts: kept })
}

// `...pool` d'abord : la racine porte `exclude`, que ce script lit sans le
// posséder. Reconstruire l'objet à partir de rien l'effacerait à la première
// récolte — un JSON valide, un pool sans exclusion, et rien pour le dire.
const json = { ...pool, accounts }
await writeFile(POOL, JSON.stringify(json, null, 2) + '\n')
console.log(`\n✓ wrote src/data/instagram.json (${accounts.reduce((n, a) => n + a.posts.length, 0)} posts)`)

// Drop images no post points at any more, so replacing the pool doesn't leave
// the bundle carrying every photo we have ever harvested.
const live = new Set(accounts.flatMap((a) => a.posts.map((p) => shortcodeOf(p.url))))
let dropped = 0
for (const file of await readdir(IG_DIR)) {
  if (!file.endsWith('.jpg') || live.has(file.replace(/\.jpg$/, ''))) continue
  await unlink(path.join(IG_DIR, file))
  dropped++
}
console.log(`✓ removed ${dropped} orphaned image(s) from src/data/ig/`)

await finish()
