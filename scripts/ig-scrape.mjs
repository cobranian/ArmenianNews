/**
 * LOCAL-ONLY: harvest each curated account's latest Instagram posts.
 *
 * Instagram blocks datacenter IPs, so this is NOT run in CI — you run it
 * locally, then commit + push (the hourly workflow deploys). The hourly job only
 * re-shuffles the pool this script writes; without a run, the wall re-serves the
 * same posts forever while looking fresh.
 *
 * It drives a real Chrome on your machine and browses like a reader: it opens
 * each profile, pauses, scrolls the grid with the wheel at an irregular pace,
 * and reads the post batches (12 at a time) that the page itself receives from
 * `graphql`. No request of our own is sent — since October 2026 the
 * `/api/v1/feed/user/…` endpoints redirect to the home page. The slow pace is
 * the point: a fast run got the session rate-limited (429).
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
import { access, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import {
  keepable,
  pickImage,
  shortcodeOf,
  stopPaging,
  timelineItems,
  wantedFor,
} from './lib/ig-harvest.mjs'
import { encode } from './lib/image.mjs'

const DRY = process.argv.includes('--dry')
const CONNECT = process.argv.includes('--connect')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POOL = path.join(root, 'src/data/instagram.json')
const IG_DIR = path.join(root, 'src/data/ig')
// Dedicated profile so we never clash with your open Chrome (no profile lock).
const PROFILE = path.join(root, '.cache/ig-chrome-profile')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Un lecteur ne défile pas au métronome : chaque pause est tirée dans un
// intervalle, jamais fixe.
const pause = (min, max) => sleep(Math.round(min + Math.random() * (max - min)))

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

// Une session renvoyée vers la connexion ou un « challenge » ne se répare pas
// en continuant : les comptes suivants échoueraient tous, et chaque visite de
// plus aggrave le soupçon d'Instagram. On arrête la tournée.
class SessionBlocked extends Error {}

// Visite le profil comme un lecteur et lit les paquets de posts que la page
// reçoit. Rien n'est demandé directement : on défile, la page charge la suite.
async function harvestAll(handle, want) {
  const batches = []
  const onResponse = async (res) => {
    if (!res.url().includes('/graphql')) return
    let json
    try {
      json = await res.json()
    } catch {
      return // pas du JSON, ou corps déjà libéré : ce n'est pas le fil
    }
    const batch = timelineItems(json)
    if (batch) batches.push(batch)
  }
  page.on('response', onResponse)
  try {
    await page.goto(`https://www.instagram.com/${encodeURIComponent(handle)}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    if (/\/accounts\/login|\/challenge\//.test(page.url())) {
      throw new SessionBlocked(`redirigé vers ${new URL(page.url()).pathname}`)
    }
    // Le premier paquet arrive avec la page ; un lecteur regarde l'en-tête
    // du profil avant de défiler.
    for (let t = 0; t < 30 && !batches.length; t++) await sleep(500)
    await pause(2500, 5000)

    const bruts = new Set() // tout shortcode rencontré, exclus compris
    const vus = new Map() // ce qu'on garde
    let lus = 0
    let idle = 0
    for (;;) {
      if (lus < batches.length) {
        idle = 0
        // La progression se mesure sur les shortcodes BRUTS, pas sur ce qui
        // est retenu : un paquet de posts neufs mais tous exclus est une
        // vraie progression. Voir stopPaging (scripts/lib/ig-harvest.mjs).
        let freshRaw = 0
        let cursor = null
        for (; lus < batches.length; lus++) {
          const { items, cursor: c } = batches[lus]
          for (const it of items) {
            if (!it.shortcode || !it.ts || bruts.has(it.shortcode)) continue
            bruts.add(it.shortcode)
            freshRaw++
          }
          for (const it of keepable(items, EXCLUDE)) {
            if (it.shortcode && it.ts && !vus.has(it.shortcode)) vus.set(it.shortcode, it)
          }
          cursor = c
        }
        if (stopPaging({ kept: vus.size, want, freshRaw, cursor })) break
      } else if (++idle > 4) {
        break // plus rien ne charge : fin de grille, ou la page s'est tue
      }
      // Un coup de molette d'amplitude variable, puis le temps de regarder ;
      // de temps en temps, un arrêt plus long sur un post.
      await page.mouse.wheel({ deltaY: Math.round(500 + Math.random() * 600) })
      await pause(2000, 4500)
      if (Math.random() < 0.15) await pause(4000, 9000)
    }
    if (!batches.length) throw new Error('aucun fil de posts reçu par la page de profil')
    return { items: [...vus.values()], pages: batches.length }
  } finally {
    page.off('response', onResponse)
  }
}

// Newest first. Instagram floats PINNED posts to the head of the list whatever
// their age, so sorting on the timestamp is what actually makes this "recent".
const newest = (items, want) => [...items].sort((a, b) => b.ts - a.ts).slice(0, want)

const results = []
// Trois échecs d'affilée ne sont plus trois comptes en panne mais une session
// bridée : la run du 19 octobre 2026 a enchaîné 27 échecs, et c'est cette
// rafale qui a valu le 429. On arrête la tournée, les comptes restants gardent
// leurs posts précédents.
const MAX_ECHECS = 3
let echecs = 0
let arret = null
let visites = 0
for (const acc of pool.accounts) {
  if ((ONLY && !ONLY.includes(acc.handle)) || arret) {
    results.push({ acc, posts: [], ok: false, skipped: true })
    continue
  }
  // Entre deux profils, le temps qu'un lecteur passe à autre chose.
  if (visites++) await pause(8000, 16000)
  const want = wantedFor(acc)
  try {
    const { items, pages } = await harvestAll(acc.handle, want)
    const posts = newest(items, want)
    if (!posts.length) throw new Error('no posts returned')
    results.push({ acc, posts, ok: true })
    echecs = 0
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
    if (err instanceof SessionBlocked) arret = `session bloquée (${err.message})`
    else if (++echecs >= MAX_ECHECS) arret = `${echecs} échecs d'affilée`
    if (arret) console.log(`  ⛔ tournée arrêtée : ${arret} — les comptes restants gardent leurs posts`)
  }
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

// Une image déjà sur disque n'est pas retéléchargée : un shortcode désigne
// toujours la même photo, et retélécharger ~3 800 fichiers en rafale est tout sauf
// le comportement d'un lecteur. Un .jpg resté de la migration est réencodé.
const present = (p) =>
  access(path.join(IG_DIR, `${p.shortcode}.webp`)).then(() => true, () => false)

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
  // LE PLANCHER RESTE ICI, sur le JPEG REÇU — jamais après l'encodage. C'est lui
  // qui distingue une vraie image d'une page d'erreur (il a attrapé
  // DWr7TYjjHd9, 9,6 ko). Déplacé après, une image légitime de 42 ko ramenée à
  // 8 ko serait rejetée comme corrompue : un faux négatif silencieux, la tuile
  // retombant sur son motif sans que rien ne l'explique.
  if (buf.length < 10000) throw new Error(`too small (${buf.length}B)`)
  const webp = await encode(buf)
  await writeFile(path.join(IG_DIR, `${p.shortcode}.webp`), webp)
  return webp.length
}

const accounts = []
let reused = 0
for (const { acc, posts, ok } of results) {
  if (!ok) {
    // Degrade this account alone, exactly as scrape.mjs backfills a dead source.
    accounts.push({ ...acc, posts: previousPosts(acc) })
    continue
  }
  const kept = []
  for (const p of posts) {
    try {
      if (await present(p)) {
        reused++
      } else {
        const bytes = await download(p)
        console.log(`  ✓ ${p.shortcode}.webp (${(bytes / 1024).toFixed(0)} KB)`)
      }
    } catch (err) {
      console.log(`  ✗ ${p.shortcode}.webp: ${err.message} — keeping motif fallback`)
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
console.log(`✓ ${reused} image(s) déjà présente(s), non retéléchargée(s)`)

// Drop images no post points at any more, so replacing the pool doesn't leave
// the bundle carrying every photo we have ever harvested.
const live = new Set(accounts.flatMap((a) => a.posts.map((p) => shortcodeOf(p.url))))
let dropped = 0
// Balaie les DEUX extensions : verrouillé sur une seule, le nettoyage laisserait
// l'autre s'accumuler sans qu'aucun compte ne diverge — pendant la migration
// vers WebP, puis indéfiniment pour toute image restée en JPEG.
for (const file of await readdir(IG_DIR)) {
  const m = file.match(/^(.+)\.(?:jpg|webp)$/)
  if (!m || live.has(m[1])) continue
  await unlink(path.join(IG_DIR, file))
  dropped++
}
console.log(`✓ removed ${dropped} orphaned image(s) from src/data/ig/`)

await finish()
