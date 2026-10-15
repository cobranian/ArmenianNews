import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectPending,
  buildMessages,
  parseReply,
  applyRubrics,
  MAX_BATCH,
  BATCH_SIZE,
  classifyRubrics,
  DEFAULT_MODEL,
  FALLBACK_MODELS,
} from '../scripts/lib/classify-rubrics.mjs'

const map = {
  a: { top: { mixed: 'armenie' }, eco: 'economie' },
  b: { news: { mixed: 'diaspora' } },
}
// Les deux formes de news.json : indexée par langue (a) et liste plate (b).
const sample = () => ({
  generatedAt: '2026-10-15T00:00:00Z',
  a: {
    en: [
      { categoryKey: 'top', articles: [{ title: 'T1', url: 'u1' }, { title: 'T2', url: 'u2' }] },
      { categoryKey: 'eco', articles: [{ title: 'E1', url: 'e1' }] },
    ],
    hy: [{ categoryKey: 'top', articles: [{ title: 'T1', url: 'u1' }] }],
  },
  b: [{ sectionKey: 'news', articles: [{ title: 'N1', url: 'n1' }, { url: 'sans-titre' }] }],
})

test('collectPending : fils mixed seulement, sans doublon, hors cache, titre requis', () => {
  const p = collectPending(sample(), { u2: 'sports' }, map)
  assert.deepEqual(p, [{ url: 'u1', title: 'T1' }, { url: 'n1', title: 'N1' }])
})

test('collectPending plafonne le lot', () => {
  assert.equal(MAX_BATCH, 120)
  assert.equal(BATCH_SIZE, 40)
  assert.equal(collectPending(sample(), {}, map, 1).length, 1)
})

// Mesuré le 15 octobre 2026 en production : 80 titres d'un coup dépassaient le
// délai à chaque essai (CI et local, 90 s), 40 passaient en 3 s. D'où des lots
// de 40, chacun avec son propre délai : un lot perdu ne perd pas les autres.
test('classifyRubrics decoupe en lots de BATCH_SIZE ; un lot en echec n empeche pas les suivants', async () => {
  const titles = Array.from({ length: 50 }, (_, i) => ({ title: `T${i}`, url: `u${i}` }))
  const news = { armenpress: { en: [{ categoryKey: 'fact-check', articles: titles }] } }
  const sizes = []
  let call = 0
  const fetchImpl = async (_url, init) => {
    const n = JSON.parse(init.body).messages[1].content.split('\n').length
    sizes.push(n)
    if (call++ === 0) throw new Error('timeout')
    const out = Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 'sports']))
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(out) } }] }) }
  }
  const cache = await classifyRubrics(news, {}, { apiKey: 'k', fetchImpl, log: quiet })
  assert.deepEqual(sizes, [40, 10])
  assert.equal(Object.keys(cache).length, 10)
  assert.equal(cache.u45, 'sports')
  assert.equal(cache.u0, undefined)
})

test('buildMessages numerote a partir de 1, une ligne par titre', () => {
  const [sys, user] = buildMessages([{ url: 'x', title: 'Un\ntitre  ' }, { url: 'y', title: 'Deux' }])
  assert.equal(sys.role, 'system')
  for (const r of ['armenie', 'opinion']) assert.match(sys.content, new RegExp(r))
  assert.match(sys.content, /pas une opinion/)
  assert.equal(user.content, '1. Un titre\n2. Deux')
})

test('parseReply : JSON nu', () => {
  assert.deepEqual([...parseReply('{"1":"politique","2":"sports"}', 2)], [[0, 'politique'], [1, 'sports']])
})

// Review Focus : clôtures, texte autour, majuscules, index hors bornes, clé inconnue.
test('parseReply tolere le bavardage et rejette l invalide', () => {
  const txt = 'Voici :\n```json\n{"1": " Economie ", "2": "météo", "3": "monde", "9": "sports"}\n```'
  assert.deepEqual([...parseReply(txt, 3)], [[0, 'economie'], [2, 'monde']])
})

test('parseReply : pas de JSON, ou JSON casse → rien', () => {
  assert.equal(parseReply('désolé', 2).size, 0)
  assert.equal(parseReply('{"1": "monde"', 2).size, 0)
  assert.equal(parseReply('', 2).size, 0)
})

test('applyRubrics : cache, sinon defaut ; purge des URL sorties du flux', () => {
  const news = sample()
  const pruned = applyRubrics(news, { u1: 'politique', vieux: 'monde', n1: 'invalide' }, map)
  assert.equal(news.a.en[0].articles[0].rubric, 'politique')
  assert.equal(news.a.hy[0].articles[0].rubric, 'politique')
  assert.equal(news.a.en[0].articles[1].rubric, 'armenie')
  // Review Focus : une valeur de cache invalide retombe sur le défaut du fil.
  assert.equal(news.b[0].articles[0].rubric, 'diaspora')
  // Une rubrique fixe n'est pas touchée.
  assert.equal(news.a.en[1].articles[0].rubric, undefined)
  assert.deepEqual(pruned, { u1: 'politique', n1: 'invalide' })
})

const quiet = { log() {}, warn() {} }
const reply = (content, ok = true, status = 200) => async () => ({
  ok,
  status,
  json: async () => ({ choices: [{ message: { content } }] }),
})
// classifyRubrics lit la vraie RUBRIC_MAP : les jeux d'essai passent donc par
// une rubrique réellement fourre-tout (armenpress fact-check).
test('classifyRubrics : ajoute au cache ce que le modele a classe', async () => {
  const news = { armenpress: { en: [{ categoryKey: 'fact-check', articles: [{ title: 'T1', url: 'u1' }] }] } }
  const cache = await classifyRubrics(news, {}, { apiKey: 'k', fetchImpl: reply('{"1":"politique"}'), log: quiet })
  assert.deepEqual(cache, { u1: 'politique' })
})

test('classifyRubrics sans cle : cache inchange, aucun appel', async () => {
  let called = false
  const fetchImpl = async () => { called = true }
  const news = { armenpress: { en: [{ categoryKey: 'fact-check', articles: [{ title: 'T1', url: 'u1' }] }] } }
  const cache = await classifyRubrics(news, { x: 'monde' }, { apiKey: '', fetchImpl, log: quiet })
  assert.equal(called, false)
  assert.deepEqual(cache, { x: 'monde' })
})

test('classifyRubrics : HTTP 429 ou exception → cache inchange, pas de levee', async () => {
  const news = { armenpress: { en: [{ categoryKey: 'fact-check', articles: [{ title: 'T1', url: 'u1' }] }] } }
  assert.deepEqual(
    await classifyRubrics(news, {}, { apiKey: 'k', fetchImpl: reply('', false, 429), log: quiet }),
    {},
  )
  const boom = async () => { throw new Error('timeout') }
  assert.deepEqual(await classifyRubrics(news, {}, { apiKey: 'k', fetchImpl: boom, log: quiet }), {})
})

test('classifyRubrics : rien a classer → aucun appel', async () => {
  let called = false
  const fetchImpl = async () => { called = true }
  await classifyRubrics({ a: [] }, {}, { apiKey: 'k', fetchImpl, log: quiet })
  assert.equal(called, false)
})

test('classifyRubrics : corps de requete (models, reasoning coupe, temperature 0)', async () => {
  const news = { armenpress: { en: [{ categoryKey: 'fact-check', articles: [{ title: 'T1', url: 'u1' }] }] } }
  const bodies = []
  const fetchImpl = async (_url, init) => {
    bodies.push(JSON.parse(init.body))
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{}' } }] }) }
  }
  const saved = process.env.OPENROUTER_MODEL
  delete process.env.OPENROUTER_MODEL
  try {
    await classifyRubrics(news, {}, { apiKey: 'k', fetchImpl, log: quiet })
    await classifyRubrics(news, {}, { apiKey: 'k', model: 'x', fetchImpl, log: quiet })
  } finally {
    if (saved === undefined) delete process.env.OPENROUTER_MODEL
    else process.env.OPENROUTER_MODEL = saved
  }
  assert.deepEqual(bodies[0].models, [DEFAULT_MODEL, ...FALLBACK_MODELS])
  assert.deepEqual(bodies[1].models, ['x'])
  for (const b of bodies) {
    assert.deepEqual(b.reasoning, { enabled: false })
    assert.equal(b.temperature, 0)
  }
})

test('classifyRubrics : avertit si le modele impose n est pas :free', async () => {
  const news = { armenpress: { en: [{ categoryKey: 'fact-check', articles: [{ title: 'T1', url: 'u1' }] }] } }
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{}' } }] }) })
  const run = async (model) => {
    const warns = []
    const log = { log() {}, warn: (m) => warns.push(m) }
    await classifyRubrics(news, {}, { apiKey: 'k', model, fetchImpl, log })
    return warns.filter((w) => w.includes('pas un modèle :free'))
  }
  const saved = process.env.OPENROUTER_MODEL
  delete process.env.OPENROUTER_MODEL
  try {
    assert.equal((await run('x')).length, 1)
    assert.equal((await run('x:free')).length, 0)
    assert.equal((await run(undefined)).length, 0)
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_MODEL = saved
  }
})
