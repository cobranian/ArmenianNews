import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SITES, LANG_URL, ALL_LANGS, LANGS, X_DEFAULT, primaryLang, langFromPath, siteOf, orderLangsFor } from '../sites.config.js'

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
  assert.equal(LANG_URL.de, 'https://armenieinfo.ch/de/')
  assert.equal(LANG_URL.it, 'https://armenieinfo.ch/it/')
})

test('l’ordre canonique des sept langues', () => {
  assert.deepEqual(ALL_LANGS, ['fr', 'de', 'it', 'en', 'es', 'hy', 'ru'])
  assert.deepEqual(LANGS.map((l) => l.code), ALL_LANGS)
  assert.deepEqual(LANGS.find((l) => l.code === 'de'), { code: 'de', label: 'DE', name: 'Deutsch' })
  assert.deepEqual(LANGS.find((l) => l.code === 'it'), { code: 'it', label: 'IT', name: 'Italiano' })
})

// La langue du domaine en tête, le reste dans l'ordre canonique : le .ch
// ouvre sur ses trois langues, le .org sur l'anglais.
test('orderLangsFor : la langue du domaine en tête', () => {
  assert.deepEqual(orderLangsFor('ch', LANGS).map((l) => l.code), ['fr', 'de', 'it', 'en', 'es', 'hy', 'ru'])
  assert.deepEqual(orderLangsFor('org', LANGS).map((l) => l.code), ['en', 'fr', 'de', 'it', 'es', 'hy', 'ru'])
})

test('x-default pointe sur la page anglaise', () => {
  assert.equal(X_DEFAULT, 'https://armenianews.org/')
  assert.equal(X_DEFAULT, LANG_URL.en)
})

test('primaryLang donne la langue de tête du domaine', () => {
  // fr DOIT rester la première page du .ch : AboutPage et l'image Culture
  // (/culture/<slug>/) s'appuient sur la langue de tête.
  assert.equal(primaryLang('ch'), 'fr')
  assert.equal(SITES.ch.pages[0].lang, 'fr')
  assert.equal(primaryLang('org'), 'en')
})

test('langFromPath : le chemin fait autorité, sinon la langue du site', () => {
  assert.equal(langFromPath('org', '/hy/'), 'hy')
  assert.equal(langFromPath('org', '/hy'), 'hy')     // sans slash final (Firebase 301 vers /hy/)
  assert.equal(langFromPath('org', '/ru/'), 'ru')
  assert.equal(langFromPath('org', '/'), 'en')
  assert.equal(langFromPath('ch', '/'), 'fr')
  assert.equal(langFromPath('ch', '/de/'), 'de')
  assert.equal(langFromPath('ch', '/it'), 'it')
  assert.equal(langFromPath('ch', '/it/eventi/'), 'it')
  assert.equal(langFromPath('ch', '/design/'), 'fr') // ne doit PAS matcher /de
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
  assert.equal(siteOf('de'), 'ch')
  assert.equal(siteOf('it'), 'ch')
})

test('libellé du sélecteur de langue en de/it', async () => {
  const { LANG_SWITCH_LABEL } = await import('../sites.config.js')
  assert.equal(LANG_SWITCH_LABEL.de, 'Sprache')
  assert.equal(LANG_SWITCH_LABEL.it, 'Lingua')
})

test('libellé du sélecteur de langue : présent et non vide dans chaque langue', async () => {
  const { LANG_SWITCH_LABEL, ALL_LANGS } = await import('../sites.config.js')
  for (const l of ALL_LANGS) assert.ok(typeof LANG_SWITCH_LABEL[l] === 'string' && LANG_SWITCH_LABEL[l].trim(), l)
})
