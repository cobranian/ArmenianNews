import * as cheerio from 'cheerio'
import { fetchTextNode } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// CivilNet (civilnet.am) — the Yerevan independent newsroom, and the third
// source here to serve all four UI languages (fr/en/hy/ru map 1:1, like
// Armenpress; the California Courier gets there through a translated column).
//
// Like Armenpress it is an **Inertia.js** app: the feed is embedded as JSON in
// the page, so there are no CSS selectors here. This breaks if the payload
// changes shape, not on a redesign. Two differences from Armenpress worth
// knowing:
//   - The rubric articles live at `props.feed.data.hits` — NOT Armenpress'
//     `props.data.data.hits`. Same framework, different page component
//     (`feed/Tag`), different path. Copying the Armenpress path here reads as an
//     empty rubric.
//   - The rubric **name** ships in the payload too (`props.structure.tag.name`),
//     already in the page's own language. So labels ride in the data, like
//     Asbarez and Oragark, instead of going through i18n's `t()`: each edition
//     is only ever rendered under its matching UI language, and the four
//     editions do not even share a rubric list (see SECTIONS).
//
// It also 403s Node's `fetch` and 200s `node:https` — exactly the Armenpress
// trap, which is why both now go through `fetchTextNode`. See lib/http.mjs.
const BASE = 'https://civilnet.am'
const HOST = 'civilnet.am'

// The rubrics each edition actually publishes, in the site's own nav order.
// These lists are deliberately NOT identical: the French edition has no world
// or opinion desk, the Armenian one runs Human rights where the others run
// Society. Asking a language for a rubric it does not have returns an empty
// feed that backfill would then mask forever.
export const CIVILNET_SECTIONS = {
  fr: ['politics', 'economy', 'society', 'region', 'civilnetcheck'],
  en: [
    'politics',
    'economy',
    'society',
    'region',
    'opinion',
    'civilnetcheck',
    'world',
    'democracy-watch',
  ],
  hy: ['politics', 'economy', 'region', 'human-rights', 'civilnetcheck', 'world', 'opinion'],
  ru: ['politics', 'economy', 'society', 'region', 'civilnetcheck', 'opinion'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The Inertia payload lives in the <script> body. `data-page` is the string
// "app" — reading it as the attribute yields "app" and throws in JSON.parse.
function pagePayload(html) {
  const raw = cheerio.load(html)('script[data-page]').html()
  if (!raw) throw new Error('no Inertia payload (script[data-page]) in the page')
  return JSON.parse(raw)
}

// Meilisearch hits → {title, url, date, image}.
//
// A hit carries no slug, only `article_id`. `/{lang}/news/{id}` is the stable
// address: it serves the article, or 301s to its canonical page (a video piece
// lands on `/{lang}/video/{id}`). The id is per-edition, so the language in the
// path must be the edition the hit came from — an English id under /hy/ 404s.
// Thumbnails are absolute already and hotlink fine from the browser (no
// Cloudflare hotlink protection here, unlike ArmRadio).
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
        url: `${BASE}/${lang}/news/${id}`,
        date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
        image: safeUrl(clean(h.thumbnail)),
      }
    })
    .filter(Boolean)
}

async function scrapeCategory(lang, slug, limit) {
  const page = pagePayload(await fetchTextNode(HOST, `/${lang}/news/${slug}`))
  const hits = page.props?.feed?.data?.hits
  if (!Array.isArray(hits)) throw new Error('payload has no props.feed.data.hits')
  // Serving Armenian copy under the French tab would be worse than serving
  // nothing: fail the rubric instead.
  const got = hits[0]?.locale
  if (got && got !== lang) throw new Error(`asked for ${lang}, payload is ${got}`)
  return {
    label: clean(page.props?.structure?.tag?.name) || slug,
    articles: parseHits(hits, lang, limit),
  }
}

// Latest articles per rubric per language, spaced like Armenpress (26 pages).
// Each rubric fails on its own and is backfilled from the previous snapshot by
// scrape.mjs (keyName 'categoryKey').
export async function scrapeCivilnet(limit = 10) {
  const out = {}
  for (const [lang, slugs] of Object.entries(CIVILNET_SECTIONS)) {
    const sections = []
    for (const categoryKey of slugs) {
      try {
        const { label, articles } = await scrapeCategory(lang, categoryKey, limit)
        sections.push({ categoryKey, label, articles })
        console.log(`  ✓ civilnet/${lang}/${categoryKey} (${articles.length}) — ${label}`)
      } catch (err) {
        console.warn(`  ✗ civilnet/${lang}/${categoryKey}: ${err.message}`)
        sections.push({ categoryKey, label: categoryKey, articles: [] })
      }
      await sleep(800)
    }
    out[lang] = sections
  }
  return out
}
