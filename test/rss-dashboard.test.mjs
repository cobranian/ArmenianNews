// Les flux RSS au tableau de bord (feedState / checkFeeds,
// scripts/lib/publication-check.mjs) : en ligne, XML complet, et frais — un
// flux figé ne fait échouer aucun build. Sans réseau.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { feedState, checkFeeds, FEED_STALE_HOURS } from '../scripts/lib/publication-check.mjs'

const now = new Date('2026-11-05T14:17:00Z')
const rss = (date) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><item><title>a</title><pubDate>${date}</pubDate></item></channel></rss>\n`
const fresh = rss('Thu, 05 Nov 2026 04:00:00 GMT')
const stale = rss('Mon, 02 Nov 2026 04:00:00 GMT')

test('un flux en ligne et frais est sain', () => {
  const s = feedState({ status: 200, body: fresh }, now)
  assert.equal(s.ok, true)
  assert.equal(s.items, 1)
})

test('figé, tronqué, vide ou injoignable : malade, avec la raison', () => {
  assert.match(feedState({ status: 200, body: stale }, now).why, /il y a 82 h/)
  assert.equal(feedState({ status: 200, body: stale }, now).ok, false)
  assert.match(feedState({ status: 200, body: fresh.slice(0, 60) }, now).why, /XML incomplet/)
  assert.match(feedState({ status: 200, body: '<rss><channel></channel></rss>' }, now).why, /aucun élément/)
  assert.match(feedState({ status: 404, body: '' }, now).why, /HTTP 404/)
  assert.match(feedState({ status: 0, body: '' }, now).why, /injoignable/)
})

test('le seuil de fraîcheur laisse passer une journée sans brève', () => {
  assert.ok(FEED_STALE_HOURS >= 36)
})

test('tout va bien : une seule ligne ok ; un flux malade : une action', () => {
  const ok = checkFeeds([{ lang: 'fr', url: 'u', status: 200, body: fresh }], now)
  assert.deepEqual(ok.map((r) => r.level), ['ok'])
  const bad = checkFeeds(
    [
      { lang: 'fr', url: 'u', status: 200, body: fresh },
      { lang: 'hy', url: 'u', status: 200, body: stale },
    ],
    now,
  )
  assert.match(bad[0].text, /^1\/2 flux RSS/)
  const hy = bad.find((r) => r.key === 'rss-hy')
  assert.equal(hy.level, 'faire')
  assert.match(hy.action, /brève/)
})

test('le tableau de bord a sa section Flux RSS', async () => {
  const src = await readFile(new URL('../scripts/publication-check.mjs', import.meta.url), 'utf8')
  assert.match(src, /guarded\('📡 Flux RSS', feeds\)/)
})
