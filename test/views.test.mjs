import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VIEWS,
  ALL_VIEWS,
  ALL_LANGS,
  urlFor,
  pathFor,
  langPath,
  viewFromPath,
  xDefaultFor,
} from '../sites.config.js'

test('chaque vue declare un slug pour chacune des quatre langues', () => {
  for (const view of ALL_VIEWS) {
    assert.deepEqual(
      Object.keys(VIEWS[view].slugs).sort(),
      [...ALL_LANGS].sort(),
      `la vue ${view} ne couvre pas les quatre langues`,
    )
  }
})

test('chaque couple (langue, vue) vit a exactement une URL', () => {
  const urls = ALL_LANGS.flatMap((l) => ALL_VIEWS.map((v) => urlFor(l, v)))
  assert.equal(new Set(urls).size, urls.length, `URL en double : ${urls}`)
})

test('urlFor compose le chemin de langue et le slug de la vue', () => {
  assert.equal(urlFor('fr'), 'https://armenieinfo.ch/')
  assert.equal(urlFor('fr', 'radio'), 'https://armenieinfo.ch/radio')
  assert.equal(urlFor('en', 'radio'), 'https://armenianews.org/radio')
  assert.equal(urlFor('hy', 'radio'), 'https://armenianews.org/hy/radio')
  assert.equal(urlFor('ru', 'radio'), 'https://armenianews.org/ru/radio')
})

test('pathFor donne le chemin sans le host', () => {
  assert.equal(pathFor('fr'), '/')
  assert.equal(pathFor('fr', 'radio'), '/radio')
  assert.equal(pathFor('hy', 'radio'), '/hy/radio')
})

test('langPath donne le chemin de la page d accueil de la langue', () => {
  assert.equal(langPath('ch', 'fr'), '/')
  assert.equal(langPath('org', 'en'), '/')
  assert.equal(langPath('org', 'hy'), '/hy/')
})

test('viewFromPath lit la vue depuis le chemin', () => {
  assert.equal(viewFromPath('ch', '/'), 'home')
  assert.equal(viewFromPath('ch', '/radio'), 'radio')
  assert.equal(viewFromPath('ch', '/radio/'), 'radio')
  assert.equal(viewFromPath('org', '/hy/radio'), 'radio')
  assert.equal(viewFromPath('org', '/ru/radio'), 'radio')
})

// Firebase reecrit tout chemin inconnu vers index.html : la page servie est
// alors l'accueil, et la vue doit le dire. Sans ce repli, /radiotelevision
// rendrait une page de radio sous une URL qui n'existe pas.
test('viewFromPath retombe sur home pour un chemin inconnu', () => {
  assert.equal(viewFromPath('ch', '/nimportequoi'), 'home')
  assert.equal(viewFromPath('ch', '/radiotelevision'), 'home')
  assert.equal(viewFromPath('org', '/hy/nimportequoi'), 'home')
})

test('x-default suit la vue, pas seulement la langue', () => {
  assert.equal(xDefaultFor(), 'https://armenianews.org/')
  assert.equal(xDefaultFor('radio'), 'https://armenianews.org/radio')
})
