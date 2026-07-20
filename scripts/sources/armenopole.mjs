import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { absUrl, clean, isoFromMonthDay } from '../lib/util.mjs'

const BASE = 'https://armenopole.com'

// Countries used to build the "Monde" (world) feed — high-diaspora picks.
const WORLD_COUNTRIES = [
  'france', 'usa', 'germany', 'russia', 'lebanon',
  'canada', 'greece', 'italy', 'unitedkingdom', 'belgium',
  'netherlands',
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

  // The same event is cross-listed on several country pages, so dedupe by URL
  // as we go (keep the first hit) — otherwise "world" carries 2-3 copies of
  // every popular event. The UI groups the result by the country resolved from
  // each event's location (worldPlace.js), so the raw page slug needn't be
  // unique. Keep a generous cap (not 10) so several countries survive for the
  // selector while the payload stays bounded.
  const seen = new Set()
  const worldAll = []
  for (const c of WORLD_COUNTRIES) {
    for (const e of await scrapeCountry(c)) {
      const id = e.url || `${e.title}|${e.date}`
      if (seen.has(id)) continue
      seen.add(id)
      worldAll.push(e)
    }
  }
  const world = worldAll.filter(upcoming).sort(byDate).slice(0, 60)
  console.log(`  ✓ armenopole/world (${world.length} deduped from ${WORLD_COUNTRIES.length} countries)`)

  return { switzerland, world }
}
