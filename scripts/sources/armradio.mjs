import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean } from '../lib/util.mjs'

// en.armradio.am sits behind Cloudflare, which serves a 403 "managed
// challenge" to datacenter IPs — so the direct /feed/ is unreachable from CI
// (GitHub Actions). Google News has already indexed the same articles and is
// reachable from anywhere, so we pull armradio's headlines through its Google
// News feed instead. `when:7d` keeps results recent (plain relevance ranking
// lags ~a week); links are Google redirect URLs that resolve to the original
// armradio article in the browser.
const FEED =
  'https://news.google.com/rss/search?q=site:en.armradio.am%20when:7d&hl=en-US&gl=US&ceid=US:en'

export async function scrapeArmradio(limit = 5) {
  const xml = await fetchText(FEED)
  const $ = cheerio.load(xml, { xmlMode: true })

  const items = []
  $('item').each((_, el) => {
    const item = $(el)
    let title = clean(item.find('title').first().text())
    const link = clean(item.find('link').first().text())
    const pubDate = clean(item.find('pubDate').first().text())
    const source = clean(item.find('source').first().text())
    // Google appends " - <source>" to every headline; drop it.
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

  // Google orders by relevance; we want the freshest headlines.
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const top = items.slice(0, limit)
  console.log(`  ✓ armradio (${top.length} headlines via Google News)`)
  return top
}
