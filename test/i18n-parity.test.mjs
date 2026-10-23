import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALL_LANGS } from '../sites.config.js'
import { SEO, VIEW_SEO, OG_LOCALE } from '../src/seo.js'
import { BRIEF_STRINGS } from '../src/briefStrings.js'
import { CULTURE_STRINGS } from '../src/cultureStrings.js'
import { RUBRIC_LABELS } from '../src/rubricLabels.js'
import { COUNTRIES, countryLabel } from '../src/worldPlace.js'
import { relativeAge } from '../src/relativeTime.js'
import { BLOCS, BLOC_LANGS, clesDe, valeur, valeursDe } from './helpers/i18n-blocks.mjs'

// LE MODE DE PANNE : t() vaut STRINGS[lang][clé] ?? STRINGS.fr[clé] ?? clé.
// Une clé oubliée dans un bloc allemand ou italien ne casse rien — la page
// affiche du FRANÇAIS sous <html lang="de">, cuit dans le HTML que Google
// indexe. Il en va de même des modules plats (seo, brève, culture, rubriques) :
// chaque table indexée par langue doit porter les mêmes clés que `fr`.

const NOUVELLES = ['de', 'it']
// Toutes les langues qui ont (ou doivent avoir) un bloc, servies ou non.
const LANGUES = [...new Set([...ALL_LANGS, ...NOUVELLES])]

const H = 3600 * 1000
const D = 24 * H
const NOW = Date.UTC(2026, 9, 23, 12, 0, 0)
const ago = (ms, lang) => relativeAge(new Date(NOW - ms).toISOString(), NOW, lang)

const tables = {
  SEO,
  'VIEW_SEO.radio': VIEW_SEO.radio,
  'VIEW_SEO.agenda': VIEW_SEO.agenda,
  'VIEW_SEO.about': VIEW_SEO.about,
  BRIEF_STRINGS,
  CULTURE_STRINGS,
  RUBRIC_LABELS,
}

test('les vues de VIEW_SEO sont toutes couvertes ci-dessus', () => {
  assert.deepEqual(Object.keys(VIEW_SEO).sort(), ['about', 'agenda', 'radio'])
})

test('chaque module plat porte les mêmes clés que fr, dans chaque langue', () => {
  for (const [nom, t] of Object.entries(tables)) {
    const ref = Object.keys(t.fr).sort()
    for (const l of LANGUES) {
      assert.ok(t[l], `${nom}.${l} manquant`)
      assert.deepEqual(Object.keys(t[l]).sort(), ref, `${nom}.${l}`)
      for (const [k, v] of Object.entries(t[l]))
        assert.equal(typeof v, 'string', `${nom}.${l}.${k} n'est pas une chaîne`)
    }
  }
})

test('les valeurs de/it des modules plats ne sont pas vides', () => {
  // `translatedFrom` est vide à dessein hors de/it (la mention ne s'affiche
  // que sous une traduction non relue) ; partout ailleurs, une chaîne vide
  // rendrait un trou dans la page.
  for (const [nom, t] of Object.entries(tables))
    for (const l of NOUVELLES)
      for (const [k, v] of Object.entries(t[l])) assert.ok(v.trim(), `${nom}.${l}.${k} vide`)
})

test('OG_LOCALE couvre chaque langue', () => {
  for (const l of LANGUES) assert.ok(OG_LOCALE[l], l)
  assert.equal(OG_LOCALE.de, 'de_DE')
  assert.equal(OG_LOCALE.it, 'it_IT')
})

test('la mention « traduit du français » : présente partout, remplie sous de/it seulement', () => {
  for (const l of LANGUES) assert.equal(typeof CULTURE_STRINGS[l].translatedFrom, 'string', l)
  assert.equal(CULTURE_STRINGS.de.translatedFrom, 'Aus dem Französischen übersetzt')
  assert.equal(CULTURE_STRINGS.it.translatedFrom, 'Tradotto dal francese')
  for (const l of ['fr', 'en', 'hy', 'ru']) assert.equal(CULTURE_STRINGS[l].translatedFrom, '', l)
})

test('la marque reste « Arménie Info » sous de/it', () => {
  for (const l of NOUVELLES) {
    assert.equal(BRIEF_STRINGS[l].brand, 'Arménie Info', l)
    assert.equal(valeur(l, 'site.title'), 'Arménie Info', l)
  }
})

test('chaque langue a son bloc STRINGS dans src/i18n.jsx', () => {
  for (const l of LANGUES) assert.ok(BLOCS[l], `bloc STRINGS.${l} absent`)
  // L'ordre du fichier suit celui du sélecteur (fr, de, it, en, hy, ru).
  assert.deepEqual(BLOC_LANGS, ['fr', 'de', 'it', 'en', 'hy', 'ru'])
})

test('chaque bloc STRINGS déclare exactement les clés du bloc fr', () => {
  const ref = [...clesDe('fr')].sort()
  assert.ok(ref.length > 100, `bloc fr lu comme texte : ${ref.length} clés seulement`)
  for (const l of BLOC_LANGS) {
    assert.deepEqual([...clesDe(l)].sort(), ref, `STRINGS.${l}`)
    assert.equal(BLOCS[l].split(`...rubricStrings('${l}')`).length - 1, 1, `rubricStrings ${l}`)
  }
})

test('news.originalLang : présente partout, remplie sous de/it seulement', () => {
  assert.equal(valeur('de', 'news.originalLang'), 'Artikel auf Französisch')
  assert.equal(valeur('it', 'news.originalLang'), 'Articoli in francese')
  for (const l of ['fr', 'en', 'hy', 'ru']) assert.equal(valeur(l, 'news.originalLang'), '', l)
})

test('LOCALES : de-CH et it-CH', () => {
  const src = readFileSync(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
  const m = src.match(/const LOCALES = \{([^}]*)\}/)
  assert.ok(m, 'LOCALES introuvable')
  assert.match(m[1], /\bde: 'de-CH'/)
  assert.match(m[1], /\bit: 'it-CH'/)
})

test('chaque pays du sélecteur a son nom allemand et italien', () => {
  const cles = Object.keys(COUNTRIES)
  assert.ok(cles.length > 20)
  for (const k of cles)
    for (const l of NOUVELLES) {
      // On lit la table, pas countryLabel seul : celui-ci retombe sur le
      // français, ce qui rendrait le contrôle vide.
      assert.ok(COUNTRIES[k][l]?.trim(), `COUNTRIES.${k}.${l}`)
      assert.ok(countryLabel(k, l).trim(), `countryLabel(${k}, ${l})`)
    }
})

test('l’âge des dépêches en allemand et en italien', () => {
  assert.equal(ago(3 * H, 'de'), '3 Std.')
  assert.equal(ago(2 * D, 'de'), '2 T.')
  assert.equal(ago(3 * H, 'it'), '3 h')
  assert.equal(ago(2 * D, 'it'), '2 g')
})

// L'allemand de Suisse n'a pas de ß. Un seul suffit à trahir un texte écrit
// pour l'Allemagne — et c'est le public suisse que vise armenieinfo.ch.
test('aucun ß dans les chaînes allemandes', () => {
  const de = [
    ...valeursDe('de'),
    ...Object.values(tables).flatMap((t) => Object.values(t.de)),
    ...Object.values(COUNTRIES).map((c) => c.de),
    ago(3 * H, 'de'),
  ]
  assert.ok(valeursDe('de').length > 100, 'bloc de lu comme texte : trop peu de valeurs')
  for (const s of de) assert.doesNotMatch(s, /ß/, s)
  assert.doesNotMatch(BLOCS.de, /ß/, 'un ß dans le bloc STRINGS.de')
})
