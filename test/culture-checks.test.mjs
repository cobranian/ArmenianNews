import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findUnsupported } from '../scripts/lib/culture-prompts.mjs'
import { mechanicalClaims, entityTexts, splitClaims, EDITORIAL_TERMS, editorialAlerts, verifyClaims } from '../scripts/lib/culture-checks.mjs'

test('mechanicalClaims : années, nombres, dates en toutes lettres ; ignore les chiffres isolés', () => {
  const c = mechanicalClaims('Né le 12 mars 1915, il part en mars 1920 avec 1 200 livres, en 1915 et 3 amis. Il a 45 ans.')
  assert.ok(c.includes('1915'))
  assert.ok(c.includes('1920'))
  assert.ok(!c.includes('12'))
  assert.ok(c.includes('45'))
  assert.ok(!c.includes('3'))
  assert.equal(new Set(c).size, c.length)
})

test('mechanicalClaims : une date en toutes lettres ne donne que son année', () => {
  const c = mechanicalClaims('Le 12 mars 1915 puis en mars 1920, et 1 200 personnes')
  for (const y of ['1915', '1920', '1 200']) assert.ok(c.includes(y))
  assert.ok(!c.some((x) => x.includes('mars')))
  assert.deepEqual(findUnsupported(mechanicalClaims('Il naît le 12 mars 1915.'), ['Born on March 12, 1915.']), [])
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

// La vérification des faits est un contrôle, pas une condition : sa panne ne
// jette pas le brouillon, et un repli de modèle est toujours annoncé.
test('verifyClaims : faits introuvables, repli annoncé, panne → null sans lever', async () => {
  const body = 'Komitas est né en 1869 à Kütahya.'
  const ok = await verifyClaims({ body, haystack: ['Komitas est né en 1869.'], chat: async () => ({ text: '["Kütahya", "1870"]', model: 'gemini', fellBack: false }) })
  assert.deepEqual(ok.unsupported, { facts: ['1870'], names: ['Kütahya'] })
  assert.deepEqual(ok.warnings, [])
  assert.equal(ok.error, null)

  let seen
  const fb = await verifyClaims({ body, haystack: [body], chat: async (args) => ((seen = args), { text: '[]', model: 'google/gemma-4-31b-it:free', fellBack: true }) })
  assert.equal(seen.temperature, 0)
  assert.deepEqual(fb.warnings, ['Liste des faits extraite par le modèle de secours google/gemma-4-31b-it:free (Gemini indisponible).'])

  const ko = await verifyClaims({ body, haystack: [], chat: async () => { throw new Error('HTTP 503 (gemini)') } })
  assert.equal(ko.unsupported, null)
  assert.equal(ko.error, 'HTTP 503 (gemini)')
  assert.deepEqual(ko.warnings, ['Extraction automatique des faits en échec (HTTP 503 (gemini)).'])

  const bad = await verifyClaims({ body, haystack: [], chat: async () => ({ text: 'pas du JSON', model: 'm', fellBack: false }) })
  assert.equal(bad.unsupported, null, 'réponse illisible : null, jamais « rien à signaler »')
})
