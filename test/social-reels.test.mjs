// Invariant : un Reel (Short Culture en musique) part AU PLUS UNE FOIS PAR
// JOUR ET PAR COMPTE (jour d'Erevan), seulement sur Facebook et Instagram, et
// n'est JAMAIS amorcé — un canal neuf doit pouvoir publier les Reels déjà
// tournés, un par jour, au lieu de les perdre dans l'archive.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNELS, parseKinds, plan, settle, supports, reelItems, cultureItems, yerevanDay, REEL_BASE } from '../scripts/lib/social.mjs'

const fb = CHANNELS.find((c) => c.id === 'facebook-ch')
const bare = { version: 1, channels: { 'facebook-ch': { seededAt: 'x', posted: {} } } }
const article = (slug, date = '2026-10-20') => ({
  slug,
  date,
  image: { width: 1200, height: 868, author: 'A', license: 'CC BY-SA 4.0' },
  langs: { fr: { title: `T ${slug}`, description: `D ${slug}` } },
})
const reel = (slug, date = '2026-10-20') => ({
  id: `reel:${slug}`,
  kind: 'reel',
  lang: 'fr',
  date,
  url: `https://armenieinfo.ch/culture/${slug}/`,
  title: `T ${slug}`,
  description: `D ${slug}`,
  image: null,
  video: { url: REEL_BASE + `fr-${slug}.mp4`, music: '♪ x' },
})
const reelsOf = (r) => r.posts.filter((p) => p.item.kind === 'reel')

test('(a) SOCIAL_KINDS accepte reel', () => {
  assert.deepEqual(parseKinds('culture,reel'), ['culture', 'reel'])
})

test('(b) reelItems : couple article × manifeste, champs de cultureItems', () => {
  const a = article('duduk')
  const [r] = reelItems([a], { duduk: { fr: { asset: 'fr-duduk.mp4', music: '♪ x' } } })
  const [c] = cultureItems([a])
  assert.equal(r.id, 'reel:duduk')
  assert.equal(r.kind, 'reel')
  assert.equal(r.video.url, REEL_BASE + 'fr-duduk.mp4')
  assert.equal(r.video.music, '♪ x')
  for (const k of ['lang', 'date', 'url', 'title', 'description', 'image']) assert.deepEqual(r[k], c[k])
  assert.deepEqual(reelItems([], { duduk: { fr: { asset: 'fr-duduk.mp4', music: '♪ x' } } }), [])
  // Une langue absente du manifeste ne donne rien.
  assert.deepEqual(reelItems([a], { duduk: { en: { asset: 'en-duduk.mp4', music: '♪ x' } } }), [])
})

test('(c) un Reel ne va que sur Facebook et Instagram, sans contrôle d’image', () => {
  assert.equal(supports('bluesky', reel('a')), false)
  assert.equal(supports('telegram', reel('a')), false)
  assert.equal(supports('facebook', reel('a')), true)
  assert.equal(supports('instagram', reel('a')), true)
})

test('(d) l’amorçage n’inscrit aucun reel', () => {
  const items = [...cultureItems([article('komitas')]), reel('duduk')]
  const r = plan({ items, channels: [fb], ledger: null, kinds: ['culture', 'reel'], now: new Date('2026-11-07T08:00:00Z') })
  const ids = Object.keys(r.ledger.channels['facebook-ch'].posted)
  assert.deepEqual(ids, ['culture:komitas'])
})

test('(e) un reel par jour d’Erevan et par compte', () => {
  const items = [reel('a', '2026-10-01'), reel('b', '2026-10-02'), reel('c', '2026-10-03')]
  const now = new Date('2026-11-07T08:00:00Z')
  const r1 = plan({ items, channels: [fb], ledger: bare, kinds: ['reel'], now })
  assert.deepEqual(r1.posts.map((p) => p.item.id), ['reel:a'])
  const r2 = plan({ items, channels: [fb], ledger: r1.ledger, kinds: ['reel'], now: new Date(now.getTime() + 3_600_000) })
  assert.equal(reelsOf(r2).length, 0)
  // 19:59Z = 23:59 à Erevan ; 20:00Z = minuit, un autre jour.
  const ledger = structuredClone(bare)
  ledger.channels['facebook-ch'].posted['reel:a'] = '2026-11-07T19:59:00Z'
  const r3 = plan({ items, channels: [fb], ledger, kinds: ['reel'], now: new Date('2026-11-07T20:00:00Z') })
  assert.deepEqual(r3.posts.map((p) => p.item.id), ['reel:b'])
  assert.equal(yerevanDay('2026-11-07T19:59:00Z'), '2026-11-07')
  assert.equal(yerevanDay('2026-11-07T20:00:00Z'), '2026-11-08')
})

test('(e bis) le reel ne prend pas la place d’un article Culture', () => {
  const items = [reel('a', '2026-10-01'), reel('b', '2026-10-02'), ...cultureItems([article('komitas', '2026-10-03')])]
  const r = plan({ items, channels: [fb], ledger: bare, kinds: ['culture', 'reel'], now: new Date('2026-11-07T08:00:00Z') })
  assert.deepEqual(r.posts.map((p) => p.item.id), ['reel:a', 'culture:komitas'])
})

test('(e ter) seed et abandon ne comptent pas pour le jour', () => {
  const ledger = structuredClone(bare)
  ledger.channels['facebook-ch'].posted['reel:x'] = 'seed'
  ledger.channels['facebook-ch'].posted['reel:y'] = 'abandonné 2026-11-07T07:00:00Z'
  const r = plan({ items: [reel('a')], channels: [fb], ledger, kinds: ['reel'], now: new Date('2026-11-07T08:00:00Z') })
  assert.deepEqual(r.posts.map((p) => p.item.id), ['reel:a'])
})

test('(f) un reel incertain compte pour la journée', () => {
  const items = [reel('a', '2026-10-01'), reel('b', '2026-10-02')]
  const r1 = plan({ items, channels: [fb], ledger: bare, kinds: ['reel'], now: new Date('2026-11-07T08:00:00Z') })
  const settled = settle(r1.ledger, [{ channel: 'facebook-ch', id: 'reel:a', ok: false, uncertain: true, error: 'délai' }], new Date('2026-11-07T08:05:00Z'), r1.posts)
  const r2 = plan({ items, channels: [fb], ledger: settled, kinds: ['reel'], now: new Date('2026-11-07T09:00:00Z') })
  assert.equal(reelsOf(r2).length, 0)
})

test('(g) un échec sûr est replanifié le même jour', () => {
  const items = [reel('a', '2026-10-01'), reel('b', '2026-10-02')]
  const r1 = plan({ items, channels: [fb], ledger: bare, kinds: ['reel'], now: new Date('2026-11-07T08:00:00Z') })
  const settled = settle(r1.ledger, [{ channel: 'facebook-ch', id: 'reel:a', ok: false, error: '400' }], new Date('2026-11-07T08:05:00Z'), r1.posts)
  const r2 = plan({ items, channels: [fb], ledger: settled, kinds: ['reel'], now: new Date('2026-11-07T09:00:00Z') })
  assert.deepEqual(r2.posts.map((p) => p.item.id), ['reel:a'])
})
