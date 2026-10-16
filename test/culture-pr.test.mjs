// test/culture-pr.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrBody, ideasIssueBody } from '../scripts/lib/culture-pr.mjs'
import { factsChecked } from '../scripts/lib/culture-validate.mjs'
import { meta } from './helpers/culture-fixture.mjs'

test('corps de PR : faits ⚠️ en tête, recouvrement, sources, images, mode d’emploi, case', () => {
  const body = buildPrBody({
    title: 'Komitas',
    meta: meta('komitas', { agendaEvent: { title: 'Concert', url: 'https://e/1', date: '2026-10-25T20:00', location: 'Genève' } }),
    unsupported: ['1870', 'Vienne'],
    overlap: 0.21,
    warnings: ['Pas d’article Wikipédia en français'],
  })
  assert.ok(body.indexOf('⚠️ 1870') < body.indexOf('### Sources'))
  assert.match(body, /21\.0 %.*au-dessus du seuil/)
  assert.match(body, /> ⚠️ Pas d’article Wikipédia en français/)
  assert.match(body, /\[Komitas\]\(https:\/\/fr\.wikipedia\.org\/wiki\/Komitas\)/)
  assert.match(body, /0\. \*\*choisie\*\*/)
  assert.match(body, /"imageChoice"/)
  assert.match(body, /\[Concert\]\(https:\/\/e\/1\)/)
  assert.match(body, /gemini-flash-latest/)
  assert.match(body, /étiquette \*\*traduire\*\*/)
  assert.equal(factsChecked(body), false)
  assert.equal(factsChecked(body.replace('- [ ] Faits vérifiés', '- [x] Faits vérifiés')), true)
})

test('corps de PR : rien à signaler, pas d’image', () => {
  const body = buildPrBody({ title: 'T', meta: meta('t', { candidates: [], imageChoice: null, image: null }), unsupported: [], overlap: 0.03, warnings: [] })
  assert.match(body, /se retrouvent dans les sources/)
  assert.doesNotMatch(body, /au-dessus du seuil/)
  assert.match(body, /Aucune image libre/)
})

test('corps de PR : vérification des faits illisible (null) jamais présentée comme réussie', () => {
  const body = buildPrBody({ title: 'T', meta: meta('t'), unsupported: null, overlap: 0.03, warnings: ['Un avertissement'] })
  assert.match(body, /Vérification automatique des faits indisponible \(réponse du modèle illisible\)/)
  assert.doesNotMatch(body, /se retrouvent dans les sources/)
  assert.ok(body.indexOf('### ⚠️ À vérifier en premier') < body.indexOf('> ⚠️'))
})

test('issue d’idées : entrées prêtes à coller dans sujets.json', () => {
  const body = ideasIssueBody([{ title: 'Le tar', wikipedia_fr: 'Tar (luth)', wikipedia_en: 'Tar (lute)', keywords: ['tar'] }])
  assert.match(body, /Le tar/)
  const json = JSON.parse(body.match(/```json\n([\s\S]*?)\n```/)[1])
  assert.equal(json[0].slug, 'le-tar')
  assert.equal(json[0].status, 'pending')
})
