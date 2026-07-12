import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean } from '../lib/util.mjs'

// Public Radio of Armenia (en.armradio.am) is a WordPress site behind
// Cloudflare, which serves a 403 "managed challenge" to datacenter IPs (e.g.
// GitHub Actions runners) on the browser-facing /feed/ path. We therefore try
// three sources, in order, and use the first that responds:
//
//   1. WordPress REST API (/wp-json) — clean JSON, and typically exempt from
//      the Cloudflare challenge that blocks /feed/, so it works from CI.
//   2. Direct RSS feed (/feed/) — richest, but often 403 from datacenters.
//   3. Google News RSS — always reachable, but lags and drops fresh items.
// `_embed` pulls the featured image (wp:featuredmedia) and category terms
// (wp:term) alongside each post, so a headline arrives picture-ready and
// category-tagged for the "À la une" carousel. `_fields` is dropped because it
// would strip the `_embedded` payload.
const REST_API = 'https://en.armradio.am/wp-json/wp/v2/posts?per_page=12&_embed=1'
const DIRECT_FEED = 'https://en.armradio.am/feed/'
const GNEWS_FEED =
  'https://news.google.com/rss/search?q=site:en.armradio.am%20when:7d&hl=en-US&gl=US&ceid=US:en'

// Optional always-on Cloudflare Worker proxy (see proxy/armradio-worker.js).
// When ARMRADIO_PROXY is set it is tried first — it sits on a Cloudflare IP the
// origin doesn't challenge, so it succeeds when a direct datacenter fetch 403s.
const PROXY = (process.env.ARMRADIO_PROXY || '').trim()

// Decode HTML entities (&#8217; &amp; …) that WordPress leaves in titles.
function decodeEntities(html) {
  return clean(cheerio.load(`<x>${html || ''}</x>`)('x').text())
}

// Featured image from an _embedded post. Prefer a mid-size rendition (lighter
// than the full original) and fall back to the source URL.
function embeddedImage(p) {
  const media = p._embedded?.['wp:featuredmedia']?.[0]
  if (!media) return null
  const sizes = media.media_details?.sizes || {}
  const pick = sizes.medium_large || sizes.large || sizes.medium
  return clean(pick?.source_url || media.source_url) || null
}

// Real topic for a post. WordPress tags most items into a generic "Top"
// (featured) or "Uncategorized" bucket that means nothing as a badge, so we
// prefer a genuine topic (Sport, Economics, Society…) and only fall back to the
// generic buckets returning null — a clean "ARMRADIO" badge beats "TOP".
const GENERIC_CATS = new Set(['uncategorized', 'top', 'featured', 'news'])
function embeddedCategory(p) {
  const groups = p._embedded?.['wp:term'] || []
  const cats = groups
    .flat()
    .filter((t) => t?.taxonomy === 'category')
    .map((t) => decodeEntities(t.name))
    .filter(Boolean)
  return cats.find((name) => !GENERIC_CATS.has(name.toLowerCase())) || null
}

// WordPress REST API → {title, url, date, image, category}. date_gmt has no
// zone suffix. image/category are null when the post carries neither.
function parseRest(json) {
  const posts = JSON.parse(json)
  if (!Array.isArray(posts)) throw new Error('REST API did not return a list')
  return posts
    .map((p) => {
      const title = decodeEntities(p.title?.rendered)
      const url = clean(p.link)
      const d = p.date_gmt ? new Date(`${p.date_gmt}Z`) : null
      if (!title || !url) return null
      return {
        title,
        url,
        date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
        image: embeddedImage(p),
        category: embeddedCategory(p),
      }
    })
    .filter(Boolean)
}

// Standard RSS <item> → {title, url, date}. Used for the direct WordPress feed.
function parseRss(xml) {
  const $ = cheerio.load(xml, { xmlMode: true })
  const items = []
  $('item').each((_, el) => {
    const item = $(el)
    const title = clean(item.find('title').first().text())
    const link = clean(item.find('link').first().text())
    const pubDate = clean(item.find('pubDate').first().text())
    if (!title || !link) return
    const d = pubDate ? new Date(pubDate) : null
    items.push({ title, url: link, date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null })
  })
  return items
}

// Google News RSS is the same shape but appends " - <source>" to every
// headline, so we strip that suffix.
function parseGoogleNews(xml) {
  const $ = cheerio.load(xml, { xmlMode: true })
  const items = []
  $('item').each((_, el) => {
    const item = $(el)
    let title = clean(item.find('title').first().text())
    const link = clean(item.find('link').first().text())
    const pubDate = clean(item.find('pubDate').first().text())
    const source = clean(item.find('source').first().text())
    if (source && title.endsWith(`- ${source}`)) {
      title = clean(title.slice(0, -(`- ${source}`.length)))
    }
    if (!title || !link) return
    const d = pubDate ? new Date(pubDate) : null
    items.push({ title, url: link, date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null })
  })
  return items
}

// The proxy returns either REST JSON or RSS XML — auto-detect and parse.
function parseProxy(body) {
  const t = (body || '').trimStart()
  return t.startsWith('[') || t.startsWith('{') ? parseRest(body) : parseRss(body)
}

const SOURCES = [
  ...(PROXY ? [{ via: 'proxy', url: PROXY, parse: parseProxy }] : []),
  { via: 'REST API', url: REST_API, parse: parseRest },
  { via: 'direct feed', url: DIRECT_FEED, parse: parseRss },
  { via: 'Google News', url: GNEWS_FEED, parse: parseGoogleNews },
]

export async function scrapeArmradio(limit = 5) {
  let items = []
  let via = null

  for (const src of SOURCES) {
    try {
      const parsed = src.parse(await fetchText(src.url))
      if (parsed.length) {
        items = parsed
        via = src.via
        break
      }
      throw new Error('no items')
    } catch (err) {
      console.warn(`  ↺ armradio via ${src.via} failed (${err.message})`)
    }
  }

  if (!via) throw new Error('all armradio sources failed')

  // Freshest first.
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const top = items.slice(0, limit)
  console.log(`  ✓ armradio (${top.length} headlines via ${via})`)
  return top
}

const BASE_BY_LANG = {
  en: 'https://en.armradio.am',
  hy: 'https://hy.armradio.am',
}

// The ArmRadio rubrics offered in the news feed, paired with their WordPress
// category slug (English site). `key` matches i18n 'armcats.*'.
export const ARMRADIO_SECTIONS = [
  { key: 'politics', slug: 'politics' },
  { key: 'society', slug: 'society' },
  { key: 'economics', slug: 'economics' },
  { key: 'analytics', slug: 'analytics' },
  { key: 'world', slug: 'world' },
  { key: 'culture', slug: 'culture' },
  { key: 'sport', slug: 'sport' },
]

// The Armenian site (hy.armradio.am) names its categories in Armenian, so the
// English slugs don't resolve there. These are its stable core WordPress term
// IDs, mapped to our keys by the rubric each represents (verified by name):
//   politics=Քաղաքական society=Հասարակություն economics=Տնտեսական
//   analytics=Վերլուծական world=Միջազգային culture=Մշակույթ sport=Սպորտ
const HY_CATEGORY_IDS = {
  politics: 12, society: 4, economics: 11, analytics: 9, world: 5, culture: 6, sport: 1,
}

// Resolve each rubric key → numeric category id for a given language site.
async function categoryIdsByKey(lang, base) {
  if (lang === 'hy') return { ...HY_CATEGORY_IDS }
  // English site: resolve slug→id from the categories endpoint.
  const wanted = new Set(ARMRADIO_SECTIONS.map((s) => s.slug))
  const idBySlug = {}
  try {
    const catsUrl = `${base}/wp-json/wp/v2/categories?per_page=100&_fields=id,slug`
    for (const c of JSON.parse(await fetchText(catsUrl))) {
      if (wanted.has(c.slug)) idBySlug[c.slug] = c.id
    }
  } catch (err) {
    console.warn(`  ↺ armradio/${lang} categories lookup failed (${err.message})`)
  }
  return Object.fromEntries(
    ARMRADIO_SECTIONS.map((s) => [s.key, idBySlug[s.slug]]).filter(([, id]) => id),
  )
}

// Per-category articles for the news feed, in `lang` (en | hy). The posts
// endpoint filters by numeric category id, so we resolve key→id first, then
// pull each rubric's latest `limit` posts picture-ready via _embed. Only the
// REST API can do this, so a blocked call yields empty rubrics that scrape.mjs
// backfills from the previous snapshot.
export async function scrapeArmradioSections(limit = 10, lang = 'en') {
  const base = BASE_BY_LANG[lang] || BASE_BY_LANG.en
  const idByKey = await categoryIdsByKey(lang, base)

  const out = []
  for (const section of ARMRADIO_SECTIONS) {
    const id = idByKey[section.key]
    if (!id) {
      out.push({ categoryKey: section.key, articles: [] })
      continue
    }
    try {
      const url = `${base}/wp-json/wp/v2/posts?categories=${id}&per_page=${limit}&_embed=1`
      const articles = parseRest(await fetchText(url))
      out.push({ categoryKey: section.key, articles })
      console.log(`  ✓ armradio/${lang}/${section.slug} (${articles.length})`)
    } catch (err) {
      console.warn(`  ✗ armradio/${lang}/${section.slug}: ${err.message}`)
      out.push({ categoryKey: section.key, articles: [] })
    }
  }
  return out
}
