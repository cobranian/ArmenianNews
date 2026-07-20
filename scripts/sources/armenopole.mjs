import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { absUrl, clean, isoFromMonthDay } from '../lib/util.mjs'

const BASE = 'https://armenopole.com'

// Every country armenopole exposes in its own events nav (Switzerland is
// scraped separately, above). This is the site's real list — earlier we also
// hit `greece` and `belgium`, but those slugs aren't real country pages: they
// return an identical generic feed (Erevan/Angleterre/Chypre mixed), which is
// exactly what made the page slug unreliable. The UI groups by the country
// resolved from each event's location and only shows countries that actually
// have upcoming events, so listing them all here is safe — empty ones just
// don't appear in the selector.
const WORLD_COUNTRIES = [
  'argentina', 'armenia', 'australia', 'brazil', 'bulgaria',
  'canada', 'cyprus', 'egypt', 'france', 'germany',
  'iraq', 'israel', 'italy', 'jordan', 'lebanon',
  'netherlands', 'poland', 'qatar', 'russia', 'singapore',
  'syria', 'turkey', 'uae', 'unitedkingdom', 'uruguay', 'usa',
]

function parseEventsPage(html) {
  const $ = cheerio.load(html)

  // The three field-groups each appear once per event in document order;
  // zip them by index. (date-time-box lives in .event-details, while the
  // title + location live in a sibling .event-info — so we can't scope to one.)
  const titles = $('.event-title-container a').toArray()
  const locations = $('.location-container').toArray()
  const boxes = $('.date-time-box').toArray()

  // Each event's featured image sits in a separate image link (main list uses
  // .image-container a, the top carousel uses .carousel-image-link) whose href
  // matches the title link's href — so map by href rather than by index, which
  // survives events that have no image.
  const imgByHref = {}
  $('.image-container a, .carousel-image-link').each((_, a) => {
    const href = $(a).attr('href')
    const src = $(a).find('img').first().attr('src')
    if (href && src && !imgByHref[href]) imgByHref[href] = absUrl(src, BASE)
  })

  const events = []
  for (let i = 0; i < titles.length; i++) {
    const link = $(titles[i])
    const title = clean(link.find('h2').first().text() || link.text())
    if (!title) continue
    const href = link.attr('href')

    const box = boxes[i] ? $(boxes[i]) : null
    const month = box ? clean(box.find('.monthshortname').text()) : ''
    const day = box ? clean(box.find('.daynumber').text()) : ''
    const time = box ? clean(box.find('.daytime').text()) : ''

    events.push({
      title,
      url: href ? absUrl(href, BASE) : null,
      location: locations[i] ? clean($(locations[i]).text()) : '',
      date: isoFromMonthDay(month, day, time || '00:00'),
      rawDate: clean([month, day, time].filter(Boolean).join(' ')),
      image: href && imgByHref[href] ? imgByHref[href] : null,
    })
  }
  return events
}

async function scrapeCountry(country) {
  try {
    const html = await fetchText(`${BASE}/armenian/events/${country}`)
    return parseEventsPage(html).map((e) => ({ ...e, country }))
  } catch (err) {
    console.warn(`  ✗ armenopole/${country}: ${err.message}`)
    return []
  }
}

const upcoming = (e) => !e.date || new Date(e.date).getTime() > Date.now() - 86400000
const byDate = (a, b) => new Date(a.date || 0) - new Date(b.date || 0)

export async function scrapeAgenda() {
  const switzerland = (await scrapeCountry('switzerland'))
    .filter(upcoming)
    .sort(byDate)
  console.log(`  ✓ armenopole/switzerland (${switzerland.length})`)

  // Scrape every country, cap each one so no single country floods the payload,
  // then dedupe by URL across countries (the same event is cross-listed on
  // several pages). The UI groups by the country resolved from each event's
  // location (worldPlace.js), so the raw page slug needn't be unique.
  const seen = new Set()
  const world = []
  let withEvents = 0
  for (const c of WORLD_COUNTRIES) {
    const list = (await scrapeCountry(c)).filter(upcoming).sort(byDate).slice(0, 20)
    if (list.length) withEvents++
    for (const e of list) {
      const id = e.url || `${e.title}|${e.date}`
      if (seen.has(id)) continue
      seen.add(id)
      world.push(e)
    }
  }
  world.sort(byDate)
  console.log(
    `  ✓ armenopole/world (${world.length} events, ${withEvents}/${WORLD_COUNTRIES.length} countries with upcoming)`,
  )

  return { switzerland, world }
}
