import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDraftMessages, buildClaimsMessages, buildTranslateMessages, buildIdeasMessages,
  parseArticleJson, parseClaims, parseIdeas, findUnsupported, MAX_EXTRACT,
} from '../scripts/lib/culture-prompts.mjs'

const topic = { slug: 'komitas', title: 'Komitas' }
const sources = [{ lang: 'fr', title: 'Komitas', extract: 'Komitas est né en 1869. ' + 'x'.repeat(MAX_EXTRACT) }]

test('brouillon : règles, sources tronquées, faits, événement', () => {
  const [sys, user] = buildDraftMessages({ topic, sources, facts: ['Naissance : 1869-10-08'], event: { title: 'Concert', date: '2026-10-25T20:00', location: 'Genève' } })
  assert.match(sys.content, /UNIQUEMENT les faits/)
  assert.match(sys.content, /700 à 1000 mots/)
  assert.match(sys.content, /"title"/)
  assert.match(user.content, /SUJET : Komitas/)
  assert.match(user.content, /Naissance : 1869-10-08/)
  assert.match(user.content, /« Concert », le 2026-10-25, Genève/)
  assert.ok(user.content.length < MAX_EXTRACT + 2000, 'extrait tronqué')
})

test('parseArticleJson : clôtures, texte autour, description rognée', () => {
  const raw = 'Voici :\n```json\n{"title":" Komitas ","description":"' + 'mot '.repeat(60) + '","body":"A\\n\\n## B"}\n```\nFin.'
  const a = parseArticleJson(raw)
  assert.equal(a.title, 'Komitas')
  assert.ok(a.description.length <= 160 && a.description.endsWith('…'))
  assert.equal(a.body, 'A\n\n## B')
})

test('parseArticleJson : réponse inexploitable → null', () => {
  for (const bad of ['', 'pas de json', '{"title":"t"}', '{"title":"t","description":"d","body":""}', '{cassé'])
    assert.equal(parseArticleJson(bad), null, bad)
})

test('parseClaims : tableau, dédoublonné, borné', () => {
  assert.deepEqual(parseClaims('```json\n["1869", "Kütahya", "1869", 5, ""]\n```'), ['1869', 'Kütahya'])
  assert.equal(parseClaims('rien'), null)
  assert.deepEqual(parseClaims('[]'), [])
})

test('findUnsupported : chiffres exacts, noms pliés, arménien et russe', () => {
  const src = ['Komitas est né en 1869 à Kütahya. Կոմիտաս. Комитас умер в Париже.']
  assert.deepEqual(findUnsupported(['1869', 'Kutahya', 'Կոմիտաս', 'Париже'], src), [])
  assert.deepEqual(findUnsupported(['1870', '186', 'Erevan', 'Вена'], src), ['1870', '186', 'Erevan', 'Вена'])
  assert.deepEqual(findUnsupported(['Le', 'à'], src), [], 'mots trop courts ignorés')
})

test('findUnsupported : mots entiers, expressions à plusieurs nombres', () => {
  assert.deepEqual(findUnsupported(['Ani'], ['Aniv partie']), ['Ani'])
  assert.deepEqual(findUnsupported(['Ere'], ['Erevan']), ['Ere'])
  assert.deepEqual(findUnsupported(['1 200'], ['1 et 200']), ['1 200'])
  assert.deepEqual(findUnsupported(['1 200'], ['soit 1 200 fidèles']), [])
  assert.deepEqual(findUnsupported(['Mesrop Machtots'], ['Mesrop Machtots invente']), [])
})

test('findUnsupported : espaces et tirets typographiques, ponctuation finale', () => {
  assert.deepEqual(findUnsupported(['1 200'], ['soit 1\u202F200 fidèles']), [])
  assert.deepEqual(findUnsupported(['1 200'], ['soit 1\u00A0200 fidèles']), [])
  assert.deepEqual(findUnsupported(['1869\u20131935'], ['Komitas (1869-1935)']), [])
  assert.deepEqual(findUnsupported(['1869-1935'], ['Komitas (1869\u20141935)']), [])
  assert.deepEqual(findUnsupported(['1 200.'], ['soit 1 200 fidèles']), [])
  assert.deepEqual(findUnsupported(['Kütahya !'], ['né à Kütahya']), [])
})

test('findUnsupported : un nombre accompagné de mots exige aussi les mots', () => {
  const src = ['Komitas est né en 1935 à Kütahya.']
  assert.deepEqual(findUnsupported(['Paris 1935'], src), ['Paris 1935'])
  assert.deepEqual(findUnsupported(['Kütahya 1935'], src), [])
  assert.deepEqual(findUnsupported(['en 1935'], src), [], 'mots courts ignorés')
  assert.deepEqual(findUnsupported(['Kütahya 1936'], src), ['Kütahya 1936'])
})

test('traduction : langue cible nommée, fidélité, JSON du texte relu', () => {
  const [sys, user] = buildTranslateMessages({ lang: 'hy', title: 'T', description: 'D', body: '## B' })
  assert.match(sys.content, /arménien oriental/)
  assert.match(sys.content, /n'ajoute, ne retire/)
  assert.deepEqual(JSON.parse(user.content), { title: 'T', description: 'D', body: '## B' })
})

test('idées : titres existants exclus, analyse tolérante', () => {
  const [, user] = buildIdeasMessages(['Komitas'])
  assert.match(user.content, /Komitas/)
  const ideas = parseIdeas('[{"title":"Le tar","wikipedia_fr":"Tar (luth)","wikipedia_en":"Tar (lute)","keywords":["tar"]},{"title":""}]')
  assert.equal(ideas.length, 1)
  assert.equal(ideas[0].wikipedia_en, 'Tar (lute)')
  assert.deepEqual(buildClaimsMessages('x')[1].content, 'x')
})
