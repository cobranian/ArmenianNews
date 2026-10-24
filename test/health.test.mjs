// L'alerte de santé du job horaire (scripts/lib/health.mjs) : une source figée,
// une brève absente ou un agenda vide ouvrent une issue. Sans réseau.
import test from 'node:test'
import assert from 'node:assert/strict'
import { STALE_HOURS, staleHours, checkNews, checkBriefs, checkAgenda, healthReport } from '../scripts/lib/health.mjs'
import { ALL_LANGS } from '../sites.config.js'

const NOW = new Date('2026-10-24T12:00:00Z') // 16 h à Erevan
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600e3).toISOString()
const art = (h) => ({ title: 't', url: `https://x/${h}`, date: hoursAgo(h) })

test('checkNews : une source fraîche ne dit rien', () => {
  const news = { generatedAt: NOW.toISOString(), newsam: { en: [{ articles: [art(2)] }] } }
  assert.deepEqual(checkNews(news, NOW), [])
})

test('checkNews : une source figée au-delà de son seuil est signalée, avec son âge', () => {
  const news = { generatedAt: NOW.toISOString(), newsam: { en: [{ articles: [art(200), art(300)] }] } }
  const p = checkNews(news, NOW)
  assert.equal(p.length, 1)
  assert.match(p[0], /newsam\/en/)
  assert.match(p[0], /8 j/) // 200 h
})

test('checkNews : une source à liste plate (sans langue) est lue aussi', () => {
  const news = { generatedAt: NOW.toISOString(), courrier: [{ sectionKey: 'a', articles: [art(500)] }] }
  assert.match(checkNews(news, NOW)[0], /courrier/)
})

test('checkNews : une source vide est signalée', () => {
  const news = { generatedAt: NOW.toISOString(), civilnet: { fr: [] } }
  assert.match(checkNews(news, NOW)[0], /civilnet\/fr.*aucun article daté/)
})

test('checkNews : une source qui publie par numéros (Artzakank) n’est jamais signalée', () => {
  assert.equal(staleHours('artzakank', '-'), null)
  const news = { generatedAt: NOW.toISOString(), artzakank: [{ articles: [art(2000)] }] }
  assert.deepEqual(checkNews(news, NOW), [])
})

test('checkNews : les hebdomadaires ont un seuil plus long que les agences', () => {
  assert.ok(staleHours('californiacourier', 'fr') > staleHours('newsam', 'en'))
  const news = { generatedAt: NOW.toISOString(), californiacourier: { fr: [{ articles: [art(200)] }] } }
  assert.deepEqual(checkNews(news, NOW), [])
})

test('STALE_HOURS : chaque seuil est un nombre d’heures positif ou null', () => {
  for (const [k, v] of Object.entries(STALE_HOURS)) assert.ok(v === null || (Number.isFinite(v) && v > 0), k)
})

test('checkBriefs : avant midi à Erevan, une brève absente n’est pas encore une panne', () => {
  const morning = new Date('2026-10-24T06:00:00Z') // 10 h à Erevan
  assert.deepEqual(checkBriefs({}, morning), [])
})

test('checkBriefs : après midi à Erevan, chaque langue sans brève du jour est signalée', () => {
  const dates = Object.fromEntries(ALL_LANGS.map((l) => [l, ['2026-10-24']]))
  dates.hy = ['2026-10-23']
  const p = checkBriefs(dates, NOW)
  assert.equal(p.length, 1)
  assert.match(p[0], /hy.*2026-10-24/)
})

test('checkAgenda : un agenda sans événement à venir est signalé', () => {
  assert.equal(checkAgenda({ switzerland: [], world: [] }, NOW).length, 1)
  const ev = { title: 'e', url: 'https://a/1', date: '2026-11-01T19:00' }
  assert.deepEqual(checkAgenda({ switzerland: [ev], world: [] }, NOW), [])
})

test('healthReport : un rapport sain n’a aucun problème', () => {
  const r = healthReport({ problems: [] })
  assert.equal(r.ok, true)
})

test('healthReport : le rapport en panne liste chaque problème en Markdown', () => {
  const r = healthReport({ problems: ['a', 'b'] })
  assert.equal(r.ok, false)
  assert.match(r.markdown, /- a\n- b/)
})
