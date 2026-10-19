import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import worker, { dispatchRequest, WORKFLOW } from '../proxy/hourly-trigger-worker.js'

// Le Worker `hourly-trigger` lance le workflow par son NOM DE FICHIER. Renommer
// hourly.yml, ou lui retirer `workflow_dispatch`, ferait répondre 404/422 à
// chaque appel : le site retomberait sur le planificateur de GitHub (5-6
// passages par jour) sans qu'aucun build ni aucun lint ne s'en plaigne.
test('le workflow visé existe et accepte workflow_dispatch', () => {
  const yml = readFileSync(new URL(`../.github/workflows/${WORKFLOW}`, import.meta.url), 'utf8')
  assert.match(yml, /^\s*workflow_dispatch:/m)
})

test('la requête vise main, avec jeton et User-Agent', async () => {
  const req = dispatchRequest('tok')
  assert.equal(req.method, 'POST')
  assert.match(req.url, /\/actions\/workflows\/hourly\.yml\/dispatches$/)
  assert.equal(req.headers.get('authorization'), 'Bearer tok')
  assert.ok(req.headers.get('user-agent'))
  assert.deepEqual(await req.json(), { ref: 'main' })
})

test('sans jeton, le cron échoue bruyamment', () => {
  assert.throws(() => dispatchRequest(undefined), /GH_TOKEN/)
})

test('une réponse autre que 204 fait échouer le cron', async () => {
  const real = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('Bad credentials', { status: 401 })
    await assert.rejects(worker.scheduled({}, { GH_TOKEN: 'x' }), /401/)
    globalThis.fetch = async () => new Response(null, { status: 204 })
    await worker.scheduled({}, { GH_TOKEN: 'x' })
  } finally {
    globalThis.fetch = real
  }
})
