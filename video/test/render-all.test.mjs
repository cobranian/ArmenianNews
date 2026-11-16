// Garde : le rendu en lot couvre 22 articles × 7 langues + 7 Garni, sans doublon.
import test from 'node:test'
import assert from 'node:assert/strict'
import { jobs } from '../scripts/render-all.mjs'

test('jobs() rend 175 entrées sans doublon de sortie', () => {
  const j = jobs()
  assert.equal(j.length, 175)
  assert.equal(new Set(j.map((x) => x.out)).size, 175)
  assert.equal(new Set(j.map((x) => x.composition)).size, 175)
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
