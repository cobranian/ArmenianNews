import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BRIEF_STRINGS } from '../src/briefStrings.js'
import { ALL_LANGS } from '../sites.config.js'

test('chaque langue porte toutes les clés de fr, non vides', () => {
  const keys = Object.keys(BRIEF_STRINGS.fr)
  for (const l of ALL_LANGS)
    for (const k of keys) assert.ok(BRIEF_STRINGS[l]?.[k]?.trim(), `${l}.${k}`)
})

test('la marque visible concorde avec site.title d’i18n.jsx', async () => {
  const src = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
  const titles = [...src.matchAll(/'site\.title':\s*'([^']+)'/g)].map((m) => m[1])
  assert.equal(titles.length, ALL_LANGS.length, 'un site.title par bloc')
  // Les blocs STRINGS d'i18n.jsx sont dans l'ordre fr, en, hy, ru.
  ALL_LANGS.forEach((l, i) => assert.equal(BRIEF_STRINGS[l].brand, titles[i], l))
})

test('radio et agenda concordent avec nav.radio / nav.agenda d’i18n.jsx', async () => {
  const src = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')
  const radio = [...src.matchAll(/'nav\.radio':\s*'([^']+)'/g)].map((m) => m[1])
  const agenda = [...src.matchAll(/'nav\.agenda':\s*'([^']+)'/g)].map((m) => m[1])
  assert.equal(radio.length, ALL_LANGS.length)
  assert.equal(agenda.length, ALL_LANGS.length)
  ALL_LANGS.forEach((l, i) => {
    assert.equal(BRIEF_STRINGS[l].radio, radio[i], `${l}.radio`)
    assert.equal(BRIEF_STRINGS[l].agenda, agenda[i], `${l}.agenda`)
  })
})
