import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { RUBRICS, RUBRIC_MAP, rubricOf, mixedDefault, unmappedKeys } from '../src/rubrics.js'

const news = JSON.parse(
  await readFile(new URL('../src/data/news.json', import.meta.url), 'utf-8'),
)

test('les neuf rubriques, dans l ordre des onglets', () => {
  assert.deepEqual(RUBRICS, [
    'armenie', 'politique', 'economie', 'monde', 'societe',
    'diaspora', 'culture', 'sports', 'opinion',
  ])
})

// LE PIÈGE SILENCIEUX : une rubrique ajoutée par une source et absente de la
// table tomberait dans le repli sans que rien ne le dise. Ce test le dit.
// En CI le test est sauté : `npm test` précède le scrape dans le job horaire, et
// une rubrique nouvelle déjà commise par le scrape précédent le ferait échouer
// en tête de CHAQUE run, gelant scrapes et déploiements. Le signal y est la
// ligne « ✗ rubric: » de scripts/scrape.mjs.
test('chaque rubrique d origine du snapshot est declaree dans RUBRIC_MAP', {
  skip: process.env.GITHUB_ACTIONS
    ? 'sauté en CI : il gèlerait le job horaire (test avant scrape) ; voir « ✗ rubric: » au log'
    : false,
}, () => {
  assert.deepEqual(unmappedKeys(news), [], 'déclarer ces couples dans src/rubrics.js')
})

test('unmappedKeys : fil plat, fil par langue, sectionKey, sans doublon', () => {
  const map = { a: { eco: 'economie' }, b: { news: 'armenie' } }
  const feed = {
    generatedAt: 'x',
    a: {
      en: [{ categoryKey: 'eco' }, { categoryKey: 'nouvelle' }],
      hy: [{ categoryKey: 'nouvelle' }],
    },
    b: [{ sectionKey: 'news' }, { sectionKey: 'autre' }],
    c: [{ categoryKey: 'k' }],
    d: null,
  }
  assert.deepEqual(unmappedKeys(feed, map), ['a|nouvelle', 'b|autre', 'c|k'])
})

test('chaque valeur de la table est une des neuf rubriques', () => {
  for (const [s, keys] of Object.entries(RUBRIC_MAP))
    for (const [k, v] of Object.entries(keys)) {
      const r = typeof v === 'string' ? v : v?.mixed
      assert.ok(RUBRICS.includes(r), `${s}.${k} → ${JSON.stringify(v)}`)
    }
})

test('rubricOf : table fixe, puis rubric de l article pour un fil mixed, puis defaut', () => {
  const map = { x: { eco: 'economie', mix: { mixed: 'armenie' } } }
  assert.equal(rubricOf('x', 'eco', {}, map), 'economie')
  assert.equal(rubricOf('x', 'mix', { rubric: 'sports' }, map), 'sports')
  assert.equal(rubricOf('x', 'mix', { rubric: 'n-importe' }, map), 'armenie')
  assert.equal(rubricOf('x', 'mix', {}, map), 'armenie')
  assert.equal(rubricOf('x', 'inconnu', {}, map), 'armenie')
})

// Review Focus : une rubrique d'origine passée de mixed à fixe garde son vieux
// `rubric` dans news.json jusqu'au prochain scrape — la table doit l'emporter.
test('rubricOf ignore article.rubric hors fil mixed', () => {
  const map = { x: { eco: 'economie' } }
  assert.equal(rubricOf('x', 'eco', { rubric: 'sports' }, map), 'economie')
})

test('mixedDefault ne vaut que pour un fil mixed', () => {
  const map = { x: { eco: 'economie', mix: { mixed: 'diaspora' } } }
  assert.equal(mixedDefault('x', 'mix', map), 'diaspora')
  assert.equal(mixedDefault('x', 'eco', map), null)
  assert.equal(mixedDefault('y', 'eco', map), null)
})
