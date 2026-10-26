import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  chat, chatDraft, isUnavailable, llmConfig, DEFAULT_BASE_URL, DEFAULT_MODEL,
  CULTURE_FALLBACK_MODELS, OPENROUTER_BASE_URL,
} from '../scripts/lib/culture-llm.mjs'

const fake = (status, body, seen = {}) => async (url, init) => {
  seen.url = url; seen.init = init
  return { ok: status === 200, status, json: async () => body }
}

test('llmConfig : défauts Gemini, surcharges, clé dédiée prioritaire', () => {
  assert.deepEqual(llmConfig({ GEMINI_API_KEY: 'g' }), { baseUrl: DEFAULT_BASE_URL, model: DEFAULT_MODEL, apiKey: 'g' })
  assert.deepEqual(
    llmConfig({ ARTICLES_BASE_URL: 'https://openrouter.ai/api/v1', ARTICLES_MODEL: 'x', ARTICLES_API_KEY: 'a', GEMINI_API_KEY: 'g' }),
    { baseUrl: 'https://openrouter.ai/api/v1', model: 'x', apiKey: 'a' },
  )
})

test('llmConfig : pointé sur OpenRouter, la clé OpenRouter est prise, jamais la clé Gemini', () => {
  const env = { ARTICLES_BASE_URL: 'https://openrouter.ai/api/v1', OPENROUTER_API_KEY: 'o', GEMINI_API_KEY: 'g' }
  assert.equal(llmConfig(env).apiKey, 'o')
  assert.equal(llmConfig({ ...env, OPENROUTER_API_KEY: '' }).apiKey, '')
  assert.equal(llmConfig({ OPENROUTER_API_KEY: 'o', GEMINI_API_KEY: 'g' }).apiKey, 'g')
})

test('chat : URL composée, en-têtes, modèle réellement servi', async () => {
  const seen = {}
  const r = await chat({
    messages: [{ role: 'user', content: 'x' }], baseUrl: 'https://h/v1beta/openai', model: 'm', apiKey: 'k',
    fetchImpl: fake(200, { model: 'm-002', choices: [{ message: { content: 'ok' } }] }, seen),
  })
  assert.deepEqual(r, { text: 'ok', model: 'm-002' })
  assert.equal(seen.url, 'https://h/v1beta/openai/chat/completions')
  assert.equal(seen.init.headers.Authorization, 'Bearer k')
  assert.equal(JSON.parse(seen.init.body).model, 'm')
})

test('chat : 429, réponse vide, clé absente → erreur sans la clé', async () => {
  const args = { messages: [], baseUrl: 'https://h/', model: 'm', apiKey: 'SECRET' }
  await assert.rejects(chat({ ...args, fetchImpl: fake(429, {}) }), (e) => /HTTP 429/.test(e.message) && !e.message.includes('SECRET'))
  await assert.rejects(chat({ ...args, fetchImpl: fake(200, { choices: [{ message: { content: ' ' } }] }) }), /vide/)
  await assert.rejects(chat({ ...args, apiKey: '' }), /clé API absente/)
})

const httpErr = (status) => Object.assign(new Error(`HTTP ${status} (m)`), { status })

test('isUnavailable : 429/404/503/timeout oui, 401/400/réponse vide non', () => {
  for (const s of [429, 404, 503, 500]) assert.equal(isUnavailable(httpErr(s)), true, String(s))
  assert.equal(isUnavailable(Object.assign(new Error('t'), { name: 'TimeoutError' })), true)
  assert.equal(isUnavailable(Object.assign(new Error('a'), { name: 'AbortError' })), true)
  for (const s of [400, 401, 403]) assert.equal(isUnavailable(httpErr(s)), false, String(s))
  assert.equal(isUnavailable(new Error('réponse vide (m)')), false)
  // Panne réseau, sans statut HTTP : undici lève TypeError « fetch failed ».
  assert.equal(isUnavailable(new TypeError('fetch failed')), true)
  for (const code of ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'])
    assert.equal(isUnavailable(Object.assign(new Error('x'), { cause: { code } })), true, code)
  assert.equal(isUnavailable(Object.assign(new Error('x'), { cause: { code: 'ERR_INVALID_URL' } })), false)
  assert.equal(isUnavailable(new TypeError('x is not a function')), false, 'un bug n’est pas une panne')
})

test('chat : l’erreur HTTP porte status', async () => {
  await assert.rejects(
    chat({ messages: [], baseUrl: 'https://h/', model: 'm', apiKey: 'k', fetchImpl: fake(503, {}) }),
    (e) => e.status === 503,
  )
})

test('CULTURE_FALLBACK_MODELS : ids :free sur OpenRouter', () => {
  assert.deepEqual(CULTURE_FALLBACK_MODELS, ['nvidia/nemotron-3-ultra-550b-a55b:free', 'google/gemma-4-31b-it:free'])
  assert.equal(OPENROUTER_BASE_URL, 'https://openrouter.ai/api/v1/')
})

// Faux serveur : Gemini répond `geminiStatus`, OpenRouter sert le modèle demandé.
const router = (geminiStatus, calls = []) => async (url, init) => {
  const model = JSON.parse(init.body).model
  calls.push({ url, auth: init.headers.Authorization, model })
  if (url.includes('openrouter.ai')) {
    return { ok: true, status: 200, json: async () => ({ model, choices: [{ message: { content: 'repli' } }] }) }
  }
  return { ok: geminiStatus === 200, status: geminiStatus, json: async () => ({ choices: [{ message: { content: 'gemini' } }] }) }
}
const messages = [{ role: 'user', content: 'x' }]

test('chatDraft : Gemini 429 → premier repli OpenRouter avec la clé OpenRouter', async () => {
  const calls = []
  const r = await chatDraft({
    messages, env: { GEMINI_API_KEY: 'G_KEY', OPENROUTER_API_KEY: 'OR_KEY' }, fetchImpl: router(429, calls),
  })
  assert.deepEqual(r, { text: 'repli', model: CULTURE_FALLBACK_MODELS[0], fellBack: true })
  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /generativelanguage/)
  assert.equal(calls[1].auth, 'Bearer OR_KEY')
  assert.match(calls[1].url, /^https:\/\/openrouter\.ai\/api\/v1\/chat\/completions$/)
})

test('chatDraft : Gemini disponible → pas de repli', async () => {
  const r = await chatDraft({ messages, env: { GEMINI_API_KEY: 'G' }, fetchImpl: router(200) })
  assert.deepEqual(r, { text: 'gemini', model: DEFAULT_MODEL, fellBack: false })
})

test('chatDraft : Gemini 401 → rejette sans repli', async () => {
  const calls = []
  await assert.rejects(
    chatDraft({ messages, env: { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }, fetchImpl: router(401, calls) }),
    (e) => e.status === 401,
  )
  assert.equal(calls.some((c) => c.url.includes('openrouter.ai')), false)
})

test('chatDraft : sans OPENROUTER_API_KEY → rejette l’erreur Gemini', async () => {
  const calls = []
  await assert.rejects(
    chatDraft({ messages, env: { GEMINI_API_KEY: 'G' }, fetchImpl: router(429, calls) }),
    (e) => e.status === 429,
  )
  assert.equal(calls.length, 1)
})

test('chatDraft : premier repli indisponible → second repli ; tout échoue → dernière erreur', async () => {
  const calls = []
  const f = async (url, init) => {
    const model = JSON.parse(init.body).model
    calls.push(model)
    if (!url.includes('openrouter.ai') || model === CULTURE_FALLBACK_MODELS[0]) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({ model, choices: [{ message: { content: 'deux' } }] }) }
  }
  const env = { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }
  const r = await chatDraft({ messages, env, fetchImpl: f })
  assert.equal(r.model, CULTURE_FALLBACK_MODELS[1])
  const down = async () => ({ ok: false, status: 429, json: async () => ({}) })
  await assert.rejects(chatDraft({ messages, env, fetchImpl: down }), (e) => e.status === 429 && /google\/gemma/.test(e.message))
})

test('chat : réponse vide → empty, finish_reason dans le message', async () => {
  const args = { messages: [], baseUrl: 'https://h/', model: 'm', apiKey: 'k' }
  await assert.rejects(
    chat({ ...args, fetchImpl: fake(200, { choices: [{ message: { content: null }, finish_reason: 'content_filter' }] }) }),
    (e) => e.empty === true && /finish_reason=content_filter/.test(e.message),
  )
})

test('chatDraft : Gemini rend une réponse vide → repli OpenRouter', async () => {
  const calls = []
  const f = async (url, init) => {
    const model = JSON.parse(init.body).model
    calls.push(url)
    if (!url.includes('openrouter.ai')) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '' }, finish_reason: 'stop' }] }) }
    return { ok: true, status: 200, json: async () => ({ model, choices: [{ message: { content: 'repli' } }] }) }
  }
  const r = await chatDraft({ messages, env: { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }, fetchImpl: f })
  assert.deepEqual(r, { text: 'repli', model: CULTURE_FALLBACK_MODELS[0], fellBack: true })
  assert.equal(calls.length, 2)
})

test('culture-translate n’importe pas chatDraft (traduction : Gemini seul)', async () => {
  const src = await readFile(new URL('../scripts/culture-translate.mjs', import.meta.url), 'utf-8')
  assert.doesNotMatch(src, /chatDraft/)
})
