import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean } from '../lib/util.mjs'

// Public Radio of Armenia (en.armradio.am) publishes a standard WordPress RSS
// feed. We pull it directly — it carries the full, freshest set of Armenia
// headlines with real permalinks.
const DIRECT_FEED = 'https://en.armradio.am/feed/'

// en.armradio.am sits behind Cloudflare, which *may* serve a 403 "managed
// challenge" to datacenter IPs (e.g. GitHub Actions runners). When the direct
// feed is unreachable we fall back to Google News, which has already indexed
// the same articles and is reachable from anywhere. `when:7d` keeps results
// recent; links are Google redirect URLs that resolve to the original article.
const GNEWS_FEED =
  'https://news.google.com/rss/search?q=site:en.armradio.am%20when:7d&hl=en-US&gl=US&ceid=US:en'

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
    items.push({
      title,
      url: link,
      date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
    })
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
    items.push({
      title,
      url: link,
      date: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
    })
  })
  return items
}

export async function scrapeArmradio(limit = 5) {
  let items = []
  let via = 'direct feed'

  // Prefer the direct feed; fall back to Google News if it's blocked/empty.
  try {
    items = parseRss(await fetchText(DIRECT_FEED))
    if (!items.length) throw new Error('direct feed returned no items')
  } catch (err) {
    console.warn(`  ↺ direct feed unavailable (${err.message}); trying Google News`)
    items = parseGoogleNews(await fetchText(GNEWS_FEED))
    via = 'Google News'
  }

  // Freshest first (both feeds order roughly, but be explicit).
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const top = items.slice(0, limit)
  console.log(`  ✓ armradio (${top.length} headlines via ${via})`)
  return top
}
