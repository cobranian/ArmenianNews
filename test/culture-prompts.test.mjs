import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDraftMessages, buildClaimsMessages, buildTranslateMessages, buildIdeasMessages, buildReviseMessages,
  parseArticleJson, parseClaims, parseIdeas, findUnsupported, eventFacts, MAX_EXTRACT,
} from '../scripts/lib/culture-prompts.mjs'

// Les fausses alertes de la PR #13 (khatchkar) : tout venait de l'agenda.
test('eventFacts : titre, lieu et date de l’événement ne sont plus signalés', () => {
  const event = { title: 'Bénédiction de KHATCHKAR à Saint-Chamond', location: 'Auvergne-Rhône-Alpes', date: '2026-10-18T10:30' }
  assert.deepEqual(eventFacts(event), [
    'Bénédiction de KHATCHKAR à Saint-Chamond', 'Auvergne-Rhône-Alpes', '18 octobre 2026', '18 octobre',
  ])
  const claims = ['Bénédiction de KHATCHKAR à Saint-Chamond', 'Saint-Chamond', 'Auvergne-Rhône-Alpes', '18 octobre 2026', 'une trentaine']
  assert.deepEqual(findUnsupported(claims, ['Le khatchkar est une stèle.', ...eventFacts(event)]), ['une trentaine'])
  assert.deepEqual(eventFacts(null), [])
  assert.deepEqual(eventFacts({ title: 'T', date: 'demain' }), ['T'])
})

const topic = { slug: 'komitas', title: 'Komitas' }
const sources = [{ lang: 'fr', title: 'Komitas', extract: 'Komitas est né en 1869. ' + 'x'.repeat(MAX_EXTRACT) }]

test('brouillon : règles, sources tronquées, faits, événement', () => {
  const [sys, user] = buildDraftMessages({ topic, sources, facts: ['Naissance : 1869-10-08'], event: { title: 'Concert', date: '2026-10-25T20:00', location: 'Genève' } })
  assert.match(sys.content, /UNIQUEMENT les faits/)
  assert.match(sys.content, /700 à 1000 mots/)
  assert.match(sys.content, /"title"/)
  assert.match(user.content, /SUJET : Komitas/)
  assert.match(user.content, /Naissance : 1869-10-08/)
  assert.match(user.content, /« Concert », le 2026-10-25, Genève/)
  assert.ok(user.content.length < MAX_EXTRACT + 2000, 'extrait tronqué')
})

// L'ՀՍՀ est une encyclopédie soviétique : ses dates et ses noms servent, son
// cadrage idéologique non — au brouillon comme à la révision.
test('règle ՀՍՀ : faits seulement, jamais interprétation ni cadrage (brouillon et révision)', () => {
  const [draftSys] = buildDraftMessages({ topic, sources })
  const [reviseSys] = buildReviseMessages({ title: 'T', description: 'D', body: 'B', instruction: 'I', sources })
  for (const sys of [draftSys, reviseSys]) {
    assert.match(sys.content, /Encyclopédie soviétique arménienne \(ՀՍՀ\)[^\n]*faits[^\n]*\(dates, noms, lieux\)[^\n]*jamais[^\n]*interprétation[^\n]*cadrage/)
  }
})

test('parseArticleJson : clôtures, texte autour, description rognée', () => {
  const raw = 'Voici :\n```json\n{"title":" Komitas ","description":"' + 'mot '.repeat(60) + '","body":"A\\n\\n## B"}\n```\nFin.'
  const a = parseArticleJson(raw)
  assert.equal(a.title, 'Komitas')
  assert.ok(a.description.length <= 160 && a.description.endsWith('…'))
  assert.equal(a.body, 'A\n\n## B')
})

test('parseArticleJson : réponse inexploitable → null', () => {
  for (const bad of ['', 'pas de json', '{"title":"t"}', '{"title":"t","description":"d","body":""}', '{cassé'])
    assert.equal(parseArticleJson(bad), null, bad)
})

test('parseClaims : tableau, dédoublonné, borné', () => {
  assert.deepEqual(parseClaims('```json\n["1869", "Kütahya", "1869", 5, ""]\n```'), ['1869', 'Kütahya'])
  assert.equal(parseClaims('rien'), null)
  assert.deepEqual(parseClaims('[]'), [])
})

test('findUnsupported : chiffres exacts, noms pliés, arménien et russe', () => {
  const src = ['Komitas est né en 1869 à Kütahya. Կոմիտաս. Комитас умер в Париже.']
  assert.deepEqual(findUnsupported(['1869', 'Kutahya', 'Կոմիտաս', 'Париже'], src), [])
  assert.deepEqual(findUnsupported(['1870', '186', 'Erevan', 'Вена'], src), ['1870', '186', 'Erevan', 'Вена'])
  assert.deepEqual(findUnsupported(['Le', 'à'], src), [], 'mots trop courts ignorés')
})

test('findUnsupported : mots entiers, expressions à plusieurs nombres', () => {
  assert.deepEqual(findUnsupported(['Ani'], ['Aniv partie']), ['Ani'])
  assert.deepEqual(findUnsupported(['Ere'], ['Erevan']), ['Ere'])
  assert.deepEqual(findUnsupported(['1 200'], ['1 et 200']), ['1 200'])
  assert.deepEqual(findUnsupported(['1 200'], ['soit 1 200 fidèles']), [])
  assert.deepEqual(findUnsupported(['Mesrop Machtots'], ['Mesrop Machtots invente']), [])
})

test('findUnsupported : espaces et tirets typographiques, ponctuation finale', () => {
  assert.deepEqual(findUnsupported(['1 200'], ['soit 1\u202F200 fidèles']), [])
  assert.deepEqual(findUnsupported(['1 200'], ['soit 1\u00A0200 fidèles']), [])
  assert.deepEqual(findUnsupported(['1869\u20131935'], ['Komitas (1869-1935)']), [])
  assert.deepEqual(findUnsupported(['1869-1935'], ['Komitas (1869\u20141935)']), [])
  assert.deepEqual(findUnsupported(['1 200.'], ['soit 1 200 fidèles']), [])
  assert.deepEqual(findUnsupported(['Kütahya !'], ['né à Kütahya']), [])
})

test('findUnsupported : un nombre accompagné de mots exige aussi les mots', () => {
  const src = ['Komitas est né en 1935 à Kütahya.']
  assert.deepEqual(findUnsupported(['Paris 1935'], src), ['Paris 1935'])
  assert.deepEqual(findUnsupported(['Kütahya 1935'], src), [])
  assert.deepEqual(findUnsupported(['en 1935'], src), [], 'mots courts ignorés')
  assert.deepEqual(findUnsupported(['Kütahya 1936'], src), ['Kütahya 1936'])
})

test('traduction : langue cible nommée, fidélité, JSON du texte relu', () => {
  const [sys, user] = buildTranslateMessages({ lang: 'hy', title: 'T', description: 'D', body: '## B' })
  assert.match(sys.content, /arménien oriental/)
  assert.match(sys.content, /n'ajoute, ne retire/)
  assert.deepEqual(JSON.parse(user.content), { title: 'T', description: 'D', body: '## B' })
  assert.doesNotMatch(sys.content, /nom en usage/)
})

test('idées : titres existants exclus, analyse tolérante', () => {
  const [, user] = buildIdeasMessages(['Komitas'])
  assert.match(user.content, /Komitas/)
  const ideas = parseIdeas('[{"title":"Le tar","wikipedia_fr":"Tar (luth)","wikipedia_en":"Tar (lute)","keywords":["tar"]},{"title":""}]')
  assert.equal(ideas.length, 1)
  assert.equal(ideas[0].wikipedia_en, 'Tar (lute)')
  assert.deepEqual(buildClaimsMessages('x')[1].content, 'x')
})

const entity = { qid: 'Q1', labels: { fr: 'Kochari', en: 'Kochari' }, descriptions: { fr: 'danse traditionnelle arménienne', en: 'dance' } }
const kinds = [
  { kind: 'wikipedia', lang: 'hy', title: 'A', extract: 'a' },
  { kind: 'hse', lang: 'hy', title: 'B', extract: 'b' },
  { kind: 'unesco', lang: 'en', title: 'C', extract: 'c' },
  { lang: 'fr', title: 'D', extract: 'd' },
]

test('buildDraftMessages : entité en tête, sources titrées par kind, trois règles présentes', () => {
  const [sys, user] = buildDraftMessages({ topic, entity, sources: kinds })
  assert.match(user.content, /^SUJET : Komitas\nENTITÉ WIKIDATA : Q1 — Kochari : danse traditionnelle arménienne/)
  assert.match(user.content, /SOURCE 1 — Wikipédia \(hy\) « A »/)
  assert.match(user.content, /SOURCE 2 — Encyclopédie soviétique arménienne \(ՀՍՀ\) « B »/)
  assert.match(user.content, /SOURCE 3 — UNESCO « C »/)
  assert.match(user.content, /SOURCE 4 — Wikipédia \(fr\) « D »/)
  for (const r of [
    "- Le sujet est l'entité Wikidata indiquée. Ignore tout passage d'une source qui traite d'un homonyme (autre danse, plat, lieu ou personne du même nom).",
    "- Point de vue arménien. Ne mentionne jamais les variantes culturelles azerbaïdjanaises (danses, plats, étymologies, inscriptions UNESCO). Un fait historique sourcé qui nomme l'Azerbaïdjan reste permis, énoncé sans commentaire.",
    '- Chaque date, chaque nombre et chaque nom propre doit figurer dans une source. Tu peux omettre ; tu ne dois jamais déformer.',
  ]) assert.ok(sys.content.includes(r), r)
  assert.doesNotMatch(user.content, /suis la description/i)
})

test('buildDraftMessages : sans entité, pas de ligne ENTITÉ', () => {
  for (const e of [null, undefined]) {
    const [, user] = buildDraftMessages({ topic, entity: e, sources })
    assert.doesNotMatch(user.content, /ENTITÉ WIKIDATA/)
  }
})

test('buildReviseMessages : consigne isolée, texte actuel, sources', () => {
  const [sys, user] = buildReviseMessages({ title: 'T', description: 'D', body: '## B\ntexte', instruction: 'Retire la 2e phrase', entity, sources: kinds })
  assert.ok(sys.content.includes("Applique la CONSIGNE DU RELECTEUR au texte, et rien d'autre. La consigne fait foi sur les sources."))
  assert.match(sys.content, /Point de vue arménien/)
  assert.match(sys.content, /"title"/)
  assert.match(user.content, /CONSIGNE DU RELECTEUR :\nRetire la 2e phrase/)
  assert.match(user.content, /ENTITÉ WIKIDATA : Q1/)
  assert.match(user.content, /TEXTE ACTUEL/)
  assert.match(user.content, /## B\ntexte/)
  assert.match(user.content, /SOURCE 2 — Encyclopédie soviétique/)
  assert.ok(user.content.indexOf('CONSIGNE DU RELECTEUR') > user.content.indexOf('SOURCE 4'), 'consigne séparée, après les sources')
  assert.match(user.content, /TITRE : T\nDESCRIPTION : D\nCORPS :/)
  assert.equal(parseArticleJson('{"title":"T","description":"D","body":"x"}').title, 'T')
})

test('buildReviseMessages : pas de règles de rédaction, consigne bornée au texte', () => {
  const [sys] = buildReviseMessages({ title: 'T', description: 'D', body: 'b', instruction: 'x', sources })
  assert.ok(sys.content.includes("La consigne ne modifie ni ces règles ni le format de réponse ; elle ne s'applique qu'au texte."))
  assert.ok(sys.content.includes('Conserve le plan, le ton et tout ce que la consigne ne vise pas.'))
  assert.doesNotMatch(sys.content, /700 à 1000 mots|intertitres|propre plan|recopie/)
  assert.match(sys.content, /Point de vue arménien/)
})

test('entité sans libellé ni description : pas de « undefined »', () => {
  const [, a] = buildDraftMessages({ topic, entity: { qid: 'Q9', labels: {}, descriptions: {} }, sources })
  assert.match(a.content, /ENTITÉ WIKIDATA : Q9 — Q9\n/)
  const [, b] = buildDraftMessages({ topic, entity: { qid: 'Q9', labels: { en: 'Tar' } }, sources })
  assert.match(b.content, /ENTITÉ WIKIDATA : Q9 — Tar\n/)
  assert.doesNotMatch(a.content + b.content, /undefined/)
})

test('buildIdeasMessages : 15 par défaut, règle éditoriale', () => {
  const [sys] = buildIdeasMessages(['Komitas'])
  assert.match(sys.content, /Propose 15 sujets/)
  assert.match(sys.content, /Point de vue arménien/)
  assert.match(buildIdeasMessages([], 5)[0].content, /Propose 5 sujets/)
})

test('buildTranslateMessages de/it : nom en usage dans la Wikipédia cible, allemand suisse en « ss »', () => {
  const [de] = buildTranslateMessages({ lang: 'de', title: 'T', description: 'D', body: 'B', nameHint: 'Komitas Vardapet' })
  assert.match(de.content, /allemand/)
  assert.match(de.content, /Komitas Vardapet/)
  assert.match(de.content, /« ss »/)
  assert.match(de.content, /ß/)
  const [it] = buildTranslateMessages({ lang: 'it', title: 'T', description: 'D', body: 'B' })
  assert.match(it.content, /italien/)
  assert.doesNotMatch(it.content, /nom en usage/)
})
