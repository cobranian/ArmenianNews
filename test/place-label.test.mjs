import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PLACES, placeLabel } from '../src/worldPlace.js'

// Le badge de lieu des cartes de l'agenda : le texte d'Armenopole est en
// français, le lecteur anglais lisait « Angleterre » (27 oct. 2026).
const LANGUES = ['de', 'it', 'en', 'hy', 'ru', 'es']

test('chaque lieu de PLACES a son nom dans les cinq langues non françaises', () => {
  for (const [k, v] of Object.entries(PLACES))
    for (const l of LANGUES) assert.ok(v[l]?.trim(), `PLACES['${k}'].${l}`)
})

test('aucun ß dans les lieux allemands (public suisse)', () => {
  for (const v of Object.values(PLACES)) assert.doesNotMatch(v.de, /ß/, v.de)
})

test('placeLabel traduit les régions, les villes et les pays', () => {
  assert.equal(placeLabel('Angleterre', 'en'), 'England')
  assert.equal(placeLabel('Genève', 'de'), 'Genf')
  assert.equal(placeLabel('Erevan', 'hy'), 'Երևան')
  assert.equal(placeLabel('Provence-Alpes-Côte-d’Azur', 'it'), 'Provenza-Alpi-Costa Azzurra')
  // Un nom de pays seul passe par COUNTRIES.
  assert.equal(placeLabel('Russie', 'en'), 'Russia')
  assert.equal(placeLabel('Émirats arabes unis', 'ru'), 'ОАЭ')
  // Alias anglais d'un pays ou d'une ville.
  assert.equal(placeLabel('Cyprus', 'ru'), 'Кипр')
  assert.equal(placeLabel('Yerevan', 'hy'), 'Երևան')
})

test('le français garde le texte de la source, un lieu inconnu aussi', () => {
  assert.equal(placeLabel('Angleterre', 'fr'), 'Angleterre')
  assert.equal(placeLabel('Patagonie', 'en'), 'Patagonie')
  assert.equal(placeLabel('', 'en'), '')
  assert.equal(placeLabel(undefined, 'en'), '')
})
