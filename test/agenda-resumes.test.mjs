import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  extractEventText,
  sourceHash,
  forbiddenDetail,
} from '../scripts/lib/agenda-resumes.mjs'

// Extrait RÉEL de la page armenopole « Young Prodigies of Armenia in
// Switzerland », relevé le 24 octobre 2026 (la page disparaîtra avec
// l'événement). Le texte de présentation vit dans [itemprop="description"].
const fixture = readFileSync(
  new URL('./fixtures/armenopole-event-2026-10-24.html', import.meta.url),
  'utf8',
)

test('extrait le texte réel de la fixture', () => {
  const t = extractEventText(fixture)
  assert.ok(t.startsWith('Save the Date'))
  assert.match(t, /Young Prodigies of Armenia/)
  assert.ok(t.length > 1000)
})

test('texte trop court ou absent → null', () => {
  assert.equal(extractEventText('<div itemprop="description">Bientôt.</div>'), null)
  assert.equal(extractEventText('<html><body>rien</body></html>'), null)
})

test('sourceHash est stable et sensible au texte', () => {
  assert.equal(sourceHash('a'), sourceHash('a'))
  assert.notEqual(sourceHash('a'), sourceHash('b'))
  assert.equal(sourceHash('a').length, 12)
})

test('forbiddenDetail attrape heures, prix, adresses', () => {
  assert.equal(forbiddenDetail('Concert à 19:30 à Genève.'), 'heure')
  assert.equal(forbiddenDetail('Starts at 7 PM.'), 'heure')
  assert.equal(forbiddenDetail('Начало в 19.00.'), 'heure')
  assert.equal(forbiddenDetail('Billets CHF 35.'), 'prix')
  assert.equal(forbiddenDetail('Entrée 15 €.'), 'prix')
  assert.equal(forbiddenDetail('Tickets $20.'), 'prix')
  assert.equal(forbiddenDetail('Տոմսը 5000 ֏ է։'), 'prix')
  assert.equal(forbiddenDetail('Билет 500 руб.'), 'prix')
  assert.equal(forbiddenDetail('Au 2 Place d’Arménie.'), 'adresse')
  assert.equal(forbiddenDetail('At 11 St. Annagasse.'), 'adresse')
})

test('forbiddenDetail laisse passer années, ordinaux, petits nombres', () => {
  for (const s of [
    'La 33e édition du festival.',
    'Deux concerts en 2026.',
    '2 concerts, 6 villes.',
    'Les 40 ans de GAIDZ.',
  ])
    assert.equal(forbiddenDetail(s), null, s)
})
