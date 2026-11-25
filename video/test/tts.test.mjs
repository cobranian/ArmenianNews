// Garde : le client Gemini TTS (fetch factice, jamais le réseau). Un 429 « per day »
// bascule sur le secours sans réessayer le principal ; un 429 « per minute »
// attend puis réessaie le même modèle ; trois échecs sur les deux modèles rejettent.
import test from 'node:test'
import assert from 'node:assert/strict'
import { requestBody, extractAudio, isDailyQuota, synthesize, PRIMARY, FALLBACK, STYLE } from '../scripts/tts.mjs'

const wavB64 = Buffer.from('RIFFfake').toString('base64')
const okRes = () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: wavB64 }] }] }) })
const errRes = (status, body) => ({ ok: false, status, text: async () => body })
const seq = (...rs) => { const calls = []; const f = async (url, init) => { calls.push(JSON.parse(init.body).model); return rs[Math.min(calls.length - 1, rs.length - 1)] }; f.calls = calls; return f }
const noSleep = async () => {}

test('requestBody : modèle, voix et style commun', () => {
  const b = requestBody({ text: 'Bonjour', voice: 'Kore', model: PRIMARY })
  assert.equal(b.model, PRIMARY)
  assert.equal(b.generation_config.speech_config[0].voice, 'Kore')
  assert.equal(b.input[0].content[0].annotations[0].style, STYLE)
  assert.equal(b.input[0].content[0].text, 'Bonjour')
})

test('extractAudio : décode l\'audio, null sans audio', () => {
  assert.equal(extractAudio({ steps: [{ content: [{ type: 'audio', data: wavB64 }] }] }).toString(), 'RIFFfake')
  assert.equal(extractAudio({ steps: [{ content: [{ type: 'text', text: 'x' }] }] }), null)
  assert.equal(extractAudio({}), null)
})

test('isDailyQuota : seulement un 429 « per day »', () => {
  assert.equal(isDailyQuota(429, 'limit: 100 requests per day'), true)
  assert.equal(isDailyQuota(429, 'limit: 10 requests per minute'), false)
  assert.equal(isDailyQuota(500, 'per day'), false)
})

test('synthesize : 429 per day sur le principal → un seul appel puis le secours', async () => {
  const f = seq(errRes(429, 'limit: 100 requests per day. Please retry in 10h'), okRes())
  const r = await synthesize({ text: 't', voice: 'Kore', fetch: f, sleep: noSleep, apiKey: 'k' })
  assert.deepEqual(f.calls, [PRIMARY, FALLBACK])
  assert.equal(r.model, FALLBACK)
})

test('synthesize : 429 per minute → attente puis même modèle', async () => {
  const f = seq(errRes(429, 'limit: 10 requests per minute'), okRes())
  const waits = []
  const r = await synthesize({ text: 't', voice: 'Kore', fetch: f, sleep: async (ms) => waits.push(ms), apiKey: 'k' })
  assert.deepEqual(f.calls, [PRIMARY, PRIMARY])
  assert.equal(r.model, PRIMARY)
  assert.equal(waits.length, 1)
})

test('synthesize : échecs sur les deux modèles → rejet', async () => {
  const f = seq(errRes(500, 'boom'))
  await assert.rejects(synthesize({ text: 't', voice: 'Kore', fetch: f, sleep: noSleep, apiKey: 'k' }), /synthèse impossible/)
  assert.equal(f.calls.filter((m) => m === PRIMARY).length, 3)
  assert.equal(f.calls.filter((m) => m === FALLBACK).length, 3)
})
