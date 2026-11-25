// Garde : voice.mjs. Les 8 textes = 7 `spoken` + la phrase de fin ; un fait sans
// `spoken` est une erreur ; un cache n'est réutilisé que si texte ET voix
// concordent (reprise d'un run coupé par le quota) ; une langue absente des
// données sort en 0 sans le moindre appel réseau.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { voiceLines, voiceShort } from '../scripts/voice.mjs'

const cta = { fr: { spoken: 'Fin fr', screen: 'x' } }
const facts = (n = 7) => Array.from({ length: n }, (_, i) => ({ text: `T${i}`, spoken: `Dit ${i}` }))
const articles = [{ slug: 'a', date: '2026-01-01' }, { slug: 'b', date: '2026-01-02' }]
const wavB64 = Buffer.from('RIFFfake').toString('base64')

function setup(data) {
  const dir = mkdtempSync(join(tmpdir(), 'voice-'))
  mkdirSync(join(dir, 'src/shorts/data'), { recursive: true })
  writeFileSync(join(dir, 'src/shorts/data/b.json'), JSON.stringify(data))
  writeFileSync(join(dir, 'src/shorts/cta.json'), JSON.stringify(cta))
  return dir
}
const fakeFetch = () => {
  const f = async (url, init) => {
    f.calls.push(JSON.parse(init.body))
    return { ok: true, status: 200, text: async () => JSON.stringify({ steps: [{ content: [{ type: 'audio', data: wavB64 }] }] }) }
  }
  f.calls = []
  return f
}
const base = { slug: 'b', lang: 'fr', articles, sleep: async () => {}, duration: () => 4.5 }

test('voiceLines : 7 spoken puis la phrase de fin', () => {
  const l = voiceLines({ data: { fr: { facts: facts() } }, lang: 'fr', cta })
  assert.equal(l.length, 8)
  assert.deepEqual(l.slice(0, 7), facts().map((f) => f.spoken))
  assert.equal(l[7], 'Fin fr')
})

test('voiceLines : un fait sans spoken lève', () => {
  const f = facts(); delete f[3].spoken
  assert.throws(() => voiceLines({ data: { fr: { facts: f } }, lang: 'fr', cta }), /fait 3/)
})

test('voiceShort : écrit 8 WAV et le bloc voice (ordinal 1 → voix homme)', async () => {
  const dir = setup({ fr: { facts: facts() } })
  const f = fakeFetch()
  const r = await voiceShort({ ...base, dir, fetch: f })
  assert.equal(f.calls.length, 8)
  assert.equal(f.calls[0].generation_config.speech_config[0].voice, 'Sadaltager')
  const d = JSON.parse(readFileSync(join(dir, 'src/shorts/data/b.json'), 'utf8'))
  assert.equal(d.fr.voice.gender, 'male')
  assert.equal(d.fr.voice.lines.length, 8)
  assert.deepEqual(d.fr.voice.lines[7], { file: 'voice/b/fr/7.wav', seconds: 4.5 })
  assert.ok(existsSync(join(dir, 'public/voice/b/fr/7.wav')))
  assert.equal(r.skipped, false)
})

test('synthesize reprend depuis le cache', async () => {
  const dir = setup({ fr: { facts: facts() } })
  const f1 = fakeFetch()
  await voiceShort({ ...base, dir, fetch: f1 })
  const f2 = fakeFetch()
  await voiceShort({ ...base, dir, fetch: f2 })
  assert.equal(f2.calls.length, 0)
})

test('cache : texte modifié ou voix changée → la phrase est refaite', async () => {
  const dir = setup({ fr: { facts: facts() } })
  await voiceShort({ ...base, dir, fetch: fakeFetch() })
  const changed = facts(); changed[2].spoken = 'Autre texte'
  writeFileSync(join(dir, 'src/shorts/data/b.json'), JSON.stringify({ fr: { facts: changed } }))
  const f2 = fakeFetch()
  await voiceShort({ ...base, dir, fetch: f2 })
  assert.equal(f2.calls.length, 1)
  const f3 = fakeFetch() // autre rang → autre voix : tout est refait
  await voiceShort({ ...base, dir, fetch: f3, ordinal: 0 })
  assert.equal(f3.calls.length, 8)
})

test('pause de 6,5 s entre deux vraies requêtes seulement', async () => {
  const dir = setup({ fr: { facts: facts() } })
  const waits = []
  await voiceShort({ ...base, dir, fetch: fakeFetch(), sleep: async (ms) => waits.push(ms) })
  assert.deepEqual(waits, Array(7).fill(6500))
  waits.length = 0
  await voiceShort({ ...base, dir, fetch: fakeFetch(), sleep: async (ms) => waits.push(ms) })
  assert.deepEqual(waits, [])
})

test('voice.mjs ignore une langue absente des données', async () => {
  const dir = setup({ fr: { facts: facts() } })
  const f = fakeFetch()
  const r = await voiceShort({ ...base, dir, lang: 'es', fetch: f })
  assert.equal(r.skipped, true)
  assert.equal(f.calls.length, 0)
})
