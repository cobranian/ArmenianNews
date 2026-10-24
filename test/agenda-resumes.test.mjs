import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  extractEventText,
  sourceHash,
  forbiddenDetail,
  buildResumeMessages,
  parseResumeReply,
  vetResumes,
  pendingEvents,
  pruneCache,
  resumesFor,
  resumeLangs,
  summarizeAgenda,
  withResumeLangs,
  resumeModels,
} from '../scripts/lib/agenda-resumes.mjs'

// Extrait RÉEL de la page armenopole « Young Prodigies of Armenia in
// Switzerland », relevé le 24 octobre 2026 (la page disparaîtra avec
// l'événement). Le texte de présentation vit dans [itemprop="description"].
const fixture = readFileSync(
  new URL('./fixtures/armenopole-event-2026-10-24.html', import.meta.url),
  'utf8',
)

test('extrait le texte réel de la fixture', () => {
  const t = extractEventText(fixture)
  assert.ok(t.startsWith('Save the Date'))
  assert.match(t, /Young Prodigies of Armenia/)
  assert.ok(t.length > 1000)
})

test('texte trop court ou absent → null', () => {
  assert.equal(extractEventText('<div itemprop="description">Bientôt.</div>'), null)
  assert.equal(extractEventText('<html><body>rien</body></html>'), null)
})

test('sourceHash est stable et sensible au texte', () => {
  assert.equal(sourceHash('a'), sourceHash('a'))
  assert.notEqual(sourceHash('a'), sourceHash('b'))
  assert.equal(sourceHash('a').length, 12)
})

test('forbiddenDetail attrape heures, prix, adresses', () => {
  assert.equal(forbiddenDetail('Concert à 19:30 à Genève.'), 'heure')
  assert.equal(forbiddenDetail('Starts at 7 PM.'), 'heure')
  assert.equal(forbiddenDetail('Начало в 19.00.'), 'heure')
  assert.equal(forbiddenDetail('Billets CHF 35.'), 'prix')
  assert.equal(forbiddenDetail('Entrée 15 €.'), 'prix')
  assert.equal(forbiddenDetail('Tickets $20.'), 'prix')
  assert.equal(forbiddenDetail('Տոմսը 5000 ֏ է։'), 'prix')
  assert.equal(forbiddenDetail('Билет 500 руб.'), 'prix')
  assert.equal(forbiddenDetail('Au 2 Place d’Arménie.'), 'adresse')
  assert.equal(forbiddenDetail('At 11 St. Annagasse.'), 'adresse')
})

test('forbiddenDetail laisse passer années, ordinaux, petits nombres', () => {
  for (const s of [
    'La 33e édition du festival.',
    'Deux concerts en 2026.',
    '2 concerts, 6 villes.',
    'Les 40 ans de GAIDZ.',
  ])
    assert.equal(forbiddenDetail(s), null, s)
})

// Six résumés plausibles, chacun dans son alphabet, sans prix, heure ni adresse.
const six = {
  fr: "Une nouvelle génération de jeunes musiciens arméniens part en tournée en Suisse, entre classique, folk et jazz, de Komitas à Piazzolla.",
  de: "Eine neue Generation junger armenischer Musiker geht auf Tournee durch die Schweiz, zwischen Klassik, Folk und Jazz, von Komitas bis Piazzolla.",
  it: "Una nuova generazione di giovani musicisti armeni parte in tournée in Svizzera, tra musica classica, folk e jazz, da Komitas a Piazzolla.",
  en: "A new generation of young Armenian musicians tours Switzerland, blending classical, folk and jazz, from Komitas to Piazzolla.",
  hy: "Հայ երիտասարդ երաժիշտների նոր սերունդը համերգային շրջագայություն է կատարում Շվեյցարիայում՝ դասական, ժողովրդական և ջազ երաժշտությամբ։",
  ru: "Новое поколение юных армянских музыкантов отправляется в гастроли по Швейцарии с программой классики, фолка и джаза, от Комитаса до Пьяццоллы.",
}

test('parseResumeReply lit JSON nu, fences et texte autour', () => {
  assert.deepEqual(parseResumeReply(JSON.stringify(six)), six)
  assert.deepEqual(parseResumeReply('```json\n' + JSON.stringify(six) + '\n```'), six)
  assert.deepEqual(parseResumeReply('Voici :\n' + JSON.stringify(six) + '\nBonne journée'), six)
  assert.deepEqual(parseResumeReply('pas de json'), {})
  assert.deepEqual(parseResumeReply(JSON.stringify({ fr: '', es: 'hola', en: 3 })), {})
})

test('vetResumes écarte une langue fautive sans toucher aux autres', () => {
  const r = vetResumes(
    { ...six, ru: six.ru + ' Начало в 19:00.', hy: six.hy + ' football' },
    { title: 'Young Prodigies of Armenia', text: 'Komitas Piazzolla' },
  )
  assert.deepEqual(Object.keys(r.kept).sort(), ['de', 'en', 'fr', 'it'])
  assert.deepEqual(r.rejected.sort(), [['hy', 'alphabet'], ['ru', 'heure']])
})

test('vetResumes permet un nom propre latin cité par la source', () => {
  const r = vetResumes({ hy: six.hy + ' Piazzolla' }, { title: 'X', text: 'Astor Piazzolla' })
  assert.ok(r.kept.hy)
})

test('vetResumes écarte un résumé trop court ou trop long', () => {
  const r = vetResumes({ fr: 'Un concert.', en: 'x '.repeat(400) }, { title: 'T', text: '' })
  assert.deepEqual(r.rejected.sort(), [['en', 'longueur'], ['fr', 'longueur']])
})

test('pendingEvents : nouveaux, puis incomplets, puis périmés ; plafond', () => {
  const now = new Date('2026-10-24T12:00:00Z')
  const ev = (u) => ({ url: u, title: u })
  const cache = {
    a: { hash: 'h', checkedAt: '2026-10-24T00:00:00Z', attempts: 1, ...six },
    b: { hash: 'h', checkedAt: '2026-10-24T00:00:00Z', attempts: 1, fr: six.fr },
    c: { hash: 'h', checkedAt: '2026-10-10T00:00:00Z', attempts: 1, ...six },
    d: { hash: 'h', checkedAt: '2026-10-24T00:00:00Z', attempts: 3, fr: six.fr },
  }
  assert.deepEqual(
    pendingEvents([ev('a'), ev('b'), ev('c'), ev('d'), ev('n'), ev('n')], cache, now).map((e) => e.url),
    ['n', 'b', 'c'],
  )
  assert.equal(pendingEvents(Array.from({ length: 30 }, (_, i) => ev('u' + i)), {}, now).length, 20)
})

test('pruneCache retire les événements passés ; resumesFor / resumeLangs', () => {
  const cache = { a: { hash: 'h', attempts: 1, fr: 'x', en: 'y' }, gone: { hash: 'h', attempts: 1, fr: 'z' } }
  const kept = pruneCache(cache, [{ url: 'a' }])
  assert.deepEqual(Object.keys(kept), ['a'])
  assert.deepEqual(resumesFor(kept, 'fr'), { a: 'x' })
  assert.deepEqual(resumeLangs(kept.a), ['fr', 'en'])
})

test('buildResumeMessages interdit prix, horaires, adresses et demande les six langues', () => {
  const m = buildResumeMessages({ title: 'T', location: 'Genève' }, 'texte source')
    .map((x) => x.content)
    .join('\n')
  for (const l of ['fr', 'de', 'it', 'en', 'hy', 'ru']) assert.match(m, new RegExp(`"${l}"`))
  assert.match(m, /texte source/)
})

const silent = { log() {}, warn() {}, error() {} }
const reply = (obj) => async () => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }], model: 'm' }),
})

test('summarizeAgenda : écrit les langues valides, compte une page vide, ne lève pas', async () => {
  const events = [{ url: 'ok', title: 'Young Prodigies of Armenia' }, { url: 'vide', title: 'X' }]
  const fetchPage = async (u) => (u === 'ok' ? fixture : '<html></html>')
  const out = await summarizeAgenda({ events, cache: {}, apiKey: 'k', fetchPage, fetchImpl: reply(six), log: silent })
  assert.deepEqual(resumeLangs(out.ok), ['fr', 'de', 'it', 'en', 'hy', 'ru'])
  assert.equal(out.vide.attempts, 1)
  assert.deepEqual(resumeLangs(out.vide), [])
})

test('summarizeAgenda : modèle en échec → aucune exception, entrée sans langue', async () => {
  const out = await summarizeAgenda({
    events: [{ url: 'ok', title: 'T' }],
    cache: {},
    apiKey: 'k',
    fetchPage: async () => fixture,
    fetchImpl: async () => ({ ok: false, status: 429 }),
    log: silent,
  })
  assert.deepEqual(resumeLangs(out.ok), [])
})

test('summarizeAgenda : page armenopole en échec → aucune exception', async () => {
  const out = await summarizeAgenda({
    events: [{ url: 'ok', title: 'T' }],
    cache: {},
    apiKey: 'k',
    fetchPage: async () => { throw new Error('HTTP 302') },
    fetchImpl: reply(six),
    log: silent,
  })
  assert.equal(out.ok.attempts, 1)
})

test('summarizeAgenda : sans clé, aucun appel', async () => {
  let calls = 0
  await summarizeAgenda({
    events: [{ url: 'a', title: 'T' }],
    cache: {},
    apiKey: '',
    fetchPage: async () => { calls++; return fixture },
    fetchImpl: async () => { calls++ },
    log: silent,
  })
  assert.equal(calls, 0)
})

test('summarizeAgenda : budget épuisé → s’arrête', async () => {
  let calls = 0
  const events = Array.from({ length: 5 }, (_, i) => ({ url: 'u' + i, title: 'T' }))
  await summarizeAgenda({
    events,
    cache: {},
    apiKey: 'k',
    budgetMs: 0,
    fetchPage: async () => { calls++; return fixture },
    fetchImpl: async () => ({ ok: false, status: 500 }),
    log: silent,
  })
  assert.equal(calls, 0)
})

test('summarizeAgenda : texte source modifié → anciennes langues effacées', async () => {
  const cache = { ok: { hash: 'ancien', checkedAt: '2026-10-01T00:00:00Z', attempts: 1, ...six } }
  const out = await summarizeAgenda({
    events: [{ url: 'ok', title: 'T' }],
    cache,
    apiKey: 'k',
    fetchPage: async () => fixture,
    fetchImpl: reply({ fr: six.fr }),
    now: new Date('2026-10-24T12:00:00Z'),
    log: silent,
  })
  assert.deepEqual(resumeLangs(out.ok), ['fr'])
})

test('summarizeAgenda : purge les événements passés', async () => {
  const out = await summarizeAgenda({ events: [], cache: { gone: { hash: 'h', attempts: 1, fr: six.fr } }, apiKey: '', log: silent })
  assert.deepEqual(out, {})
})

test('resumeLangs se recalcule depuis le cache, pas depuis un événement hérité', () => {
  const ev = { url: 'a', resumeLangs: ['fr', 'de'] } // venu d'un instantané précédent
  const cache = { a: { hash: 'h', attempts: 1, en: 'y' } }
  assert.deepEqual(withResumeLangs([ev], cache)[0].resumeLangs, ['en'])
  assert.deepEqual(withResumeLangs([{ url: 'z' }], cache)[0].resumeLangs, [])
  assert.deepEqual(ev.resumeLangs, ['fr', 'de']) // pas de mutation
})

// Mesuré le 24 oct. 2026 : nemotron-3.5-lightning (tête de la chaîne de la
// brève) écrit un arménien inutilisable (« ենvole travers », « generaciónը ») ;
// 0 résumé arménien sur 20. nemotron-3-ultra-550b écrit un arménien correct.
test('les résumés ont leur propre chaîne de modèles, ultra en tête', async () => {
  assert.equal(resumeModels(undefined)[0], 'nvidia/nemotron-3-ultra-550b-a55b:free')
  assert.deepEqual(resumeModels('x/y:free'), ['x/y:free'])
  let sent
  await summarizeAgenda({
    events: [{ url: 'ok', title: 'T' }],
    cache: {},
    apiKey: 'k',
    fetchPage: async () => fixture,
    fetchImpl: async (_u, init) => { sent = JSON.parse(init.body); return { ok: false, status: 500 } },
    log: silent,
  })
  assert.deepEqual(sent.models, resumeModels())
})
