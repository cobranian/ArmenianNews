import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { absUrl, clean, isoFromMonthDay } from '../lib/util.mjs'

const BASE = 'https://armenopole.com'

// Countries used to build the "Monde" (world) feed — high-diaspora picks.
const WORLD_COUNTRIES = [
  'france', 'usa', 'germany', 'russia', 'lebanon',
  'canada', 'greece', 'italy', 'unitedkingdom', 'belgium',
]

function parseEventsPage(html) {
  const $ = cheerio.load(html)

  // The three field-groups each appear once per event in document order;
  // zip them by index. (date-time-box lives in .event-details, while the
  // title + location live in a sibling .event-info — so we can't scope to one.)
  const titles = $('.event-title-container a').toArray()
  const locations = $('.location-container').toArray()
  const boxes = $('.date-time-box').toArray()

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

  const worldAll = []
  for (const c of WORLD_COUNTRIES) {
    const list = await scrapeCountry(c)
    worldAll.push(...list)
  }
  const world = worldAll.filter(upcoming).sort(byDate).slice(0, 10)
  console.log(`  ✓ armenopole/world (${world.length} from ${WORLD_COUNTRIES.length} countries)`)

  return { switzerland, world }
}
