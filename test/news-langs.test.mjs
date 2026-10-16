import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAB_ORDER, SOURCE_NAMES, feedFor } from '../src/newsLangs.js'
import { ALL_LANGS } from '../sites.config.js'

test('TAB_ORDER couvre les quatre langues', () => {
  assert.deepEqual(Object.keys(TAB_ORDER).sort(), [...ALL_LANGS].sort())
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
