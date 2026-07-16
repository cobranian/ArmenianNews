import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean, safeUrl } from '../lib/util.mjs'

// Armenpress (armenpress.am) is Armenia's national news agency, and the only
// source here with a real French edition — which is why it leads the tab order:
// NewsBrowser renders only the active tab, so the default source is what gets
// prerendered and indexed. See docs/superpowers/specs/2026-07-16-armenpress-*.
//
// It is an Inertia.js app: every page embeds its payload as JSON. We read the
// homepage feed rather than the per-rubric pages, which embed an empty feed and
// load client-side — and because the site rate-limits hard (a residential IP
// earned a site-wide 403 after ~30 requests in 15 minutes). Three requests per
// snapshot, spaced. Do not add more without re-reading that spec.
//
// No CSS selectors: this breaks only if the payload changes shape, not on a
// redesign.
const BASE = 'https://armenpress.am'

// The UI language maps 1:1 — unlike ArmRadio, which has no French edition.
export const ARMENPRESS_LANGS = ['fr', 'en', 'hy']

// One rubric: the homepage feed is a single wire, and the hits carry no rubric
// field (their tags are location/person/organization facets).
export const ARMENPRESS_CATEGORY = 'fil'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

async function scrapeLang(lang, limit) {
  const page = pagePayload(await fetchText(`${BASE}/${lang}`))
  const hits = page.props?.feed?.data?.hits
  if (!Array.isArray(hits)) throw new Error('payload has no props.feed.data.hits')
  // Serving Armenian copy under the French tab would be worse than serving
  // nothing: fail the language instead.
  const got = hits[0]?.locale
  if (got && got !== lang) throw new Error(`asked for ${lang}, payload is ${got}`)
  return parseHits(hits, lang, limit)
}

// Latest articles per language for the news feed. Each language fails on its
// own and is backfilled from the previous snapshot by scrape.mjs.
export async function scrapeArmenpress(limit = 16) {
  const out = {}
  for (const lang of ARMENPRESS_LANGS) {
    try {
      const articles = await scrapeLang(lang, limit)
      out[lang] = [{ categoryKey: ARMENPRESS_CATEGORY, articles }]
      console.log(`  ✓ armenpress/${lang} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ armenpress/${lang}: ${err.message}`)
      out[lang] = [{ categoryKey: ARMENPRESS_CATEGORY, articles: [] }]
    }
    // The site 403s aggressively. Three spaced requests, and no more.
    if (lang !== ARMENPRESS_LANGS[ARMENPRESS_LANGS.length - 1]) await sleep(1000)
  }
  return out
}
