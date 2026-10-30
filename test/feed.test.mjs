// Garde : le flux RSS par langue (scripts/lib/feed.mjs). Dérivé de
// sites.config.js, plafonné, et sans AUCUNE date prise à l'horloge — le XML
// doit être identique d'un build à l'autre tant que les données ne changent pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { feedFor, feedItems, FEED_MAX } from '../scripts/lib/feed.mjs'
import { SITES, feedUrl, feedPath, briefUrl, cultureUrl, urlFor } from '../sites.config.js'
import { SEO } from '../src/seo.js'

const brief = (i) => {
  const d = new Date(Date.UTC(2026, 8, 30) - i * 86400000)
  const date = d.toISOString().slice(0, 10)
  return { date, generatedAt: `${date}T09:00:00Z`, intro: `Intro ${date}`, topics: [] }
}
const briefs40 = { fr: Array.from({ length: 40 }, (_, i) => brief(i)) }
const culture2 = [
  { slug: 'duduk', date: '2026-10-20', langs: { fr: { title: 'Le duduk', description: 'D1' } } },
  { slug: 'komitas', date: '2026-10-25', langs: { fr: { title: 'Komitas', description: 'D2' }, en: { title: 'Komitas', description: 'E2' } } },
]

test('feedUrl : un flux par langue, sous la page de la langue', () => {
  assert.equal(feedUrl('fr'), 'https://armenieinfo.ch/feed.xml')
  assert.equal(feedUrl('de'), 'https://armenieinfo.ch/de/feed.xml')
  assert.equal(feedUrl('en'), 'https://armenianews.org/feed.xml')
  assert.equal(feedUrl('hy'), 'https://armenianews.org/hy/feed.xml')
  assert.equal(feedPath('ru'), '/ru/feed.xml')
})

test("feedItems mêle brèves et Culture, plus récent d'abord, plafonné à FEED_MAX", () => {
  const items = feedItems('fr', { briefs: briefs40, culture: culture2 })
  assert.equal(FEED_MAX, 30)
  assert.equal(items.length, 30)
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].pubDate >= items[i].pubDate)
  const b = items.find((i) => i.url === briefUrl('fr', '2026-09-30'))
  assert.ok(b)
  assert.equal(b.description, 'Intro 2026-09-30')
  assert.equal(b.pubDate.toISOString(), '2026-09-30T09:00:00.000Z')
  const a = items.find((i) => i.url === cultureUrl('fr', 'komitas'))
  assert.ok(a)
  assert.equal(a.pubDate.toISOString(), '2026-10-25T00:00:00.000Z')
})

test('feedItems ignore un article absent dans la langue', () => {
  const items = feedItems('de', { briefs: {}, culture: culture2 })
  assert.equal(items.length, 0)
})

test('feed échappe & < > " \'', () => {
  const culture = [{ slug: 'x', date: '2026-10-20', langs: { fr: { title: 'Arménie & « diaspora » <b> "q" \'s\'', description: 'd' } } }]
  const xml = feedFor('fr', { briefs: {}, culture })
  assert.ok(xml.includes('&amp;'))
  assert.ok(xml.includes('&lt;b&gt;'))
  assert.ok(!xml.includes('<b>'))
})

test('flux vide valide', () => {
  const xml = feedFor('fr', { briefs: {}, culture: [] })
  assert.ok(xml.includes('<channel>') && xml.includes('</rss>'))
  assert.equal((xml.match(/<item>/g) || []).length, 0)
  assert.ok(!xml.includes('<lastBuildDate>'))
})

test('lastBuildDate = élément le plus récent', () => {
  const items = feedItems('fr', { briefs: briefs40, culture: culture2 })
  const xml = feedFor('fr', { briefs: briefs40, culture: culture2 })
  assert.ok(xml.includes(`<lastBuildDate>${items[0].pubDate.toUTCString()}</lastBuildDate>`))
})

test('en-tête du canal', () => {
  const xml = feedFor('fr', { briefs: {}, culture: [] })
  assert.ok(xml.includes('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">'))
  assert.ok(xml.includes('<language>fr</language>'))
  assert.ok(xml.includes(`<atom:link href="${feedUrl('fr')}" rel="self" type="application/rss+xml"/>`))
  assert.ok(xml.includes(`<link>${urlFor('fr', 'home')}</link>`))
  assert.ok(xml.includes(`<title>${SITES.ch.brand} — ${SEO.fr.tagline}</title>`))
})

test('chaque item : guid permalien = link', () => {
  const xml = feedFor('fr', { briefs: briefs40, culture: culture2 })
  const items = xml.split('<item>').slice(1)
  assert.ok(items.length > 0)
  for (const it of items) {
    const link = it.match(/<link>([^<]+)<\/link>/)[1]
    assert.ok(it.includes(`<guid isPermaLink="true">${link}</guid>`))
  }
})
