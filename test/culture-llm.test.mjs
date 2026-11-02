import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  chat, chatDraft, chatResilient, isUnavailable, isKeyRefused, explain, llmConfig, DEFAULT_BASE_URL, DEFAULT_MODEL,
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

test('isUnavailable : 402/429/404/503/timeout oui, 401/400/réponse vide non', () => {
  for (const s of [402, 429, 404, 503, 500]) assert.equal(isUnavailable(httpErr(s)), true, String(s))
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
  assert.deepEqual(CULTURE_FALLBACK_MODELS, [
    'nvidia/nemotron-3.5-super-vl:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'google/gemma-4-31b-it:free',
  ])
  for (const m of CULTURE_FALLBACK_MODELS) assert.match(m, /:free$/, `${m} consommerait des crédits`)
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
  assert.equal(r.text, 'repli')
  assert.equal(r.model, CULTURE_FALLBACK_MODELS[0])
  assert.equal(r.fellBack, true)
  assert.equal(r.primaryError.status, 429)
  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /generativelanguage/)
  assert.equal(calls[1].auth, 'Bearer OR_KEY')
  assert.match(calls[1].url, /^https:\/\/openrouter\.ai\/api\/v1\/chat\/completions$/)
})

// Le cas réel du 2 nov. 2026 : crédit prépayé Gemini à zéro.
test('chatDraft : Gemini 402 (crédit épuisé) → repli OpenRouter', async () => {
  const calls = []
  const r = await chatDraft({ messages, env: { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }, fetchImpl: router(402, calls) })
  assert.equal(r.fellBack, true)
  assert.equal(r.primaryError.status, 402)
})

test('chat : raisonnement coupé sur OpenRouter, jamais envoyé à Gemini', async () => {
  const seen = {}
  const ok = { choices: [{ message: { content: 'ok' } }] }
  await chat({ messages, baseUrl: OPENROUTER_BASE_URL, model: 'm', apiKey: 'k', fetchImpl: fake(200, ok, seen) })
  assert.deepEqual(JSON.parse(seen.init.body).reasoning, { enabled: false })
  await chat({ messages, baseUrl: DEFAULT_BASE_URL, model: 'm', apiKey: 'k', fetchImpl: fake(200, ok, seen) })
  assert.equal('reasoning' in JSON.parse(seen.init.body), false)
})

test('chatDraft : Gemini disponible → pas de repli', async () => {
  const r = await chatDraft({ messages, env: { GEMINI_API_KEY: 'G' }, fetchImpl: router(200) })
  assert.deepEqual(r, { text: 'gemini', model: DEFAULT_MODEL, fellBack: false, primaryError: null })
})

// Clé Gemini révoquée ou facturation coupée : le secours est un AUTRE
// fournisseur, avec sa propre clé — il peut répondre.
test('chatDraft : Gemini 401/403 → repli chez OpenRouter', async () => {
  for (const status of [401, 403]) {
    const r = await chatDraft({ messages, env: { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }, fetchImpl: router(status) })
    assert.equal(r.fellBack, true, String(status))
    assert.equal(r.primaryError.status, status)
  }
})

test('chatDraft : 401 quand le principal EST OpenRouter → rejette sans repli', async () => {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push(url)
    return { ok: false, status: 401, json: async () => ({}) }
  }
  await assert.rejects(
    chatDraft({ messages, env: { ARTICLES_BASE_URL: OPENROUTER_BASE_URL, OPENROUTER_API_KEY: 'OR' }, fetchImpl }),
    (e) => e.status === 401,
  )
  assert.equal(calls.length, 1)
})

test('chatDraft : 400 (requête fautive) → rejette sans repli', async () => {
  const calls = []
  await assert.rejects(
    chatDraft({ messages, env: { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }, fetchImpl: router(400, calls) }),
    (e) => e.status === 400,
  )
  assert.equal(calls.length, 1)
})

test('chatResilient : sticky — après un repli, les appels suivants vont droit au secours', async () => {
  const calls = []
  const env = { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }
  const sticky = {}
  const a = await chatResilient({ messages, env, fetchImpl: router(402, calls), sticky })
  const b = await chatResilient({ messages, env, fetchImpl: router(402, calls), sticky })
  assert.equal(sticky.model, CULTURE_FALLBACK_MODELS[0])
  assert.equal(a.model, b.model, 'le même modèle pour toutes les langues')
  assert.equal(b.primaryError.status, 402)
  assert.equal(calls.filter((c) => c.url.includes('generativelanguage')).length, 1, 'Gemini mort n’est plus réessayé')
})

test('chatResilient : tout tombe → l’erreur porte la cause du PRINCIPAL', async () => {
  const fetchImpl = async (url) => ({ ok: false, status: url.includes('openrouter') ? 429 : 402, json: async () => ({}) })
  await assert.rejects(
    chatResilient({ messages, env: { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }, fetchImpl }),
    (e) => e.status === 429 && e.primaryError?.status === 402,
  )
})

test('explain : un 402 dit qu’il faut payer, pas « indisponible »', () => {
  assert.match(explain(httpErr(402)), /crédit épuisé.*recharg/)
  assert.match(explain(httpErr(401)), /clé refusée/)
  assert.match(explain(httpErr(403)), /clé refusée/)
  assert.match(explain(httpErr(429)), /quota/)
  assert.match(explain(httpErr(404)), /retiré/)
  assert.match(explain(httpErr(503)), /panne/)
  assert.equal(isKeyRefused(httpErr(403)), true)
  assert.equal(isKeyRefused(httpErr(402)), false)
})

test('chatDraft : sans OPENROUTER_API_KEY → rejette l’erreur Gemini', async () => {
  const calls = []
  await assert.rejects(
    chatDraft({ messages, env: { GEMINI_API_KEY: 'G' }, fetchImpl: router(429, calls) }),
    (e) => e.status === 429,
  )
  assert.equal(calls.length, 1)
})

test('chatDraft : replis indisponibles → suivant ; tout échoue → dernière erreur', async () => {
  const calls = []
  const f = async (url, init) => {
    const model = JSON.parse(init.body).model
    calls.push(model)
    if (!url.includes('openrouter.ai') || model !== CULTURE_FALLBACK_MODELS.at(-1)) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({ model, choices: [{ message: { content: 'deux' } }] }) }
  }
  const env = { GEMINI_API_KEY: 'G', OPENROUTER_API_KEY: 'OR' }
  const r = await chatDraft({ messages, env, fetchImpl: f })
  assert.equal(r.model, CULTURE_FALLBACK_MODELS.at(-1))
  assert.deepEqual(calls.slice(1), CULTURE_FALLBACK_MODELS)
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
  assert.deepEqual({ ...r, primaryError: undefined }, { text: 'repli', model: CULTURE_FALLBACK_MODELS[0], fellBack: true, primaryError: undefined })
  assert.equal(r.primaryError.empty, true)
  assert.equal(calls.length, 2)
})

test('culture-translate n’importe pas chatDraft (traduction : Gemini seul)', async () => {
  const src = await readFile(new URL('../scripts/culture-translate.mjs', import.meta.url), 'utf-8')
  assert.doesNotMatch(src, /chatDraft/)
})
