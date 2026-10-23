import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TAB_ORDER, SOURCE_NAMES, feedFor, CONTENT_LANG, contentLang } from '../src/newsLangs.js'
import { ALL_LANGS } from '../sites.config.js'

test('TAB_ORDER couvre les langues servies et les langues lues en français', () => {
  const attendues = new Set([...ALL_LANGS, ...Object.keys(CONTENT_LANG)])
  assert.deepEqual(Object.keys(TAB_ORDER).sort(), [...attendues].sort())
})

test('de et it partagent le tableau français (référence, pas copie)', () => {
  assert.equal(TAB_ORDER.de, TAB_ORDER.fr)
  assert.equal(TAB_ORDER.it, TAB_ORDER.fr)
})

test('contentLang : de/it lisent le français, les autres leur propre langue', () => {
  assert.equal(contentLang('de'), 'fr')
  assert.equal(contentLang('it'), 'fr')
  for (const l of ['fr', 'en', 'hy', 'ru']) assert.equal(contentLang(l), l)
})

test('feedFor sous de/it rend exactement le flux français du vrai news.json', () => {
  const news = JSON.parse(readFileSync(new URL('../src/data/news.json', import.meta.url), 'utf-8'))
  for (const id of TAB_ORDER.fr)
    for (const l of ['de', 'it'])
      assert.deepEqual(feedFor(news, id, l), feedFor(news, id, 'fr'), `${id}/${l}`)
  assert.ok(feedFor(news, 'armenpress', 'de').length > 0)
})

test('chaque source nommée dans TAB_ORDER a un nom affichable', () => {
  for (const ids of Object.values(TAB_ORDER))
    for (const id of ids) assert.ok(SOURCE_NAMES[id], `SOURCE_NAMES.${id}`)
})

test('feedFor lit les deux formes de news.json', () => {
  const news = {
    armenpress: { fr: [{ categoryKey: 'armenia', articles: [] }] },
    courrier: [{ sectionKey: 'actualite', articles: [] }],
    armradio: { en: [{ categoryKey: 'politics', articles: [] }] },
  }
  assert.equal(feedFor(news, 'armenpress', 'fr').length, 1)
  assert.equal(feedFor(news, 'courrier', 'fr').length, 1)
  // ArmRadio n'a pas d'édition française : repli sur l'anglais.
  assert.equal(feedFor(news, 'armradio', 'fr')[0].categoryKey, 'politics')
  assert.deepEqual(feedFor(news, 'absente', 'fr'), [])
  assert.deepEqual(feedFor(news, 'armenpress', 'ru'), [])
})
