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
  // Les formes réelles d'un corps 429 Gemini (revue finale du 25 nov. 2026).
  assert.equal(isDailyQuota(429, '{"quotaId": "GenerateRequestsPerDayPerProjectPerModel"}'), true)
  assert.equal(isDailyQuota(429, 'quota_metric: generate_requests_per_day'), true)
  assert.equal(isDailyQuota(429, '{"quotaId": "GenerateRequestsPerMinutePerProjectPerModel"}'), false)
})

// Modèle retiré : 404 sur le principal → le secours aussitôt, sans attente.
test('synthesize : 404 sur le principal → secours immédiat', async () => {
  const f = seq(errRes(404, 'model not found'), okRes())
  const waits = []
  const r = await synthesize({ text: 't', voice: 'Kore', fetch: f, sleep: async (ms) => waits.push(ms), apiKey: 'k' })
  assert.deepEqual(f.calls, [PRIMARY, FALLBACK])
  assert.equal(r.model, FALLBACK)
  assert.deepEqual(waits, [])
})

test('synthesize : 404 sur les deux modèles → rejet, statut et extrait sans la clé', async () => {
  const f = seq(errRes(404, 'model not found for SECRET-123'))
  const waits = []
  await assert.rejects(
    synthesize({ text: 't', voice: 'Kore', fetch: f, sleep: async (ms) => waits.push(ms), apiKey: 'SECRET-123' }),
    (e) => {
      assert.match(e.message, /HTTP 404 model not found for \*\*\*/)
      assert.doesNotMatch(e.message, /SECRET-123/)
      return true
    },
  )
  assert.deepEqual(f.calls, [PRIMARY, FALLBACK])
  assert.deepEqual(waits, [])
})

for (const status of [400, 401, 403]) {
  test(`synthesize : HTTP ${status} → arrêt immédiat, un seul appel, sans la clé dans le message`, async () => {
    const f = seq(errRes(status, `{"error": {"message": "refusé pour la clé SECRET-123"}}`), okRes())
    const waits = []
    await assert.rejects(
      synthesize({ text: 't', voice: 'Kore', fetch: f, sleep: async (ms) => waits.push(ms), apiKey: 'SECRET-123' }),
      (e) => {
        assert.match(e.message, new RegExp(`HTTP ${status}`))
        assert.match(e.message, /refusé pour la clé \*\*\*/)
        assert.doesNotMatch(e.message, /SECRET-123/)
        return true
      },
    )
    assert.deepEqual(f.calls, [PRIMARY])
    assert.deepEqual(waits, [])
  })
}

test('synthesize : 5xx puis succès → réessayé sur le même modèle', async () => {
  const f = seq(errRes(503, 'unavailable'), okRes())
  const r = await synthesize({ text: 't', voice: 'Kore', fetch: f, sleep: noSleep, apiKey: 'k' })
  assert.deepEqual(f.calls, [PRIMARY, PRIMARY])
  assert.equal(r.model, PRIMARY)
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
