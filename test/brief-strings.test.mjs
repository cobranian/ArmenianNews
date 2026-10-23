import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BRIEF_STRINGS } from '../src/briefStrings.js'
import { ALL_LANGS } from '../sites.config.js'
import { BLOC_LANGS, valeur } from './helpers/i18n-blocks.mjs'

test('chaque langue porte toutes les clés de fr, non vides', () => {
  const keys = Object.keys(BRIEF_STRINGS.fr)
  for (const l of new Set([...ALL_LANGS, ...BLOC_LANGS]))
    for (const k of keys) assert.ok(BRIEF_STRINGS[l]?.[k]?.trim(), `${l}.${k}`)
})

test('la marque visible concorde avec site.title d’i18n.jsx', async () => {
  const src = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
  const titles = [...src.matchAll(/'site\.title':\s*'([^']+)'/g)].map((m) => m[1])
  assert.equal(titles.length, BLOC_LANGS.length, 'un site.title par bloc')
  // Chaque bloc est lu par sa langue, pas par sa position dans le fichier.
  for (const l of BLOC_LANGS) assert.equal(BRIEF_STRINGS[l].brand, valeur(l, 'site.title'), l)
})

test('radio et agenda concordent avec nav.radio / nav.agenda d’i18n.jsx', async () => {
  const src = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
  const radio = [...src.matchAll(/'nav\.radio':\s*'([^']+)'/g)].map((m) => m[1])
  const agenda = [...src.matchAll(/'nav\.agenda':\s*'([^']+)'/g)].map((m) => m[1])
  assert.equal(radio.length, BLOC_LANGS.length)
  assert.equal(agenda.length, BLOC_LANGS.length)
  for (const l of BLOC_LANGS) {
    assert.equal(BRIEF_STRINGS[l].radio, valeur(l, 'nav.radio'), `${l}.radio`)
    assert.equal(BRIEF_STRINGS[l].agenda, valeur(l, 'nav.agenda'), `${l}.agenda`)
  }
})
