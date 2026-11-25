// Garde : chaque langue a une voix femme et une voix homme (choix de Nareg),
// l'alternance se fait par rang de sujet (pair = femme, impair = homme), une
// langue inconnue ou un slug absent est une ERREUR (jamais de voix par défaut),
// et la phrase de fin tient en 90 caractères avec le bon nom de chaîne par langue.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VOICES, voiceFor, subjectOrdinal } from '../scripts/voices.mjs'

const cta = JSON.parse(readFileSync(new URL('../src/shorts/cta.json', import.meta.url), 'utf8'))
const LANGS = ['fr', 'en', 'de', 'it', 'es', 'hy', 'ru']

test('VOICES : 7 langues, une femme et un homme chacune, choix de Nareg', () => {
  assert.deepEqual(VOICES, {
    fr: { female: 'Kore', male: 'Sadaltager' }, en: { female: 'Kore', male: 'Sadaltager' },
    de: { female: 'Kore', male: 'Sadaltager' }, it: { female: 'Sulafat', male: 'Sadaltager' },
    es: { female: 'Sulafat', male: 'Sadaltager' }, hy: { female: 'Sulafat', male: 'Sadaltager' },
    ru: { female: 'Kore', male: 'Sadaltager' },
  })
})

test('voiceFor alterne d’un sujet au suivant (pair = femme, impair = homme)', () => {
  assert.deepEqual(voiceFor({ lang: 'fr', ordinal: 10 }), { name: 'Kore', gender: 'female' })
  assert.deepEqual(voiceFor({ lang: 'fr', ordinal: 11 }), { name: 'Sadaltager', gender: 'male' })
  assert.equal(voiceFor({ lang: 'it', ordinal: 0 }).name, 'Sulafat')
  assert.equal(voiceFor({ lang: 'it', ordinal: 1 }).name, 'Sadaltager')
})

test('voiceFor : langue inconnue = erreur, pas de voix par défaut', () => {
  assert.throws(() => voiceFor({ lang: 'xx', ordinal: 0 }))
})

test('subjectOrdinal : ordre de publication (date puis slug), stable', () => {
  const a = [{ slug: 'b', date: '2026-11-02' }, { slug: 'a', date: '2026-11-01' }, { slug: 'c', date: '2026-11-02' }]
  assert.deepEqual(['a', 'b', 'c'].map((s) => subjectOrdinal(s, a)), [0, 1, 2])
})

test('subjectOrdinal : slug absent = erreur', () => {
  assert.throws(() => subjectOrdinal('nope', [{ slug: 'a', date: '2026-11-01' }]))
})

test('cta.json : 7 langues exactement', () => {
  assert.deepEqual(Object.keys(cta).sort(), [...LANGS].sort())
})

test('cta.json : spoken non vide, ≤ 90 caractères ; screen non vide', () => {
  for (const lang of LANGS) {
    const { spoken, screen } = cta[lang]
    assert.ok(typeof spoken === 'string' && spoken.length > 0, `${lang}.spoken vide`)
    assert.ok([...spoken].length <= 90, `${lang}.spoken : ${[...spoken].length} caractères`)
    assert.ok(typeof screen === 'string' && screen.length > 0, `${lang}.screen vide`)
  }
})

test('cta.json : chaque phrase dite nomme la bonne chaîne', () => {
  for (const lang of ['fr', 'de', 'it']) assert.ok(cta[lang].spoken.includes('Arménie Info'), lang)
  for (const lang of ['en', 'es', 'ru']) assert.ok(cta[lang].spoken.includes('Armenia News'), lang)
  assert.ok(cta.hy.spoken.includes('Արմենիա Ինֆո'), 'hy')
})
