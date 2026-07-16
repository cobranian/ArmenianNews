import * as cheerio from 'cheerio'
import https from 'node:https'
import { clean, safeUrl } from '../lib/util.mjs'

// Armenpress (armenpress.am) is Armenia's national news agency, and the only
// trilingual source here: fr/en/hy map 1:1 to the UI language. It does not lead
// the tab order — Courrier d'Erevan is French-only and prerenders more French
// copy for crawlers.
//
// It is an Inertia.js app: every page embeds its payload as JSON, so there are
// no CSS selectors here. This breaks if the payload changes shape, not on a
// redesign.
//
// Seven rubrics per language, read from the rubric pages. Two things that the
// page's own history got wrong, both measured (21/21 pages, 2026-07-16):
//   - The rubric pages are NOT empty. Their articles live at
//     props.data.data.hits — the homepage's props.feed.data.hits path reads as
//     an empty rubric, which is what "the rubric pages embed an empty feed"
//     came from. Every rubric returns 12-36 articles, all dated and imaged.
//   - There is no aggressive rate limit. All 21 pages load back to back.
const BASE = 'https://armenpress.am'
const HOST = 'armenpress.am'

// The UI language maps 1:1 — unlike ArmRadio, which has no French edition.
export const ARMENPRESS_LANGS = ['fr', 'en', 'hy']

// The seven rubrics of the site's own main nav, in its order. The key is the
// URL slug and doubles as the i18n key (see `apcats.*` in src/i18n.jsx).
export const ARMENPRESS_CATEGORIES = [
  'armenia',
  'economy',
  'world',
  'culture',
  'sports',
  'fact-check',
  'projects',
]

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Deliberately node:https, NOT lib/http.mjs's fetchText.
//
// The rubric pages answer 403 to Node's global fetch (undici) and 200 to
// node:https — same machine, same OpenSSL TLS, same HTTP/1.1, any headers, no
// rate limit involved. Header names, casing, Accept*, and sec-fetch-* were all
// ruled out one at a time; only the client itself predicts the 403. The
// homepage does not care, which is why the old homepage-based scrape never hit
// this. Switching this to fetchText will 403 every rubric, and the empty result
// is then silently backfilled — it will look like the site went quiet.
function getHtml(path, { retries = 2, timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: HOST, path, method: 'GET', headers: { 'User-Agent': UA, Accept: '*/*' }, timeout },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode} for ${path}`))
        }
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve(body))
      },
    )
    req.on('timeout', () => req.destroy(new Error(`timeout for ${path}`)))
    req.on('error', async (err) => {
      if (retries > 0) {
        await sleep(600)
        try {
          resolve(await getHtml(path, { retries: retries - 1, timeout }))
        } catch (e) {
          reject(e)
        }
      } else reject(err)
    })
    req.end()
  })
}

// The Inertia payload lives in the <script> body. `data-page` is the string
// "app" — reading it as the attribute yields "app" and throws in JSON.parse.
function pagePayload(html) {
  const raw = cheerio.load(html)('script[data-page]').html()
  if (!raw) throw new Error('no Inertia payload (script[data-page]) in the page')
  return JSON.parse(raw)
}

// Meilisearch hits → {title, url, date, image}. Titles and links only; the card
// sends the reader to armenpress.am.
function parseHits(hits, lang, limit) {
  return hits
    .slice(0, limit)
    .map((h) => {
      const title = clean(h.title)
      const id = h.article_id
      if (!title || !id) return null
      // published_at is Unix *seconds*; without ×1000 everything lands in 1970.
      const d = h.published_at ? new Date(h.published_at * 1000) : null
      return {
        title,
        url: `${BASE}/${lang}/article/${id}`,
        date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
        image: h.image ? safeUrl(`${BASE}${clean(h.image)}`) : null,
      }
    })
    .filter(Boolean)
}

async function scrapeCategory(lang, categoryKey, limit) {
  const page = pagePayload(await getHtml(`/${lang}/articles/${categoryKey}`))
  const hits = page.props?.data?.data?.hits
  if (!Array.isArray(hits)) throw new Error('payload has no props.data.data.hits')
  // Serving Armenian copy under the French tab would be worse than serving
  // nothing: fail the rubric instead.
  const got = hits[0]?.locale
  if (got && got !== lang) throw new Error(`asked for ${lang}, payload is ${got}`)
  return parseHits(hits, lang, limit)
}

// Latest articles per rubric per language. Each rubric fails on its own and is
// backfilled from the previous snapshot by scrape.mjs.
export async function scrapeArmenpress(limit = 10) {
  const out = {}
  for (const lang of ARMENPRESS_LANGS) {
    const sections = []
    for (const categoryKey of ARMENPRESS_CATEGORIES) {
      try {
        const articles = await scrapeCategory(lang, categoryKey, limit)
        sections.push({ categoryKey, articles })
        console.log(`  ✓ armenpress/${lang}/${categoryKey} (${articles.length})`)
      } catch (err) {
        console.warn(`  ✗ armenpress/${lang}/${categoryKey}: ${err.message}`)
        sections.push({ categoryKey, articles: [] })
      }
      await sleep(800)
    }
    out[lang] = sections
  }
  return out
}
