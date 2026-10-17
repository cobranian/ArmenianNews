// test/culture-pr.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AUTO_START, AUTO_END, buildPrBody, replaceAutoSection, isChecked, uncheck, ideasIssueBody } from '../scripts/lib/culture-pr.mjs'
import { factsChecked } from '../scripts/lib/culture-validate.mjs'
import { meta } from './helpers/culture-fixture.mjs'

const base = { title: 'Komitas', frBody: 'Premier paragraphe.\n\n## Intertitre\n\n### Sous-titre\n\nSecond.', meta: meta('komitas'), unsupported: { facts: [], names: [] }, editorial: [], overlap: 0.03, warnings: [] }

test('corps : alertes avant le texte, texte avant les sources, case en dernier', () => {
  const body = buildPrBody({
    ...base,
    meta: meta('komitas', { agendaEvent: { title: 'Concert', url: 'https://e/1', date: '2026-10-25T20:00', location: 'Genève' } }),
    unsupported: { facts: ['1870', 'Vienne'], names: [] },
    overlap: 0.21,
    warnings: ['Pas d’article Wikipédia en français'],
  })
  const at = (s) => body.indexOf(s)
  assert.ok(at(AUTO_START) === 0)
  assert.ok(at('⚠️ 1870') < at('### Texte'))
  assert.ok(at('> ⚠️ Pas d’article') < at('### Texte') || at('- ⚠️ Pas d’article') < at('### Texte'))
  assert.match(body, /21\.0 %.*seuil/)
  assert.ok(at('### Texte') < at('### Image'))
  assert.ok(at('### Image') < at('### Sources'))
  assert.ok(at('### Sources') < at('### Modèle'))
  assert.ok(at('### Modèle') < at(AUTO_END))
  assert.ok(at(AUTO_END) < at('/corrige'))
  assert.ok(at('/corrige') < at('- [ ] Faits vérifiés'))
  assert.ok(body.trimEnd().endsWith('- [ ] Faits vérifiés'))
  assert.match(body, /`\/corrige <consigne>` \(ex\. `\/corrige retire le paragraphe sur le plat`\)/)
  assert.match(body, /\*\*en dernier\*\* : cochez la case/)
  assert.match(body, /0\. \*\*choisie\*\*/)
  assert.match(body, /"imageChoice"/)
  assert.match(body, /\[Concert\]\(https:\/\/e\/1\)/)
  assert.match(body, /gemini-flash-latest/)
  assert.match(body, /\[Komitas\]\(https:\/\/fr\.wikipedia\.org\/wiki\/Komitas\) — Wikipédia fr, révision 1/)
  assert.equal(isChecked(body), false)
  assert.equal(factsChecked(body.replace('- [ ] Faits vérifiés', '- [x] Faits vérifiés')), true)
})

test('corps : rien à signaler, pas d’image', () => {
  const body = buildPrBody({ ...base, meta: meta('t', { candidates: [], imageChoice: null, image: null }) })
  assert.match(body, /Rien à signaler/)
  assert.doesNotMatch(body, /À vérifier en premier/)
  assert.match(body, /Aucune image libre/)
})

test('corps : intertitres abaissés', () => {
  const body = buildPrBody(base)
  assert.match(body, /^#### Intertitre$/m)
  assert.match(body, /^##### Sous-titre$/m)
  assert.doesNotMatch(body, /^## Intertitre$/m)
})

test('corps : noms repliés dans <details>', () => {
  const body = buildPrBody({ ...base, unsupported: { facts: [], names: ['Sayat-Nova', 'Tigran'] } })
  assert.match(body, /<details><summary>Noms à confirmer \(2\)<\/summary>[\s\S]*Sayat-Nova[\s\S]*<\/details>/)
  assert.doesNotMatch(buildPrBody(base), /<details>/)
})

test('corps : alerte éditoriale dans la liste ⚠️', () => {
  const body = buildPrBody({ ...base, editorial: ['mentionne un plat disputé'] })
  assert.match(body, /ligne éditoriale : mentionne un plat disputé/)
  assert.ok(body.indexOf('ligne éditoriale') < body.indexOf('### Texte'))
  assert.doesNotMatch(body, /Rien à signaler/)
})

test('corps : sources étiquetées par kind', () => {
  const body = buildPrBody({
    ...base,
    meta: meta('k', { sources: [
      { kind: 'hse', lang: 'hy', title: 'Կոմիտաս', url: 'https://hy.wikisource.org/x', revision: 7 },
      { kind: 'unesco', lang: 'en', title: 'Duduk', url: 'https://ich.unesco.org/x' },
    ] }),
  })
  assert.match(body, /Encyclopédie soviétique arménienne \(ՀՍՀ, Wikisource\), révision 7/)
  assert.match(body, /\[Duduk\]\(https:\/\/ich\.unesco\.org\/x\) — UNESCO/)
})

test('corps : vérification des faits illisible (null) jamais présentée comme réussie', () => {
  const body = buildPrBody({ ...base, unsupported: null, warnings: ['Un avertissement'] })
  assert.match(body, /Vérification automatique des faits indisponible \(réponse du modèle illisible\)/)
  assert.doesNotMatch(body, /Rien à signaler/)
  assert.ok(body.indexOf('### ⚠️ À vérifier en premier') < body.indexOf('Un avertissement'))
})

test('replaceAutoSection : case cochée préservée', () => {
  const body = buildPrBody(base).replace('- [ ] Faits vérifiés', '- [x] Faits vérifiés')
  const out = replaceAutoSection(body, 'NOUVEAU')
  assert.ok(out.startsWith(AUTO_START + 'NOUVEAU' + AUTO_END))
  assert.equal(out.slice(out.indexOf(AUTO_END)), body.slice(body.indexOf(AUTO_END)))
  assert.equal(isChecked(out), true)
  assert.equal(replaceAutoSection('vieux corps', 'A'), AUTO_START + 'A' + AUTO_END + 'vieux corps')
})

test('uncheck / isChecked', () => {
  const on = '- [x] Faits vérifiés'
  assert.equal(isChecked(on), true)
  assert.equal(isChecked('- [X] Faits vérifiés'), true)
  assert.equal(isChecked('- [ ] Faits vérifiés'), false)
  assert.equal(uncheck(on), '- [ ] Faits vérifiés')
  assert.equal(uncheck('a\n- [X] Faits vérifiés\nb'), 'a\n- [ ] Faits vérifiés\nb')
  assert.equal(uncheck('- [ ] Faits vérifiés'), '- [ ] Faits vérifiés')
})

test('corps sous 65 000 caractères pour un article de 1 000 mots', () => {
  const frBody = Array.from({ length: 1000 }, (_, i) => `mot${i}`).join(' ')
  assert.ok(buildPrBody({ ...base, frBody }).length < 65000)
})

test('issue d’idées : entrées prêtes à coller dans sujets.json', () => {
  const body = ideasIssueBody([{ title: 'Le tar', wikipedia_fr: 'Tar (luth)', wikipedia_en: 'Tar (lute)', keywords: ['tar'] }])
  assert.match(body, /Le tar/)
  const json = JSON.parse(body.match(/```json\n([\s\S]*?)\n```/)[1])
  assert.equal(json[0].slug, 'le-tar')
  assert.equal(json[0].status, 'pending')
})
