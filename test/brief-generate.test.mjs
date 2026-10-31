import { test } from 'node:test'
import { frenchWords } from '../scripts/lib/brief-script.mjs'
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
  briefModels,
} from '../scripts/lib/brief-generate.mjs'
import { STRONG_MODEL, modelChain } from '../scripts/lib/classify-rubrics.mjs'

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

test('parseBrief : prose valide de/it jamais prise pour du français', () => {
  const run = (lang, t) => parseBrief(JSON.stringify({ intro: 'Intro', topics: [t, t, t] }), articles, lang)
  // « des » (génitif) et « du » (pronom) sont allemands.
  assert.ok(run('de', topic([1], { title: 'Die Regierung des Landes', text: 'Der Chef des Amts sagt: du siehst, des Präsidenten Wort gilt.' })))
  // « qui » (ici) et « Est » (point cardinal) sont italiens.
  assert.ok(run('it', topic([1], { title: 'Nell’Est del paese', text: 'Siamo qui, e l’Est resta qui vicino.' })))
  // Un nom propre français (initiales capitales) n'est pas une fuite de français.
  const t = topic([1], { title: 'Les Arméniens de France', text: 'Die Gemeinde feiert heute ihr Jubiläum in Paris.' })
  assert.ok(run('de', t))
})

test('parseBrief : un sujet tout en français reste écarté en de et en it', () => {
  const fr = topic([1], { title: 'Une visite pour tous', text: 'Les ministres sont dans la capitale avec leurs équipes.' })
  const arr = JSON.stringify({ intro: 'Intro', topics: [fr, fr, fr] })
  assert.equal(parseBrief(arr, articles, 'de'), null)
  assert.equal(parseBrief(arr, articles, 'it'), null)
})

test('parseBrief : un sujet français rejeté même quand ses titres sources le sont aussi', () => {
  const src = [
    { id: 1, source: 'armenpress', rubric: 'politique', url: 'https://r/1', date: 'x', title: 'Les ministres des affaires étrangères sont dans la capitale pour une visite sur la paix' },
    { id: 2, source: 'civilnet', rubric: 'politique', url: 'https://r/2', date: 'x', title: 'Les ONG ont été reçues par le gouvernement avec leurs équipes entre deux réunions' },
  ]
  const t = topic([1, 2], {
    title: 'Une visite pour tous',
    text: 'Les ministres sont dans la capitale avec leurs équipes, et que les ONG ont été reçues sur place.',
  })
  const reply = JSON.stringify({ intro: 'Intro', topics: [t, t, t] })
  assert.equal(parseBrief(reply, src, 'de'), null)
  assert.equal(parseBrief(reply, src, 'it'), null)
})

// La brève « it » réellement publiée le 23 octobre 2026 : titres italiens,
// textes français, chaque sujet trop court pour porter deux mots-outils. Elle
// passait la garde ; elle doit désormais être écartée en entier.
test('parseBrief : la brève it du 23 octobre 2026 (titres italiens, textes français) est écartée', () => {
  const src = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, source: 'armenews', rubric: 'armenie', title: 'T', url: `https://x/${i + 1}`, date: 'x' }))
  const t = (id, title, text) => ({ title, text, rubric: 'armenie', ids: [id] })
  const reply = JSON.stringify({
    intro: '',
    topics: [
      t(1, 'Energia verde e COP 17', 'Le développement des énergies vertes constitue le point central des discussions lors de la COP 17 qui se déroule à Erevan en Arménie.'),
      t(2, 'Situazione politica e OTSC', "L'Arménie a de facto quitté l'OTSC, selon le Secrétaire général de l'Organisation du traité de sécurité collective."),
      t(3, 'Relazioni internazionali e sanzioni', "Pashinian fustige la Russie alors que l'Arménie risque de nouvelles sanctions."),
      t(4, 'Calcio: risultati e classifiche', "L'internazionale armeno Eduard Spertsyan figura al 99° posto nel Marca dei 100 migliori calciatori al mondo."),
      t(5, 'Donazione USA per la sicurezza dei confini', "Les États-Unis ont fait don de 1,4 million di dollari d'equipaggiamenti per rafforzare la sicurezza delle frontières arméniennes."),
      t(6, 'Acquisizione manoscritti al Matenadaran', 'Des manuscrits précieux seront acquis pour le Matenadaran.'),
      t(7, 'Concerto di Gregory Bakian', 'Salle comble per le esibizione di Gregory Bakian ad Erevan.'),
    ],
  })
  const rejected = []
  assert.equal(parseBrief(reply, src, 'it', rejected), null)
  assert.ok(rejected.some((w) => /brève entière/.test(w)))
  // La même réponse reste acceptée en fr : c'est la langue attendue.
  assert.ok(parseBrief(reply, src, 'fr'))
})

test('frenchWords : accents français en milieu de mot, jamais les finales italiennes ni les noms propres', () => {
  assert.deepEqual(frenchWords('Lo sviluppo è al centro: perché la città ha più energia e così via.', 'it'), [])
  assert.deepEqual(frenchWords('Der Präsident der Republik Arménie traf Grégory in Eriwan.', 'de'), [])
  assert.ok(frenchWords('il développement della sécurité', 'it').length >= 2)
})

test('parseBrief : la brève it corrigée à la main le 23 octobre 2026 passe la garde', async () => {

  const b = JSON.parse(await readFile(new URL('../src/data/briefs/it/2026-10-23.json', import.meta.url), 'utf-8'))
  for (const t of b.topics) assert.deepEqual(frenchWords(`${t.title} ${t.text}`, 'it'), [], t.title)
  assert.deepEqual(frenchWords(b.intro, 'it'), [])
})

// La brève « it » du 24 octobre 2026 : le modèle préfixait ses titres par la
// CLÉ de rubrique, en français (« Politique : », « Economie : »), et le premier
// titre était resté entier en français — un seul mot-outil (« les »), sous le
// seuil de deux qui vaut pour un texte entier.
const itText = 'Il segretario generale ha dichiarato che il paese ha lasciato l’organizzazione.'
test('parseBrief : un préfixe « Rubrique : » en clé française est retiré, et donne la rubrique', () => {
  const b = parseBrief(JSON.stringify({ intro: '', topics: [
    topic([1], { title: 'Economie : energie verdi e infrastrutture', text: itText, rubric: null }),
    topic([2], { title: 'Società e diritti umani', text: itText, rubric: 'societe' }),
    topic([3], { title: 'Calcio: risultati e classifiche', text: itText, rubric: 'sports' }),
  ] }), articles, 'it')
  assert.equal(b.topics[0].title, 'Energie verdi e infrastrutture')
  assert.equal(b.topics[0].rubric, 'economie')
  assert.equal(b.topics[2].title, 'Calcio: risultati e classifiche', 'un deux-points ordinaire reste')
})

test('parseBrief : un TITRE resté en français est écarté en it/de, même avec un seul indice', () => {
  const topics = [
    topic([1], { title: "Politique : l'Arménie et les organisations internationales", text: itText, rubric: null }),
    topic([2], { title: 'Società e diritti umani', text: itText }),
    topic([3], { title: 'Sport', text: itText }),
    topic([1], { title: 'Diaspora e cultura', text: itText }),
  ]
  const rejected = []
  const b = parseBrief(JSON.stringify({ intro: '', topics }), articles, 'it', rejected)
  assert.deepEqual(b.topics.map((t) => t.title), ['Società e diritti umani', 'Sport', 'Diaspora e cultura'])
  assert.ok(rejected.includes('les'))
  assert.equal(parseBrief(JSON.stringify({ intro: '', topics }), articles, 'fr').topics.length, 4)
})

// Le modèle répond souvent la rubrique TRADUITE (« Politica », « Politik »),
// pas la clé : la brève « de » du 23 octobre 2026 avait ses sept sujets sans
// rubrique. Les libellés des six langues (src/rubricLabels.js) sont reconnus.
test('parseBrief : une rubrique écrite dans la langue de la brève est reconnue', () => {
  const b = parseBrief(JSON.stringify({ intro: '', topics: [
    topic([1], { rubric: 'Politica' }),
    topic([2], { rubric: 'Wirtschaft' }),
    topic([3], { rubric: 'Քաղաքականություն' }),
    topic([1], { rubric: 'Società' }),
    topic([2], { rubric: 'inventée' }),
  ] }), articles)
  assert.deepEqual(b.topics.map((t) => t.rubric), ['politique', 'economie', 'politique', 'societe', null])
})

// Mesuré le 25 octobre 2026 sur les mêmes 27 à 100 titres : lightning rate la
// brève hy (« ոստիկանայինVor », « միջազգայինembly » — deux essais sur deux),
// perd des sujets en ru et it ; ultra-550b écrit 7 sujets dans les quatre
// langues sans un mot écarté. fr/en restent sur la chaîne commune.
// Depuis le 25 octobre, fr et en aussi (lightning : 5 sujets et des erreurs de
// fait en anglais ce jour-là).
test('briefModels : ultra en tête pour les sept langues, sans doublon ni modèle perdu', () => {
  for (const l of ['fr', 'de', 'it', 'en', 'es', 'hy', 'ru']) {
    const chain = briefModels(l)
    assert.equal(chain[0], STRONG_MODEL, l)
    assert.equal(new Set(chain).size, chain.length, l)
    assert.deepEqual([...chain].sort(), [...new Set([STRONG_MODEL, ...modelChain()])].sort(), l)
  }
  assert.deepEqual(briefModels('hy', 'x/forcé'), ['x/forcé'])
})

test('buildBriefMessages es : consigne espagnole, sans undefined ni phrase « titres en français »', () => {
  const m = buildBriefMessages('es', [{ id: 1, source: 'armenpress', rubric: 'armenia', title: 'Título' }])
  const all = m.map((x) => x.content).join('\n')
  assert.match(m[0].content, /espagnol latino-américain neutre/)
  assert.ok(!all.includes('undefined'))
  assert.ok(!all.includes('Les titres sources sont en français'))
})

test('parseBrief es : un sujet écrit en anglais ou en français est écarté, l’espagnol est gardé', () => {
  const wrap = (t) => JSON.stringify({ intro: 'Intro', topics: [t, t, t] })
  const en = topic([1], { title: 'Government measures', text: 'The government announced the measures with the region and the parliament.' })
  const rejected = []
  assert.equal(parseBrief(wrap(en), articles, 'es', rejected), null)
  assert.ok(rejected.includes('the'))
  const fr = topic([1], { title: 'Les liens entre Erevan', text: 'Une visite qui est dans les médias.' })
  assert.equal(parseBrief(wrap(fr), articles, 'es'), null)
  const ok = topic([1], { title: 'Visita a Ereván', text: 'La reunión también está prevista en el sur del país.' })
  assert.ok(parseBrief(wrap(ok), articles, 'es'))
  const intro = JSON.stringify({ intro: 'The government announced the measures with the region and the parliament.', topics: [ok, ok, ok] })
  assert.equal(parseBrief(intro, articles, 'es').intro, '')
})
