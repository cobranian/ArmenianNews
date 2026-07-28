import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SITES, LANG_URL, ALL_LANGS, LANGS, X_DEFAULT, primaryLang, langFromPath, siteOf } from '../sites.config.js'

test('chaque langue vit à exactement une URL', () => {
  const langs = Object.values(SITES).flatMap((s) => s.pages.map((p) => p.lang))
  assert.deepEqual([...langs].sort(), [...ALL_LANGS].sort())
  assert.equal(new Set(langs).size, langs.length, 'une langue est servie à deux endroits')
})

test('ALL_LANGS et LANGS décrivent exactement les mêmes langues', () => {
  assert.deepEqual([...ALL_LANGS].sort(), LANGS.map((l) => l.code).sort())
})

test('LANG_URL est absolue et finit par un slash', () => {
  for (const lang of ALL_LANGS) {
    assert.match(LANG_URL[lang], /^https:\/\/[^/]+\/(?:[a-z]{2}\/)?$/, lang)
  }
  assert.equal(LANG_URL.fr, 'https://armenieinfo.ch/')
  assert.equal(LANG_URL.en, 'https://armenianews.org/')
  assert.equal(LANG_URL.hy, 'https://armenianews.org/hy/')
  assert.equal(LANG_URL.ru, 'https://armenianews.org/ru/')
})

test('x-default pointe sur la page anglaise', () => {
  assert.equal(X_DEFAULT, 'https://armenianews.org/')
})

test('primaryLang donne la langue de tête du domaine', () => {
  assert.equal(primaryLang('ch'), 'fr')
  assert.equal(primaryLang('org'), 'en')
})

test('langFromPath : le chemin fait autorité, sinon la langue du site', () => {
  assert.equal(langFromPath('org', '/hy/'), 'hy')
  assert.equal(langFromPath('org', '/hy'), 'hy')     // cleanUrls, sans slash final
  assert.equal(langFromPath('org', '/ru/'), 'ru')
  assert.equal(langFromPath('org', '/'), 'en')
  assert.equal(langFromPath('ch', '/'), 'fr')
})

test('langFromPath : une URL inconnue retombe sur la langue du site', () => {
  // Le rewrite SPA de Firebase sert index.html pour toute URL non trouvée ;
  // cette page-là est dans la langue par défaut du site, pas en 404.
  assert.equal(langFromPath('org', '/nimportequoi'), 'en')
  assert.equal(langFromPath('org', '/hydravion'), 'en') // ne doit PAS matcher /hy
})

test('siteOf route chaque langue vers son domaine', () => {
  assert.equal(siteOf('fr'), 'ch')
  assert.equal(siteOf('en'), 'org')
  assert.equal(siteOf('hy'), 'org')
  assert.equal(siteOf('ru'), 'org')
})
