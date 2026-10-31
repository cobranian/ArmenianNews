import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseFeed, isArmenianText, fullImage } from '../scripts/sources/norsevan.mjs'
import { RUBRIC_MAP } from '../src/rubrics.js'
import { SOURCE_NAMES, TAB_ORDER } from '../src/newsLangs.js'

// Invariants : le flux RSS réel de norsevan.com (31 octobre 2026) ; un billet
// en écriture arménienne va sous `hy` et JAMAIS sous `es` ; les images sont
// l'original Wix (le segment /v1/fit/… livre un PNG de ~540 Ko) ; chaque
// étagère produite est déclarée dans RUBRIC_MAP.norsevan. La fixture porte un
// billet arménien réel (yeraghdabard-enk, 23 sept. 2025) ajouté à la main :
// le flux du jour n'en contenait aucun.
const xml = readFileSync(new URL('./fixtures/norsevan-feed.xml', import.meta.url), 'utf-8')

test('isArmenianText : majorité de lettres arméniennes', () => {
  assert.equal(isArmenianText('Երեկ Բուենոս Այրեսում'), true)
  assert.equal(isArmenianText('Reunión de la colectividad'), false)
  assert.equal(isArmenianText('Reunión Երեկ'), false)
  assert.equal(isArmenianText(''), false)
})

test('un billet arménien finit sous hy, aucun sous es', () => {
  const { es, hy } = parseFeed(xml, 25)
  const esAll = es.flatMap((s) => s.articles)
  const hyAll = hy.flatMap((s) => s.articles)
  assert.equal(hy.length, 1)
  assert.equal(hy[0].categoryKey, 'hayeren')
  assert.equal(hy[0].label, 'Նոր Սեւան — հայերէն')
  assert.equal(hyAll.length, 1)
  assert.match(hyAll[0].url, /yeraghdabard-enk$/)
  assert.equal(esAll.length, 20)
  assert.ok(!esAll.some((a) => isArmenianText(a.title)))
})

test('articles complets, date = pubDate, image sans /v1/fit/', () => {
  const { es, hy } = parseFeed(xml, 25)
  for (const a of [...es, ...hy].flatMap((s) => s.articles)) {
    assert.ok(a.title)
    assert.match(a.url, /^https:\/\/www\.norsevan\.com\/post\//)
    assert.match(a.date, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
    assert.match(a.image, /^https:\/\/static\.wixstatic\.com\/media\//)
    assert.ok(!a.image.includes('/v1/fit/'))
  }
  assert.equal(es[0].articles[0].date, '2026-10-30T20:55:09.000Z')
})

test('fullImage retire le segment /v1/fit/…', () => {
  assert.equal(
    fullImage('https://static.wixstatic.com/media/a~mv2.jpg/v1/fit/w_700,h_394,al_c,q_80/file.png'),
    'https://static.wixstatic.com/media/a~mv2.jpg',
  )
  assert.equal(fullImage('https://static.wixstatic.com/media/a~mv2.jpg'), 'https://static.wixstatic.com/media/a~mv2.jpg')
})

test('chaque étagère est classée dans RUBRIC_MAP', () => {
  const { es, hy } = parseFeed(xml, 25)
  for (const s of [...es, ...hy]) assert.ok(RUBRIC_MAP.norsevan[s.categoryKey], `étagère ${s.categoryKey} absente`)
  assert.ok(es.some((s) => s.categoryKey === 'derechos-humanos' && s.label === 'Derechos Humanos'))
  assert.equal(SOURCE_NAMES.norsevan, 'Nor Sevan')
  assert.equal(TAB_ORDER.es.at(-1), 'norsevan')
  assert.equal(TAB_ORDER.hy.at(-1), 'norsevan')
})

test('une catégorie sans lettre latine retombe sur general', () => {
  const rss = '<rss><channel><item><title>Hola</title><link>https://www.norsevan.com/post/hola</link><category>Հայաստան</category><pubDate>Fri, 30 Oct 2026 20:55:09 GMT</pubDate></item></channel></rss>'
  const { es } = parseFeed(rss)
  assert.equal(es[0].categoryKey, 'general')
})
