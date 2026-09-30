import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { absUrl, clean, isoFromMonthDay } from '../lib/util.mjs'

const BASE = 'https://armenopole.com'

// Every country armenopole exposes in its own events nav (Switzerland is
// scraped separately, above). Only slugs that are REAL country pages belong
// here: an unknown slug 302-redirects to the generic `/armenian/events` feed
// (Paris, California, Zürich, Ethiopia… mixed), and its events would be
// tagged with that slug. Since the UI falls back to the slug for any region it
// can't map (Île-de-France, Ontario…), and the URL dedupe below keeps the
// FIRST page that lists an event, one fake slug early in the list swallowed
// events from half the world. Measured 30 Sept 2026: `brazil` showed 20
// events, none in Brazil. The same held for `greece` and `belgium` before, and
// on that date for brazil, egypt, iraq, israel, jordan, qatar, syria and
// turkey — hence `redirect: 'manual'` in scrapeCountry, which turns the next
// slug to go generic into a logged ✗ instead of a mislabelled country.
const WORLD_COUNTRIES = [
  'argentina', 'armenia', 'australia', 'bulgaria', 'canada',
  'cyprus', 'france', 'germany', 'italy', 'lebanon',
  'netherlands', 'poland', 'russia', 'singapore', 'uae',
  'unitedkingdom', 'uruguay', 'usa',
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
    // `manual`: a redirect means the slug is not a country page (see above).
    const html = await fetchText(`${BASE}/armenian/events/${country}`, { redirect: 'manual' })
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
