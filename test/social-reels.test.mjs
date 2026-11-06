// Invariant : un Reel (Short Culture en musique) part AU PLUS UNE FOIS PAR
// JOUR ET PAR COMPTE (jour d'Erevan), seulement sur Facebook et Instagram, et
// n'est JAMAIS amorcé — un canal neuf doit pouvoir publier les Reels déjà
// tournés, un par jour, au lieu de les perdre dans l'archive.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNELS, parseKinds, plan, settle, supports, reelItems, cultureItems, yerevanDay, REEL_BASE, compose, tagged } from '../scripts/lib/social.mjs'

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

const reelCredit = { ...reel('duduk'), image: { url: 'https://armenieinfo.ch/i.jpg', author: 'Auteur', license: 'CC BY' } }

test('(h) légende FB d’un reel : lien utm_medium=reel, crédit, musique', () => {
  const c = compose('facebook', reelCredit)
  assert.equal(c.videoUrl, reelCredit.video.url)
  assert.ok(c.description.startsWith('T duduk\n\nD duduk\n\nhttps://'))
  assert.ok(c.description.includes('utm_medium=reel'))
  assert.ok(c.description.includes('utm_source=facebook'))
  assert.ok(c.description.includes('Auteur, CC BY'))
  assert.ok(c.description.endsWith('♪ x'))
})

test('(i) légende IG d’un reel : lien dans la bio, musique avant les hashtags', () => {
  const c = compose('instagram', reelCredit)
  assert.equal(c.videoUrl, reelCredit.video.url)
  assert.equal(c.imageUrl, undefined)
  assert.ok(c.caption.includes('lien dans la bio'))
  assert.ok(c.caption.includes('#Arménie'))
  assert.ok(c.caption.indexOf('♪ x') > -1 && c.caption.indexOf('♪ x') < c.caption.indexOf('#'))
  assert.ok(!c.caption.includes('utm_'))
})

test('(j) légende IG d’un reel hy', () => {
  const c = compose('instagram', { ...reelCredit, lang: 'hy', url: 'https://armenianews.org/hy/culture/duduk/' })
  assert.ok(c.caption.includes('Ամբողջական հոդվածը՝'))
})

test('(k) tagged garde utm_medium=social par défaut', () => {
  assert.ok(tagged('https://a.ch/x/', 'telegram').includes('utm_medium=social'))
  assert.ok(tagged('https://a.ch/x/', 'facebook', 'reel').includes('utm_medium=reel'))
})

// markPosted : un Reel envoyé par `social-post.mjs test` est hors registre ;
// `mark` l'y inscrit, sinon le robot le republierait quelques jours plus tard.
import { markPosted } from '../scripts/lib/social.mjs'

test('markPosted : inscrit l’horodatage, le robot ne rejoue ni ce jour ni jamais ce Reel', () => {
  const now = new Date('2026-11-06T10:00:00Z')
  const marked = markPosted(bare, 'facebook-ch', 'reel:duduk', now.toISOString())
  assert.equal(marked.channels['facebook-ch'].posted['reel:duduk'], now.toISOString())
  assert.deepEqual(bare.channels['facebook-ch'].posted, {}, 'entrée non mutée')
  const items = [reel('duduk'), reel('komitas')]
  const kinds = ['reel']
  const today = plan({ items, channels: [fb], ledger: marked, kinds, now })
  assert.equal(reelsOf(today).length, 0, 'jour bloqué')
  const later = plan({ items: [reel('duduk')], channels: [fb], ledger: marked, kinds, now: new Date('2026-11-12T10:00:00Z') })
  assert.equal(reelsOf(later).length, 0, 'jamais rejoué')
})

test('markPosted : refus (canal inconnu, sans registre, horodatage existant) ; seed/abandonné écrasables', () => {
  const at = '2026-11-06T10:00:00.000Z'
  assert.throws(() => markPosted(bare, 'nope', 'reel:x', at), /canal inconnu/)
  assert.throws(() => markPosted({ version: 1, channels: {} }, 'facebook-ch', 'reel:x', at), /registre/)
  const done = markPosted(bare, 'facebook-ch', 'reel:x', at)
  assert.throws(() => markPosted(done, 'facebook-ch', 'reel:x', at), /déjà/)
  for (const v of ['seed', 'abandonné 2026-11-01T00:00:00.000Z']) {
    const l = { version: 1, channels: { 'facebook-ch': { seededAt: 'x', posted: { 'reel:x': v } } } }
    assert.equal(markPosted(l, 'facebook-ch', 'reel:x', at).channels['facebook-ch'].posted['reel:x'], at)
  }
})
