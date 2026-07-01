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
const REST_API =
  'https://en.armradio.am/wp-json/wp/v2/posts?per_page=12&_fields=title,link,date_gmt'
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

// WordPress REST API → {title, url, date}. date_gmt has no zone suffix.
function parseRest(json) {
  const posts = JSON.parse(json)
  if (!Array.isArray(posts)) throw new Error('REST API did not return a list')
  return posts
    .map((p) => {
      const title = decodeEntities(p.title?.rendered)
      const url = clean(p.link)
      const d = p.date_gmt ? new Date(`${p.date_gmt}Z`) : null
      if (!title || !url) return null
      return { title, url, date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null }
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
