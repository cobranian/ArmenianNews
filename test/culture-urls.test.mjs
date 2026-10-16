import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_LANGS, cultureUrl, culturePath, cultureImagePath, CULTURE_SLUGS } from '../sites.config.js'
import { CULTURE_STRINGS } from '../src/cultureStrings.js'

test('cultureUrl : index et article, slash final, par vitrine', () => {
  assert.equal(cultureUrl('fr'), 'https://armenieinfo.ch/culture/')
  assert.equal(cultureUrl('en', 'komitas'), 'https://armenianews.org/culture/komitas/')
  assert.equal(cultureUrl('hy', 'komitas'), 'https://armenianews.org/hy/culture/komitas/')
  assert.equal(culturePath('ru', 'komitas'), '/ru/culture/komitas/')
  assert.equal(culturePath('en'), '/culture/')
  for (const l of ALL_LANGS) assert.ok(cultureUrl(l, 'a-b1').endsWith('/'))
})

test('cultureUrl refuse un slug ou une langue invalides', () => {
  for (const bad of ['Komitas', 'a/b', '../x', 'a--b', '-a', 'é']) assert.throws(() => cultureUrl('fr', bad), bad)
  assert.throws(() => cultureUrl('de'))
})

test('cultureImagePath', () => {
  assert.equal(cultureImagePath('komitas', 'jpg'), '/culture/komitas/image.jpg')
  assert.equal(cultureImagePath('komitas', 'webp'), '/culture/komitas/image.webp')
  assert.throws(() => cultureImagePath('komitas', 'png'))
  assert.throws(() => cultureImagePath('../x', 'jpg'))
})

test('CULTURE_SLUGS couvre les quatre langues', () => {
  assert.deepEqual(Object.keys(CULTURE_SLUGS).sort(), [...ALL_LANGS].sort())
})

test('CULTURE_STRINGS : mêmes clés, non vides, dans les quatre langues', () => {
  const keys = Object.keys(CULTURE_STRINGS.fr).sort()
  for (const l of ALL_LANGS) {
    assert.deepEqual(Object.keys(CULTURE_STRINGS[l]).sort(), keys, l)
    for (const k of keys) assert.ok(CULTURE_STRINGS[l][k].trim(), `${l}.${k}`)
  }
  assert.equal(CULTURE_STRINGS.fr.nav, 'Culture')
  assert.equal(CULTURE_STRINGS.hy.nav, 'Մշակույթ')
  assert.equal(CULTURE_STRINGS.ru.nav, 'Культура')
})
