import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { clean } from '../lib/util.mjs'

const FEED = 'https://en.armradio.am/feed/'

export async function scrapeArmradio(limit = 5) {
  const xml = await fetchText(FEED)
  const $ = cheerio.load(xml, { xmlMode: true })
  const items = []
  $('item').slice(0, limit).each((_, el) => {
    const item = $(el)
    const title = clean(item.find('title').first().text())
    const link = clean(item.find('link').first().text())
    const pubDate = clean(item.find('pubDate').first().text())
    if (!title || !link) return
    items.push({
      title,
      url: link,
      date: pubDate ? new Date(pubDate).toISOString() : null,
    })
  })
  console.log(`  ✓ armradio (${items.length} headlines)`)
  return items
}
