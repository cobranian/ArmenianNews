// Garde : le rendu en lot couvre chaque article × chaque langue + Garni, sans
// doublon. Le compte n'est PAS écrit en dur : chaque nouvel article Culture le
// change (175 → 196 le 19 nov. 2026), et un chiffre figé faisait échouer ce
// test sans qu'aucun code n'ait bougé.
import test from 'node:test'
import assert from 'node:assert/strict'
import { jobs } from '../scripts/render-all.mjs'

test('jobs() rend chaque couple une seule fois, Garni compris', () => {
  const j = jobs()
  const all = jobs({ has: () => true })
  assert.ok(j.length > 0)
  assert.ok(j.length <= all.length)
  assert.equal(new Set(j.map((x) => x.out)).size, j.length)
  assert.equal(new Set(j.map((x) => x.composition)).size, j.length)
  // Un Garni par langue, toujours.
  assert.equal(j.filter((x) => x.composition.startsWith('Garni')).length, 7)
})
test('jobs({langs:["es"]}) contient GarniEs', () => {
  assert.ok(
    jobs({ langs: ['es'] }).some(
      (x) => x.composition === 'GarniEs' && x.out === 'out/es/temple-paien-de-garni.mp4',
    ),
  )
})

test('jobs({langs:["fr"],slugs:["duduk"]}) rend le seul couple Fr-duduk', () => {
  assert.deepEqual(jobs({ langs: ['fr'], slugs: ['duduk'] }), [
    { composition: 'Fr-duduk', out: 'out/fr/duduk.mp4' },
  ])
})

test('jobs() ne rend que les langues dont le Short a un texte', () => {
  assert.deepEqual(jobs({ slugs: ['duduk'], has: (_, lang) => lang === 'fr' }), [
    { composition: 'Fr-duduk', out: 'out/fr/duduk.mp4' },
  ])
})
