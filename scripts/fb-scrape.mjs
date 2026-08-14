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
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { encode } from './lib/image.mjs'

const DRY = process.argv.includes('--dry')
const CONNECT = process.argv.includes('--connect')
const PAGE_URL = 'https://www.facebook.com/DonNarek'
// Scrape the main profile timeline; we then keep only the posts that fall
// under Facebook's "Other posts" heading (i.e. the regular chronological feed,
// excluding the pinned/featured posts shown above it).
const SCRAPE_URL = PAGE_URL
const OTHER_POSTS_RX = /^(other posts|autres publications)$/i
const AUTHOR = 'Don Narek'
// 25 — DEMANDÉ, sur une échelle qui reste MESURÉE. À 80 publications le mur
// pesait 25,3 Mo à lui seul (324 Ko de moyenne, jusqu'à 851 Ko la pièce) sur
// une page qui en téléchargeait 87 — l'étagère la plus lourde du site, devant
// les 90 tuiles Instagram réunies. Et rien ne la diffère : les images portent
// bien `loading="lazy"`, mais tout part au chargement, vérifié en parcourant la
// page sans qu'un octet de plus ne transite. Le passage en WebP 800 px
// (`scripts/lib/image.mjs`) a depuis divisé la pièce par deux — ~128 Ko en
// moyenne, mesuré sur les 18 fichiers de `src/data/fb/` —, donc 25 tient
// autour de 3,2 Mo, toujours dans l'ordre de grandeur d'un brin Instagram.
//
// LA GRANDEUR À SURVEILLER EST LE POIDS, PAS LE COMPTE : `Social.jsx` charge
// `src/data/fb/` par un glob `eager`, donc TOUT fichier resté dans le dossier
// part dans les deux `dist/`, y compris ceux qu'aucune entrée du JSON ne cite.
// Baisser ce nombre ne rend rien tant que les images en trop ne sont pas
// supprimées du dossier.
//
// CE PLAFOND EST LE SEUL DU MUR. Il y en avait un second dans `Social.jsx`,
// retiré parce qu'un plafond écrit à deux endroits diverge : le passage de 40
// à 80 ici avait fait disparaître la moitié des publications, sans erreur ni
// avertissement. Ne le réintroduisez pas — ce fichier décide de ce qui entre,
// la vue rend ce qu'elle reçoit.
const WANT = 25

// La photo de Don Narek LUI-MÊME est épinglée : toujours à la MÊME place du
// carrousel — la dernière —, et jamais perdue, même quand une récolte ne la
// retrouve pas (elle finit par sortir des 25 publications les plus récentes, le
// mur étant surtout fait de partages d'autres artistes). À 25 elle en sort
// beaucoup plus vite qu'à 80, donc le report depuis le snapshot précédent, plus
// bas, porte l'essentiel du travail : sans lui la signature du mur
// disparaîtrait.
//
// EN QUEUE, ET C'EST UN CHOIX ÉDITORIAL, pas une conséquence de l'ordre
// chronologique : le mur montre l'art arménien, et le portrait de celui qui le
// rassemble le signe — une signature se pose au bas de la toile. Rien ne le
// calcule ; c'est la composition d'`ordered`, tout en bas de ce fichier.
//
// D'où un id ET un fichier STABLES, hors de la numérotation `dn-NN`. C'est le
// point : si on la reportait sous son ancien numéro, la récolte suivante
// écrirait une AUTRE photo dans `dn-05.webp` et l'entrée reprise pointerait sur
// l'image de quelqu'un d'autre — une signature juste sur une toile qui ne lui
// appartient pas. `dn-narek.webp` n'est jamais écrit par la boucle numérotée.
const PINNED_ID = 'dn-narek'
const PINNED_FILE = `${PINNED_ID}.webp`

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FB_DIR = path.join(root, 'src/data/fb')
// Dedicated profile so we never clash with your open Chrome (no profile lock).
const PROFILE = path.join(root, '.cache/fb-chrome-profile')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Drop Facebook's per-view tracking params so the saved link is clean/stable.
const cleanLink = (h) =>
  h.replace(/&(?:__cft__\[\d+\]|__tn__|idorvanity)=[^&]*/g, '').replace(/[?&]+$/, '')

// Mesuré du temps où la récolte visait 80 publications : le mur pesait alors
// ~60 000 px d'images et le fil principal du rendu bloquait — un seul
// `Input.dispatchMouseEvent` a dépassé les 180 s que puppeteer accorde par
// défaut, et la récolte est morte à mi-course. La cible est descendue à 18,
// donc cette marge n'est plus atteinte ; elle est conservée telle quelle parce
// qu'elle ne coûte rien et que Facebook peut alourdir son mur sans prévenir.
const PROTOCOL_TIMEOUT = 600_000

const browser = CONNECT
  ? await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: { width: 1280, height: 1600 },
      protocolTimeout: PROTOCOL_TIMEOUT,
    })
  : await puppeteer.launch({
      executablePath: CHROME,
      headless: false,
      defaultViewport: { width: 1280, height: 1600 },
      userDataDir: PROFILE,
      protocolTimeout: PROTOCOL_TIMEOUT,
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
    // The publication's author — the "actor" line at the top of each article.
    // On this page timeline the poster is usually Don Narek, but shared and
    // group posts carry the original author's name, so we read whatever the
    // header shows rather than assuming. Walk up to the enclosing article, then
    // take the first profile/heading link's text (often wrapped in <strong>).
    const authorFor = (node) => {
      let art = node
      for (let i = 0; i < 15 && art; i++, art = art.parentElement) {
        if (art.getAttribute && art.getAttribute('role') === 'article') break
      }
      if (!art || !art.querySelectorAll) return null
      const sels =
        'h2 strong, h3 strong, h4 strong, [role="heading"] strong, ' +
        'strong a, a strong, h2 a, h3 a, h4 a, [role="heading"] a'
      for (const el of art.querySelectorAll(sels)) {
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (txt && txt.length >= 2 && txt.length <= 80) return txt
      }
      return null
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
      posts.push({ id: idOf(permalink), permalink, image: im.src, absY, author: authorFor(im) })
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
// First sighting wins for position, but the author line sometimes hydrates a
// scroll later than the photo — so backfill a missing author when we re-see a post.
const remember = (p) => {
  const cur = acc.get(p.id)
  if (!cur) acc.set(p.id, p)
  else if (!cur.author && p.author) cur.author = p.author
}
let boundaryY = null
let lastY = -1
let stuck = 0
// 60 tours suffisaient pour 40 publications, ~140 pour 80. La cible est
// désormais 18, donc ce plafond est largement au-dessus du besoin : il est
// gardé comme garde-fou, pas comme dimensionnement. La boucle s'arrête de
// toute façon dès qu'elle a son compte, ou quand le mur cesse d'avancer
// (compteur `stuck`).
for (let i = 0; i < 140 && acc.size < WANT + 5; i++) {
  const r = await survey()
  if (boundaryY === null) boundaryY = r.boundaryY
  for (const p of r.posts) remember(p)
  process.stdout.write(`\r   scrolling… y=${Math.round(r.y)} of ${r.docHeight}, ${acc.size} posts `)
  // Bottom of the wall: the viewport stops advancing. Facebook pages in lazily,
  // so give it a few rounds before believing it.
  if (Math.abs(r.y - lastY) < 2) {
    if (++stuck >= 4) break
  } else {
    stuck = 0
  }
  lastY = r.y
  // Un tour de roulette qui échoue ne doit pas emporter la récolte : on compte
  // le tour comme immobile, et la garde `stuck` conclura d'elle-même.
  await page.mouse.wheel({ deltaY: 1200 }).catch(() => {
    stuck++
  })
  await sleep(1500)
  await dismiss()
}
process.stdout.write('\n')
const last = await survey()
if (boundaryY === null) boundaryY = last.boundaryY
for (const p of last.posts) remember(p)
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
  console.log(`       by ${p.author || AUTHOR} — img ${p.image.slice(0, 90)}…`)
})

if (DRY || !found.length) {
  console.log(DRY ? '\n(dry run — nothing written)' : '\nNo posts found — nothing written.')
  await finish()
  process.exit(found.length ? 0 : 1)
}

// The grid only holds small thumbnails; open each photo's page to get the
// full-resolution image AND the real author. Don Narek re-shares other artists'
// and galleries' work, so the timeline "actor" is always the page — but the
// photo page names the actual source (ZART, National Gallery of Armenia,
// Vladimir Simonyan…) as the top profile link above the caption. That is the
// author we want on the card, so we read both in one visit.
const fullImageFor = async (permalink) => {
  try {
    await page.goto(permalink, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1800)
    await dismiss()
    return await page.evaluate(() => {
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
      // The author: the highest (smallest top) profile/page link in the header,
      // skipping the "View Post" permalink, online-status/comment links, places
      // (they sit lower) and generic action words. null → post is Don Narek's own.
      // Facebook a RENOMMÉ ce lien en français : « Voir la publication » est
      // devenu « Afficher la publication », et le filtre ne connaissait que
      // l'ancien libellé — six cartes sur quarante repartaient signées
      // « Afficher la publication » au lieu du peintre. Le verbe est donc
      // laissé ouvert. Même prudence côté anglais.
      const NOISE =
        /((?:view|see) post|(?:voir|afficher) la publication|online status|active now|indicator|reply|repl(y|ies)|comments?|commentaires|most relevant|plus pertinent|be the first|no comments|follow|suivre|like|comment|share|partager)/i
      let author = null
      let top = Infinity
      for (const link of document.querySelectorAll('a[href]')) {
        const href = link.href || ''
        if (/permalink\.php|\/photo|comment_id=|\/reactions\/|\/hashtag\//.test(href)) continue
        const isProfile =
          /facebook\.com\/profile\.php\?id=\d+/.test(href) || /facebook\.com\/[^/?#]+(?:[/?#]|$)/.test(href)
        if (!isProfile) continue
        const txt = (link.innerText || '').replace(/\s+/g, ' ').trim()
        if (!txt || txt.length < 2 || txt.length > 80 || NOISE.test(txt)) continue
        const r = link.getBoundingClientRect()
        if (r.top < 60 || r.top > 320) continue
        if (r.top < top) {
          top = r.top
          author = txt
        }
      }
      return { src: best, author }
    })
  } catch {
    return { src: null, author: null }
  }
}

// Le fichier précédent, lu AVANT d'être réécrit : c'est de là que vient la
// photo épinglée quand la récolte du jour ne la ramène pas.
const previous = await readFile(path.join(root, 'src/data/facebook.json'), 'utf-8')
  .then((t) => JSON.parse(t))
  .catch(() => null)

// Download images + build the posts array.
const posts = []
let pinned = null
let n = 0
for (const p of found.slice(0, WANT)) {
  // Visit the photo page once — it gives both the full-res image and the real
  // author. Read the author before the download so a failed image still keeps it.
  const { src, author } = await fullImageFor(p.permalink)
  const by = author || p.author || AUTHOR
  // Le mur est surtout fait de partages : une publication signée de la page
  // elle-même est une photo de Don Narek. La première rencontrée est épinglée
  // (l'ordre est chronologique, donc c'est la plus récente).
  const isOwn = by === AUTHOR && !pinned
  const id = isOwn ? PINNED_ID : `dn-${String(++n).padStart(2, '0')}`
  const file = isOwn ? PINNED_FILE : `${id}.webp`
  const url = cleanLink(p.permalink)
  try {
    // Download THROUGH the logged-in browser, not a bare fetch(). Facebook now
    // serves many images (t39.99422 / t51) only to a session with cookies; an
    // anonymous fetch gets a ~3KB access-denied placeholder. Navigating the tab
    // sends the session, so we read the real bytes off the response.
    const res = await page.goto(src || p.image, { waitUntil: 'load', timeout: 45000 })
    if (!res || !res.ok()) throw new Error(`HTTP ${res ? res.status() : 'no response'}`)
    const buf = await res.buffer()
    // Le plancher reste AVANT l'encodage, sur les octets reçus de Facebook —
    // c'est lui qui reconnaît le substitut « accès refusé » de ~3 ko servi à une
    // session sans cookies. Il vaut 15 000 ici et 10 000 dans ig-scrape : deux
    // sources, deux substituts, deux seuils. Ne pas les uniformiser.
    if (buf.length < 15000) throw new Error(`too small (${buf.length}B)`)
    const webp = await encode(buf)
    await writeFile(path.join(FB_DIR, file), webp)
    const entry = { id, author: by, url, image: file }
    if (isOwn) pinned = entry
    else posts.push(entry)
    console.log(`  ✓ ${file} — ${by} (${(webp.length / 1024).toFixed(0)} KB)${isOwn ? ' ← épinglée' : ''}`)
  } catch (e) {
    console.log(`  ✗ ${id} (${by}): ${e.message} — keeping motif fallback`)
    const entry = { id, author: by, url }
    if (isOwn) pinned = entry
    else posts.push(entry)
  }
}

// Aucune publication signée Don Narek dans cette récolte ? On reprend celle du
// fichier précédent. `dn-narek.webp` n'ayant pas été réécrit, l'image reste la
// bonne. C'est ce report qui tient la promesse « jamais effacée du carrousel ».
if (!pinned && previous) {
  pinned = previous.posts.find((p) => p.id === PINNED_ID) || null
  if (pinned) console.log(`  ↺ photo de ${AUTHOR} reprise du snapshot précédent`)
}
// Le mur dans l'ordre chronologique, PUIS la photo épinglée, qui le ferme. Le
// plafond compte la photo épinglée, pour que le mur ne dépasse jamais WANT —
// d'où `WANT - 1` sur les publications AVANT de l'ajouter. Trancher après
// l'ajout couperait exactement ce qu'on cherche à garder, puisqu'elle est
// désormais la dernière : le mur perdrait sa signature dès que la récolte
// ramène son compte, c'est-à-dire toujours.
const ordered = pinned ? [...posts.slice(0, WANT - 1), pinned] : posts.slice(0, WANT)
if (!pinned) console.log(`  ⚠ aucune photo de ${AUTHOR} — ni dans la récolte, ni dans le fichier précédent`)

const json = {
  _comment:
    'Don Narek Facebook wall — the carousel shows ONLY each post picture and its author; no Facebook page chrome. Generated by `node scripts/fb-scrape.mjs` (drives local Chrome to read the public page), newest first, capped at 25 (WANT in scripts/fb-scrape.mjs — the ONLY cap; the view renders whatever this file holds), with the page OWN photo (Don Narek) pinned LAST and never dropped (stable id/file dn-narek, carried over from the previous snapshot when a harvest does not find it). Images bundled from src/data/fb/. Re-run the scraper to refresh; hand-edit is fine too.',
  page: 'DonNarek',
  url: PAGE_URL,
  posts: ordered,
}
await writeFile(path.join(root, 'src/data/facebook.json'), JSON.stringify(json, null, 2) + '\n')

// ÉLAGAGE — ce que ce fichier laisse sur le disque est livré, cité ou non.
// `Social.jsx` charge `src/data/fb/` par un glob `import.meta.glob(..., { eager:
// true })` : Vite empaquette le DOSSIER, pas les entrées du JSON. Une image
// orpheline part donc dans les deux `dist/`, à chaque déploiement horaire, sans
// jamais s'afficher.
//
// Et il y en a une à chaque récolte, par construction : la boucle télécharge
// WANT publications, `ordered` en garde WANT - 1 pour laisser sa place à la
// photo épinglée. La dernière téléchargée est payée et jamais montrée. Le cas
// se reproduit à l'identique le jour où WANT baisse — l'ancien surplus resterait
// livré indéfiniment.
//
// DEUX GARDE-FOUS, et le premier est le seul qui compte.
//
// `PINNED_FILE` EST GARDÉ SANS CONDITION, même absent du mur du jour. C'est la
// seule promesse que ce fichier fait depuis toujours — la photo de Don Narek
// n'est jamais perdue — et l'élagage la brisait : le jour où la récolte ne
// ramène pas sa publication ET où le report échoue (fichier absent, JSON
// illisible, entrée déjà tombée), `pinned` vaut null, les 25 cartes ont leur
// image, `dn-narek.webp` devient un orphelin, et il part. Sans retour possible :
// la publication est sortie de la fenêtre récente, et le report suivant n'a plus
// ni fichier ni entrée à relire. Le script AVERTIT déjà dans ce cas — il aurait
// averti puis effacé.
//
// Le second : un mur sans AUCUNE image n'élague rien. Une entrée dont le
// téléchargement a échoué part sans `image` — légitime, la carte retombe sur son
// motif —, mais si le réseau les a toutes fait échouer, `keep` ne porterait que
// la photo épinglée et cette boucle viderait le dossier sur une panne passagère.
// Git le rattraperait ; le quart d'heure passé à comprendre, non.
const keep = new Set(ordered.map((p) => p.image).filter(Boolean))
const cites = keep.size
keep.add(PINNED_FILE)
if (!cites) {
  console.log('  ⚠ aucune image dans le mur — élagage sauté (récolte probablement en panne)')
} else {
  // `withFileTypes` : on ne supprime que des FICHIERS. `rm` sans `recursive`
  // rejette sur un répertoire, et ce rejet n'est rattrapé nulle part — la
  // récolte mourrait ici, le JSON déjà réécrit, Chrome jamais refermé et le
  // « ✓ wrote » jamais affiché : un plantage qui laisse croire que rien n'a été
  // écrit alors que tout l'a été.
  const orphans = (await readdir(FB_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && !keep.has(e.name))
    .map((e) => e.name)
  for (const f of orphans) {
    await rm(path.join(FB_DIR, f)).catch((e) => console.log(`  ↯ ${f} non supprimé : ${e.message}`))
  }
  if (orphans.length)
    console.log(`  ⌫ ${orphans.length} image(s) hors du mur supprimée(s) : ${orphans.join(', ')}`)
}
// `ordered`, pas `posts` : ce dernier ne compte pas la photo épinglée, et le
// script annonçait donc une publication de moins qu'il n'en écrivait.
console.log(`\n✓ wrote src/data/facebook.json (${ordered.length} posts)`)

await finish()
