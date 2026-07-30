import * as cheerio from 'cheerio'
import { fetchTextNode } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// NEWS.am — Yerevan's largest private news group, served under en/hy/ru.
//
// It is really **four sites**, and that is the whole complexity of this module:
//
//   news.am            the modern newsroom — an Inertia.js app, 7 rubrics
//   sport.news.am      \
//   style.news.am       > three legacy verticals, a completely different CMS
//   med.news.am        /
//
// The verticals are NOT reachable from the modern site. `news.am/{lang}/news/
// sports` and `/medicine` do exist as cross-posted tags, but they run days
// behind their vertical (Sports was 9 days stale when this was written) and
// `style` 404s outright. Each vertical has to be read from its own host.
//
// Everything here goes through `fetchTextNode` (node:https), never `fetchText`
// (undici): every news.am host answers **403 to Node's global fetch and 200 to
// node:https** — the exact trap already documented for Armenpress and CivilNet
// in lib/http.mjs. Moving any call to `fetchText` fails all 30 pages, and
// backfill then masks it as "the site went quiet".
const MAIN_HOST = 'news.am'

// The modern site's URL segment is our UI language code; the legacy verticals
// predate that and use their own three-letter segments.
const LEGACY_SEG = { en: 'eng', hy: 'arm', ru: 'rus' }

// Yerevan is UTC+4 year-round (Armenia dropped DST in 2012). The legacy sites
// print wall-clock times with no zone and file their images under the
// publication month — both are Yerevan-local, so both need this offset.
const YEREVAN_OFFSET_MS = 4 * 3600 * 1000

// A legacy feed that stops being updated does not error — it keeps serving old
// articles forever. med.news.am's RSS does exactly that: every language of
// `/{seg}/rss/news` returns 100 items frozen in **November 2013**, in ascending
// order, and has for over a decade. Without this guard that would have shipped
// 13-year-old headlines as today's news; with it the rubric fails, is backfilled
// once, and then goes visibly empty. 60 days is loose enough for a genuinely
// quiet vertical and tight enough to catch a dead feed.
const MAX_AGE_DAYS = 60

// The rubric list, in the order the reader asked for it: the modern site's seven
// rubrics interleaved with the three verticals, exactly as news.am's own nav
// presents them.
//   kind 'main'   — Inertia payload on news.am
//   kind 'rss'    — the vertical's RSS feed (title/url/date), image derived
//   kind 'html'   — the vertical's HTML feed page (RSS is dead — see above)
// `label` is fixed for the verticals because "NEWS.am Sport" / "Style" /
// "Medicine" are the sites' own brand names, identical under all three
// languages; the modern rubrics take their label from the payload, already
// localised. Either way the label rides in the data, like asbarez/oragark/
// civilnet — a single-language name cannot cross-render through t().
const SECTIONS = [
  { key: 'politics', kind: 'main', slug: 'politics' },
  { key: 'business', kind: 'main', slug: 'business' },
  { key: 'sport', kind: 'rss', host: 'sport.news.am', label: 'NEWS.am Sport' },
  { key: 'economics', kind: 'main', slug: 'economics' },
  { key: 'style', kind: 'rss', host: 'style.news.am', label: 'NEWS.am Style' },
  { key: 'analytics', kind: 'main', slug: 'analytics' },
  { key: 'medicine', kind: 'html', host: 'med.news.am', label: 'NEWS.am Medicine' },
  { key: 'incidents', kind: 'main', slug: 'incidents' },
  { key: 'society', kind: 'main', slug: 'society' },
  { key: 'culture', kind: 'main', slug: 'culture' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const iso = (d) => (d && !Number.isNaN(d.getTime()) ? d.toISOString() : null)

// ─── the modern site ────────────────────────────────────────────────────────

// The Inertia payload lives in the <script> body. `data-page` is the string
// "app" — reading it as the attribute yields "app" and throws in JSON.parse.
function pagePayload(html) {
  const raw = cheerio.load(html)('script[data-page]').html()
  if (!raw) throw new Error('no Inertia payload (script[data-page]) in the page')
  return JSON.parse(raw)
}

// Meilisearch hits → {title, url, date, image}.
//
// Same shape as CivilNet's, and the same `props.feed.data.hits` path (both are
// `feed/Tag` pages) — NOT Armenpress' `props.data.data.hits`. One difference
// from CivilNet worth knowing: news.am's `article_id` is **shared across
// editions**, so /hy/news/{id} serves the Armenian translation of the same
// story. CivilNet's ids are per-edition and 404 across languages.
function parseHits(hits, lang, limit) {
  return hits
    .slice(0, limit)
    .map((h) => {
      const title = clean(h.title)
      const id = h.article_id
      if (!title || !id) return null
      return {
        title,
        url: `https://${MAIN_HOST}/${lang}/news/${id}`,
        // published_at is Unix *seconds*; without ×1000 everything lands in 1970.
        date: iso(h.published_at ? new Date(h.published_at * 1000) : null),
        image: safeUrl(clean(h.thumbnail)),
      }
    })
    .filter(Boolean)
}

async function scrapeMain(lang, slug, limit) {
  const page = pagePayload(await fetchTextNode(MAIN_HOST, `/${lang}/news/${slug}`))
  const hits = page.props?.feed?.data?.hits
  if (!Array.isArray(hits)) throw new Error('payload has no props.feed.data.hits')
  // Serving Russian copy under the Armenian tab would be worse than serving
  // nothing: fail the rubric instead.
  const got = page.props?.locale?.current
  if (got && got !== lang) throw new Error(`asked for ${lang}, payload is ${got}`)
  return {
    label: clean(page.props?.structure?.tag?.name) || slug,
    articles: parseHits(hits, lang, limit),
  }
}

// ─── the legacy verticals ───────────────────────────────────────────────────

// The legacy CMS files every article's thumbnail at a fixed, guessable path:
//   https://<host>/static/news/s/<YYYY>/<MM>/<articleId>.jpg
// keyed on the article's **Yerevan-local** publication month. The RSS carries no
// <enclosure>, <media:content> or <media:thumbnail> of any kind, so deriving the
// path is what keeps these cards from all falling back to motifs — and it costs
// no extra request. Verified 200 image/jpeg on sport and style; a miss just
// 404s in the browser and ArticleCard swaps in its motif.
export function legacyImage(host, id, date) {
  if (!id || !date) return null
  const local = new Date(date.getTime() + YEREVAN_OFFSET_MS)
  const yyyy = local.getUTCFullYear()
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0')
  return `https://${host}/static/news/s/${yyyy}/${mm}/${id}.jpg`
}

const articleId = (href) => (String(href).match(/\/news\/(\d+)/) || [])[1] || null

// Fail a vertical whose newest article is older than MAX_AGE_DAYS. See the
// MAX_AGE_DAYS note: this is the guard that catches a feed frozen years ago,
// which no HTTP status ever reports.
function assertFresh(what, articles) {
  const newest = Math.max(...articles.map((a) => (a.date ? Date.parse(a.date) : 0)), 0)
  if (!newest) return
  const days = (Date.now() - newest) / 86400000
  if (days > MAX_AGE_DAYS) {
    throw new Error(`${what} looks abandoned — newest article is ${Math.round(days)} days old`)
  }
}

// sport + style: RSS gives a real RFC-822 pubDate, which is the one
// machine-readable date anywhere on these sites (the HTML prints localised text
// like "30 հուլիսի, 17:30", and med even drops the year). Links come back as
// **http://** — forced to https here so they don't rely on the CSP's
// upgrade-insecure-requests.
function parseRss(xml, host, limit) {
  const $ = cheerio.load(xml, { xmlMode: true })
  const out = []
  $('item').each((_, el) => {
    if (out.length >= limit) return
    const $it = $(el)
    const title = clean($it.find('title').first().text())
    const link = safeUrl(clean($it.find('link').first().text()))
    if (!title || !link) return
    const raw = clean($it.find('pubDate').first().text())
    const d = raw ? new Date(raw) : null
    const date = d && !Number.isNaN(d.getTime()) ? d : null
    const id = articleId(link)
    out.push({
      title,
      url: link.replace(/^http:\/\//, 'https://'),
      date: iso(date),
      image: legacyImage(host, id, date),
    })
  })
  return out
}

async function scrapeRss(host, lang, limit) {
  const xml = await fetchTextNode(host, `/${LEGACY_SEG[lang]}/rss/news`)
  const articles = parseRss(xml, host, limit)
  assertFresh(host, articles)
  return articles
}

// med.news.am only. Its RSS is dead (see MAX_AGE_DAYS), so the feed page is the
// live source. The markup is schema.org-flavoured but carries no `datetime`
// attribute and no JSON-LD, so the date is reassembled from two halves:
//   • year + month — from the thumbnail's own path, which is machine-readable
//   • day + HH:MM  — from the <time> text, read **numerically**
// Reading it numerically is the point: "July 29, 20:34" / "30 հուլիսի, 17:30" /
// "30 июля, 16:24" all give up their day and time without ever parsing a month
// name, so one rule covers all three languages.
export function parseTimeText(text, imgSrc) {
  const t = clean(text)
  const hm = t.match(/(\d{1,2}):(\d{2})/)
  if (!hm) return null
  // Strip the clock, then the only 1-2 digit number left is the day.
  const dayMatch = t.replace(hm[0], ' ').match(/\b(\d{1,2})\b/)
  const ym = String(imgSrc || '').match(/\/static\/news\/\w+\/(\d{4})\/(\d{2})\//)
  if (!dayMatch || !ym) return null
  const ms = Date.UTC(+ym[1], +ym[2] - 1, +dayMatch[1], +hm[1], +hm[2]) - YEREVAN_OFFSET_MS
  return iso(new Date(ms))
}

function parseMedFeed(html, host, limit) {
  const $ = cheerio.load(html)
  const out = []
  $('article[itemtype]').each((_, el) => {
    if (out.length >= limit) return
    const $a = $(el)
    const href = $a.find('a[href]').first().attr('href')
    const title = clean($a.find('.title, h1, h2, h3').first().text())
    const url = safeUrl(href, `https://${host}`)
    if (!title || !url) return
    const imgSrc = $a.find('img[src]').first().attr('src')
    out.push({
      title,
      url,
      date: parseTimeText($a.find('time, .time').first().text(), imgSrc),
      image: safeUrl(imgSrc, `https://${host}`),
    })
  })
  return out
}

async function scrapeMed(host, lang, limit) {
  const html = await fetchTextNode(host, `/${LEGACY_SEG[lang]}/news/`)
  const articles = parseMedFeed(html, host, limit)
  if (!articles.length) throw new Error('no article[itemtype] cards on the feed page')
  assertFresh(host, articles)
  return articles
}

// ─── orchestration ──────────────────────────────────────────────────────────

async function scrapeSection(sec, lang, limit) {
  if (sec.kind === 'main') return scrapeMain(lang, sec.slug, limit)
  const articles =
    sec.kind === 'rss'
      ? await scrapeRss(sec.host, lang, limit)
      : await scrapeMed(sec.host, lang, limit)
  return { label: sec.label, articles }
}

// The legacy verticals throw the odd HTTP 500 — med.news.am most often, and on
// a different language each time. `fetchTextNode` retries dropped connections
// but rejects any non-200 immediately, which is right for the 403s it was
// written for and wrong for a passing server hiccup: one blip would empty the
// rubric, backfill would paper over it, and nothing would say so. Retrying the
// whole section is the cheapest fix and needs no change to the shared helper.
async function scrapeSectionWithRetry(sec, lang, limit, attempts = 3) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await scrapeSection(sec, lang, limit)
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) await sleep(1200 * (i + 1))
    }
  }
  throw lastErr
}

// Ten rubrics × three languages = 30 pages per snapshot, spaced like Armenpress
// and CivilNet. Each rubric fails on its own and is backfilled from the previous
// snapshot by scrape.mjs (keyName 'categoryKey').
export async function scrapeNewsam(limit = 10) {
  const out = {}
  for (const lang of Object.keys(LEGACY_SEG)) {
    const sections = []
    for (const sec of SECTIONS) {
      try {
        const { label, articles } = await scrapeSectionWithRetry(sec, lang, limit)
        sections.push({ categoryKey: sec.key, label, articles })
        console.log(`  ✓ newsam/${lang}/${sec.key} (${articles.length}) — ${label}`)
      } catch (err) {
        console.warn(`  ✗ newsam/${lang}/${sec.key}: ${err.message}`)
        sections.push({ categoryKey: sec.key, label: sec.label || sec.key, articles: [] })
      }
      await sleep(800)
    }
    out[lang] = sections
  }
  return out
}
