import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { selectArticles } from '../scripts/lib/brief-select.mjs'
import {
  buildBriefMessages,
  parseBrief,
  generateBriefs,
  MAX_TOPICS,
} from '../scripts/lib/brief-generate.mjs'

const articles = [
  { id: 1, source: 'armenpress', rubric: 'politique', title: 'A', url: 'https://a/1', date: 'x' },
  { id: 2, source: 'civilnet', rubric: 'politique', title: 'B', url: 'https://b/2', date: 'x' },
  { id: 3, source: 'courrier', rubric: 'economie', title: 'C', url: 'https://c/3', date: 'x' },
]
const topic = (ids, extra = {}) => ({ title: 'Sujet', text: 'Texte.', rubric: 'politique', ids, ...extra })

test('buildBriefMessages : langue cible, ids, sources et rubriques', () => {
  const [sys, user] = buildBriefMessages('ru', articles)
  assert.equal(sys.role, 'system')
  assert.match(sys.content, /russe/)
  assert.match(sys.content, /JSON/)
  assert.match(user.content, /^1\. \[armenpress · politique\] A$/m)
  assert.match(user.content, /^3\. \[courrier · economie\] C$/m)
})

test('parseBrief : JSON entouré de texte, ids en chaînes, doublons', () => {
  const reply =
    'Voici :\n```json\n' +
    JSON.stringify({
      intro: ' Intro  du jour ',
      topics: [topic(['1', 2, 2, 1]), topic([3], { rubric: 'Economie' }), topic([2])],
    }) +
    '\n```'
  const b = parseBrief(reply, articles)
  assert.equal(b.intro, 'Intro du jour')
  assert.equal(b.topics.length, 3)
  assert.deepEqual(
    b.topics[0].sources,
    [
      { source: 'armenpress', url: 'https://a/1', title: 'A' },
      { source: 'civilnet', url: 'https://b/2', title: 'B' },
    ],
  )
  assert.equal(b.topics[1].rubric, 'economie')
})

test('parseBrief : aucune URL ne vient du modèle', () => {
  const reply = JSON.stringify({
    topics: [topic([1], { url: 'https://evil' }), topic([2]), topic([3]), topic([99])],
  })
  const b = parseBrief(reply, articles)
  assert.equal(b.topics.length, 3, 'le sujet à id inconnu est retiré')
  assert.ok(!JSON.stringify(b).includes('evil'))
})

test('parseBrief : rubrique inconnue → null, plafond de sujets', () => {
  const many = Array.from({ length: MAX_TOPICS + 3 }, () => topic([1], { rubric: 'météo' }))
  const b = parseBrief(JSON.stringify({ intro: 'i', topics: many }), articles)
  assert.equal(b.topics.length, MAX_TOPICS)
  assert.equal(b.topics[0].rubric, null)
})

test('parseBrief : rejets', () => {
  assert.equal(parseBrief('pas de JSON', articles), null)
  assert.equal(parseBrief('{ cassé', articles), null)
  assert.equal(parseBrief(JSON.stringify({ topics: [topic([1]), topic([2])] }), articles), null)
  assert.equal(parseBrief(JSON.stringify({ topics: [topic([]), topic([1]), topic([2])] }), articles), null)
  assert.equal(parseBrief(undefined, articles), null)
})

// ---- generateBriefs, réseau simulé ----

const NOW = new Date('2026-10-16T05:00:00Z') // 09:00 à Erevan
const recent = (i) => ({ title: `T${i}`, url: `https://x/${i}`, date: '2026-10-16T04:00:00Z' })
const news = {
  courrier: [{ sectionKey: 'societe', articles: Array.from({ length: 12 }, (_, i) => recent(i)) }],
  armenpress: { en: [{ categoryKey: 'armenia', articles: [recent(100)] }] },
}
const okReply = JSON.stringify({ intro: 'Intro', topics: [topic([1, 2]), topic([3]), topic([4])] })
const fakeFetch = (content, calls) => async (url, init) => {
  calls.push(JSON.parse(init.body))
  return { ok: true, json: async () => ({ model: 'm:free', choices: [{ message: { content } }] }) }
}
const quiet = { log() {}, warn() {} }

test('generateBriefs : écrit la brève due, saute les langues trop minces', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brief-'))
  const calls = []
  const done = await generateBriefs({
    news, now: NOW, dir, apiKey: 'k', fetchImpl: fakeFetch(okReply, calls), log: quiet,
  })
  assert.deepEqual(done, ['fr', 'de', 'it'], 'de et it lisent le fil français')
  assert.equal(calls.length, 3, 'en n’a qu’un article : pas d’appel')
  assert.equal(calls[0].reasoning.enabled, false)
  const b = JSON.parse(await readFile(path.join(dir, 'fr', '2026-10-16.json'), 'utf-8'))
  assert.equal(b.date, '2026-10-16')
  assert.equal(b.lang, 'fr')
  assert.equal(b.model, 'm:free')
  assert.equal(b.generatedAt, NOW.toISOString())
  assert.match(b.topics[0].sources[0].url, /^https:\/\/x\/\d+$/)
})

test('generateBriefs : jamais régénérée, rien avant 7 h, rien sans clé', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brief-'))
  await mkdir(path.join(dir, 'fr'), { recursive: true })
  await writeFile(path.join(dir, 'fr', '2026-10-16.json'), '{"keep":true}')
  const calls = []
  assert.deepEqual(
    await generateBriefs({ news, now: NOW, dir, apiKey: 'k', fetchImpl: fakeFetch(okReply, calls), log: quiet }),
    ['de', 'it'], // fr existe déjà : seules les langues absentes sont rédigées
  )
  assert.equal(await readFile(path.join(dir, 'fr', '2026-10-16.json'), 'utf-8'), '{"keep":true}')

  const early = new Date('2026-10-16T02:00:00Z') // 06:00 à Erevan
  const dir2 = await mkdtemp(path.join(tmpdir(), 'brief-'))
  assert.deepEqual(
    await generateBriefs({ news, now: early, dir: dir2, apiKey: 'k', fetchImpl: fakeFetch(okReply, calls), log: quiet }),
    [],
  )
  // `force` ignore l'heure (CLI), jamais l'existence du fichier.
  assert.deepEqual(
    await generateBriefs({ news, now: early, dir: dir2, apiKey: 'k', force: true, fetchImpl: fakeFetch(okReply, calls), log: quiet }),
    ['fr', 'de', 'it'],
  )

  const dir3 = await mkdtemp(path.join(tmpdir(), 'brief-'))
  assert.deepEqual(await generateBriefs({ news, now: NOW, dir: dir3, apiKey: '', log: quiet }), [])
  assert.deepEqual(await readdir(dir3), [])
})

test('generateBriefs : réponse invalide ou réseau en échec → rien écrit, ne lève pas', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brief-'))
  const warns = []
  const log = { log() {}, warn: (m) => warns.push(m) }
  await generateBriefs({ news, now: NOW, dir, apiKey: 'k', fetchImpl: fakeFetch('n’importe quoi', []), log })
  await generateBriefs({
    news, now: NOW, dir, apiKey: 'k', log,
    fetchImpl: async () => { throw new Error('timeout') },
  })
  await generateBriefs({
    news, now: NOW, dir, apiKey: 'k', log,
    fetchImpl: async () => ({ ok: false, status: 429 }),
  })
  assert.deepEqual(await readdir(dir), [])
  assert.ok(warns.some((w) => /✗ brief\/fr: réponse invalide/.test(w)))
  assert.ok(warns.some((w) => /✗ brief\/fr: timeout/.test(w)))
  assert.ok(warns.some((w) => /✗ brief\/fr: HTTP 429/.test(w)))
  assert.ok(warns.every((w) => !w.includes('Bearer')))
})

test('parseBrief : la rubrique est normalisée (casse, diacritiques)', () => {
  const b = parseBrief(JSON.stringify({ intro: 'i', topics: [topic([1], { rubric: 'Économie' }), topic([2], { rubric: ' POLITIQUE ' }), topic([3])] }), articles)
  assert.equal(b.topics[0].rubric, 'economie')
  assert.equal(b.topics[1].rubric, 'politique')
})

test('buildBriefMessages : allemand à la suisse et italien, titres sources à traduire', () => {
  const [de] = buildBriefMessages('de', articles)
  assert.match(de.content, /allemand/)
  assert.match(de.content, /ss/)
  assert.match(de.content, /traduis/)
  const [it] = buildBriefMessages('it', articles)
  assert.match(it.content, /italien/)
  assert.match(it.content, /traduis/)
  // Une langue qui lit son propre fil n'a pas cette consigne.
  const [fr] = buildBriefMessages('fr', articles)
  assert.doesNotMatch(fr.content, /traduis/)
})

test('selectArticles : de et it lisent les mêmes articles que fr', () => {
  const urls = (l) => selectArticles(news, l, NOW).map((a) => a.url).sort()
  assert.ok(urls('fr').length > 0)
  assert.deepEqual(urls('de'), urls('fr'))
  assert.deepEqual(urls('it'), urls('fr'))
})

test('generateBriefs : une langue sans consigne est signalée, sans appel réseau', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'brief-'))
  const calls = []
  const lines = []
  const done = await generateBriefs({
    news, now: NOW, dir, apiKey: 'k', fetchImpl: fakeFetch(okReply, calls),
    langNames: { fr: 'français' },
    log: { log: (m) => lines.push(m), warn: (m) => lines.push(m) },
  })
  assert.deepEqual(done, ['fr'])
  assert.equal(calls.length, 1, 'seul fr a une consigne')
  for (const l of ['de', 'it', 'en', 'hy', 'ru'])
    assert.ok(lines.includes(`  · brief/${l}: pas de consigne`), l)
  assert.deepEqual(await readdir(dir), ['fr'])
})

test('parseBrief : du français dans une brève de ou it est écarté, pas dans une brève fr', () => {
  const fr = (t) => JSON.stringify({ intro: 'Intro', topics: [t, t, t] })
  const french = topic([1], { title: 'Les liens entre Erevan', text: 'Une visite qui est dans les médias.' })
  const rejected = []
  assert.equal(parseBrief(fr(french), articles, 'it', rejected), null)
  assert.ok(rejected.includes('les'))
  assert.equal(parseBrief(fr(french), articles, 'de'), null)
  assert.ok(parseBrief(fr(french), articles, 'fr'), 'en français, c’est la langue attendue')
  const ok = topic([1], { title: 'Visita a Erevan', text: 'Il premier ministro ha ricevuto la procuratrice.' })
  assert.ok(parseBrief(fr(ok), articles, 'it'))
  // Une introduction française est vidée, comme une introduction à l'alphabet fautif.
  const intro = JSON.stringify({ intro: 'Les sujets du jour sont dans la presse.', topics: [ok, ok, ok] })
  assert.equal(parseBrief(intro, articles, 'it').intro, '')
})
