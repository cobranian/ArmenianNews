import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chat, llmConfig, DEFAULT_BASE_URL, DEFAULT_MODEL } from '../scripts/lib/culture-llm.mjs'

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
