import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mechanicalClaims, entityTexts, splitClaims, EDITORIAL_TERMS, editorialAlerts } from '../scripts/lib/culture-checks.mjs'

test('mechanicalClaims : années, nombres, dates en toutes lettres ; ignore les chiffres isolés', () => {
  const c = mechanicalClaims('Né le 12 mars 1915, il part en mars 1920 avec 1 200 livres, en 1915 et 3 amis. Il a 45 ans.')
  assert.ok(c.includes('12 mars 1915'))
  assert.ok(c.includes('mars 1920'))
  assert.ok(c.includes('1915'))
  assert.ok(c.includes('45'))
  assert.ok(!c.includes('3'))
  assert.equal(new Set(c).size, c.length)
})

test('splitClaims : chiffres vers facts, noms vers names', () => {
  assert.deepEqual(splitClaims(['1915', 'Komitas', 'mars 1920']), { facts: ['1915', 'mars 1920'], names: ['Komitas'] })
})

test('entityTexts : libellés et alias fr/en', () => {
  const e = { labels: { fr: 'Komitas', en: 'Komitas', hy: 'Կոմիտաս' }, aliases: { fr: ['Soghomon'], en: ['Gomidas'] } }
  assert.deepEqual(entityTexts(e).sort(), ['Gomidas', 'Komitas', 'Komitas', 'Soghomon'])
  assert.deepEqual(entityTexts(null), [])
})

test('editorialAlerts : termes signalés, Arménie non, une alerte par phrase', () => {
  assert.ok(EDITORIAL_TERMS.includes('azerbaijan'))
  assert.equal(editorialAlerts('La cuisine azerbaïdjanaise est citée. Les Azéris aussi, et Azerbaijan encore.').length, 2)
  assert.equal(editorialAlerts('Le Köçəri est une danse.').length, 1)
  assert.equal(editorialAlerts('L’Arménie chante.').length, 0)
  const long = editorialAlerts('Azerbaïdjan ' + 'x'.repeat(300) + '.')
  assert.ok(long[0].length <= 160)
})
