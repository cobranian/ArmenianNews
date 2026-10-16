import { test } from 'node:test'
import assert from 'node:assert/strict'
import { yerevanClock, isBriefDue, selectArticles, MAX_ARTICLES } from '../scripts/lib/brief-select.mjs'

test('yerevanClock : UTC+4, sans heure d’été', () => {
  assert.deepEqual(yerevanClock(new Date('2026-10-16T02:59:00Z')), { date: '2026-10-16', hour: 6 })
  assert.deepEqual(yerevanClock(new Date('2026-10-16T03:00:00Z')), { date: '2026-10-16', hour: 7 })
  // Un scrape du soir UTC est déjà le lendemain à Erevan.
  assert.deepEqual(yerevanClock(new Date('2026-10-15T20:30:00Z')), { date: '2026-10-16', hour: 0 })
  assert.deepEqual(yerevanClock(new Date('2026-07-01T19:59:00Z')), { date: '2026-07-01', hour: 23 })
})

test('isBriefDue : 7 h à Erevan et fichier absent', () => {
  assert.equal(isBriefDue(new Date('2026-10-16T02:59:00Z'), false), false)
  assert.equal(isBriefDue(new Date('2026-10-16T03:00:00Z'), false), true)
  assert.equal(isBriefDue(new Date('2026-10-16T03:00:00Z'), true), false)
  assert.equal(isBriefDue(new Date('2026-10-15T20:30:00Z'), false), false)
})

const NOW = new Date('2026-10-16T05:00:00Z')
const art = (title, url, hoursAgo) => ({
  title,
  url,
  date: hoursAgo == null ? null : new Date(NOW - hoursAgo * 3600e3).toISOString(),
})

const news = {
  armenpress: {
    fr: [{ categoryKey: 'economy', articles: [art('Eco 1', 'u1', 1), art('Vieux', 'u2', 30)] }],
    en: [{ categoryKey: 'armenia', articles: [art('EN only', 'e1', 1)] }],
  },
  courrier: [
    {
      sectionKey: 'actualite',
      articles: [
        art('  Mixte  classé ', 'c1', 2),
        art('Sans date', 'c2', null),
        art('Doublon', 'u1', 3),
        { title: '', url: 'c3', date: NOW.toISOString() },
      ],
    },
  ],
  // newsam n'est pas dans TAB_ORDER.fr : jamais sélectionné sous fr.
  newsam: { en: [{ categoryKey: 'politics', articles: [art('NEWS.am', 'n1', 1)] }] },
}
news.courrier[0].articles[0].rubric = 'politique'

test('selectArticles : langue, fenêtre, dédoublonnage, tri, ids', () => {
  const got = selectArticles(news, 'fr', NOW)
  assert.deepEqual(
    got.map((a) => [a.id, a.title, a.source, a.rubric, a.url]),
    [
      [1, 'Eco 1', 'armenpress', 'economie', 'u1'],
      [2, 'Mixte classé', 'courrier', 'politique', 'c1'],
    ],
  )
  assert.ok(got.every((a) => typeof a.date === 'string'))
})

test('selectArticles : plafond, plus récents d’abord', () => {
  const many = Array.from({ length: MAX_ARTICLES + 20 }, (_, i) => art(`T${i}`, `m${i}`, i / 10))
  const big = { courrier: [{ sectionKey: 'societe', articles: many }] }
  const got = selectArticles(big, 'fr', NOW)
  assert.equal(got.length, MAX_ARTICLES)
  assert.equal(got[0].url, 'm0')
  assert.equal(got.at(-1).id, MAX_ARTICLES)
})

test('selectArticles : langue sans source → []', () => {
  assert.deepEqual(selectArticles({}, 'ru', NOW), [])
})
