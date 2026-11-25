import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findUnsupported } from '../scripts/lib/culture-prompts.mjs'
import { mechanicalClaims, entityTexts, splitClaims, EDITORIAL_TERMS, editorialAlerts, verifyClaims, draftShort, reviseShort } from '../scripts/lib/culture-checks.mjs'

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

// Le Short : un appel à part, deux essais, jamais d'exception — un article ne
// tombe pas pour sa vidéo.
const ARTICLE = '---\ntitle: "Le duduk"\n---\n\nNé au Ve siècle, inscrit en 2005, long de 28 à 40 cm.'
const sfact = (over = {}) => ({ eyebrow: 'Arménie', title: 'Un titre', text: 'Un texte court.', spoken: 'Un fait dit en 2005.', big: false, ...over })
const goodShort = (over = {}) => ({
  facts: Array.from({ length: 7 }, () => sfact()),
  outroTitle: 'Le duduk',
  ytTitle: 'Le duduk, depuis 2005',
  ytLead: 'Une phrase.',
  music: 'otar',
  ...over,
})
const reply = (o) => ({ text: '```json\n' + JSON.stringify(o) + '\n```', model: 'gemini', fellBack: false })
const args = { title: 'Le duduk', description: 'D', body: 'B', articleText: ARTICLE }

test('draftShort : second essai après un Short invalide ; champs inconnus retirés', async () => {
  const calls = []
  const answers = [reply(goodShort({ ytTitle: 'Inventé en 1999' })), reply({ ...goodShort(), bavard: 'x' })]
  const r = await draftShort({ ...args, chat: async (o) => (calls.push(o), answers.shift()) })
  assert.equal(calls.length, 2)
  assert.deepEqual(r.short, goodShort())
  assert.equal(r.error, null)
  assert.deepEqual(r.warnings, [])
})

test('draftShort : l’essai suivant reçoit la raison du refus', async () => {
  const calls = []
  const answers = [reply(goodShort({ ytTitle: 'Inventé en 1999' })), reply(goodShort())]
  const r = await draftShort({ ...args, chat: async (o) => (calls.push(o), answers.shift()) })
  assert.deepEqual(r.short, goodShort())
  assert.equal(calls[0].messages.length, 2)
  const last = calls[1].messages.at(-1)
  assert.equal(last.role, 'user')
  assert.match(last.content, /1999/)
  assert.equal(calls[1].messages.at(-2).role, 'assistant')
})

test('draftShort : trois essais au plus', async () => {
  let n = 0
  const r = await draftShort({ ...args, chat: async () => (n++, reply(goodShort({ music: 'jazz' }))) })
  assert.equal(n, 3)
  assert.equal(r.short, null)
})

test('draftShort : deux échecs → pas de Short, la raison ; une panne ne lève pas', async () => {
  const bad = await draftShort({ ...args, chat: async () => reply(goodShort({ music: 'jazz' })) })
  assert.equal(bad.short, null)
  assert.match(bad.error, /music/)
  const down = await draftShort({ ...args, chat: async () => { throw new Error('HTTP 503 (gemini)') } })
  assert.equal(down.short, null)
  assert.match(down.error, /HTTP 503/)
  const prose = await draftShort({ ...args, chat: async () => ({ text: 'non', model: 'm', fellBack: false }) })
  assert.match(prose.error, /JSON illisible/)
})

test('draftShort : un Short qui porte une URL n’est jamais retenu', async () => {
  const r = await draftShort({ ...args, chat: async () => reply(goodShort({ ytLead: 'Tout sur https://duduk.am.' })) })
  assert.equal(r.short, null)
  assert.match(r.error, /URL interdite/)
})

test('reviseShort : une URL dans le Short rendu → l’ancien est gardé, jamais celui-là', () => {
  const r = reviseShort({ oldShort: goodShort(), returned: goodShort({ outroTitle: 'www.duduk.am' }), oldText: ARTICLE, newText: ARTICLE.replace('long de', 'mesurant') })
  assert.equal(r.action, 'kept')
  assert.deepEqual(r.short, goodShort())
  assert.match(r.reason, /URL interdite/)
})

test('draftShort : repli de modèle annoncé', async () => {
  const r = await draftShort({ ...args, chat: async () => ({ ...reply(goodShort()), model: 'secours', fellBack: true }) })
  assert.ok(r.short)
  assert.match(r.warnings.join(), /secours/)
})

// Révision : un texte de vidéo périmé ne doit pas survivre en silence.
test('reviseShort : Short rendu valide → réécrit', () => {
  const r = reviseShort({ oldShort: goodShort(), returned: goodShort({ outroTitle: 'Duduk' }), oldText: ARTICLE, newText: ARTICLE })
  assert.equal(r.action, 'updated')
  assert.equal(r.short.outroTitle, 'Duduk')
})

test('reviseShort : rendu absent ou invalide, ancien encore fidèle → gardé', () => {
  const newText = ARTICLE.replace('long de', 'mesurant')
  for (const returned of [undefined, goodShort({ music: 'jazz' })]) {
    const r = reviseShort({ oldShort: goodShort(), returned, oldText: ARTICLE, newText })
    assert.equal(r.action, 'kept')
    assert.deepEqual(r.short, goodShort())
  }
})

test('reviseShort : article changé, ancien Short plus fidèle → supprimé, avec la raison', () => {
  const newText = ARTICLE.replace('2005', '2008')
  const r = reviseShort({ oldShort: goodShort(), returned: undefined, oldText: ARTICLE, newText })
  assert.equal(r.action, 'deleted')
  assert.equal(r.short, null)
  assert.match(r.reason, /2005/)
})

test('reviseShort : article inchangé → l’ancien est gardé tel quel ; pas d’ancien → rien', () => {
  const stale = goodShort({ ytTitle: 'Inventé en 1999' })
  assert.equal(reviseShort({ oldShort: stale, returned: undefined, oldText: ARTICLE, newText: ARTICLE }).action, 'kept')
  const none = reviseShort({ oldShort: null, returned: goodShort(), oldText: ARTICLE, newText: ARTICLE })
  assert.equal(none.action, 'none')
  assert.equal(none.short, null)
})

// La voix : un Short neuf ou révisé porte `spoken` (requireSpoken), et pickShort le garde.
const sansSpoken = () => goodShort({ facts: Array.from({ length: 7 }, () => { const f = sfact(); delete f.spoken; return f }) })

test('draftShort : spoken conservé dans le Short rendu, et exigé', async () => {
  const r = await draftShort({ ...args, chat: async () => reply(goodShort()) })
  assert.equal(r.short.facts[0].spoken, 'Un fait dit en 2005.')
  const bad = await draftShort({ ...args, attempts: 1, chat: async () => reply(sansSpoken()) })
  assert.equal(bad.short, null)
  assert.match(bad.error, /spoken/)
})

test('reviseShort : spoken conservé ; rendu sans spoken refusé, ancien sans spoken gardé', () => {
  const r = reviseShort({ oldShort: goodShort(), returned: goodShort({ outroTitle: 'Duduk' }), oldText: ARTICLE, newText: ARTICLE })
  assert.equal(r.short.facts[3].spoken, 'Un fait dit en 2005.')
  const vieux = sansSpoken()
  const k = reviseShort({ oldShort: vieux, returned: vieux, oldText: ARTICLE, newText: ARTICLE.replace('long de', 'mesurant') })
  assert.equal(k.action, 'kept')
  assert.deepEqual(k.short, vieux)
})
