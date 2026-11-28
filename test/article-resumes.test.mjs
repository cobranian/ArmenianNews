// Invariant gardé : l'étape de résumé des articles choisit les bons articles,
// ne garde que des résumés vérifiés, compte un essai seulement quand le modèle a
// répondu, s'arrête net au 429 et ne lève jamais. Aucun réseau (tout est injecté).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  listArticles,
  summaryLangs,
  pendingArticles,
  vetArticleResumes,
  summarizeArticles,
  buildArticleMessages,
} from '../scripts/lib/article-resumes.mjs'

const NOW = new Date('2026-11-28T12:00:00Z')
const FR =
  "Le gouvernement arménien a annoncé jeudi à Erevan un nouveau programme de soutien aux petites entreprises, " +
  "doté de plusieurs millions de dollars et destiné aux régions frontalières. Le ministre a précisé que les premiers versements " +
  "seraient effectués avant la fin de l'année."
const DE =
  'Die armenische Regierung hat am Donnerstag in Eriwan ein neues Programm zur Unterstützung kleiner Unternehmen angekündigt, ' +
  'das mit mehreren Millionen Dollar ausgestattet ist und vor allem den Grenzregionen zugutekommen soll. Der Minister erklärte, ' +
  'die ersten Zahlungen würden noch vor Jahresende erfolgen.'
const IT =
  "Il governo armeno ha annunciato giovedì a Erevan un nuovo programma di sostegno alle piccole imprese, " +
  "con una dotazione di diversi milioni di dollari destinata soprattutto alle regioni di confine. Il ministro ha precisato che " +
  "i primi pagamenti saranno effettuati prima della fine dell'anno."
const RU =
  'Правительство Армении в четверг в Ереване объявило о новой программе поддержки малого бизнеса, ' +
  'на которую выделено несколько миллионов долларов и которая в первую очередь предназначена для приграничных регионов. ' +
  'Министр уточнил, что первые выплаты будут произведены до конца года.'
const HY =
  'Հայաստանի կառավարությունը հինգշաբթի օրը Երևանում հայտարարեց փոքր ձեռնարկությունների աջակցության նոր ծրագրի մասին, ' +
  'որին հատկացվել են մի քանի միլիոն դոլար և որը հիմնականում նախատեսված է սահմանամերձ մարզերի համար։ Նախարարը հստակեցրեց, ' +
  'որ առաջին վճարումները կկատարվեն տարեվերջից առաջ։'

const para = (n) => `Paragraphe ${n} ` + 'x'.repeat(110)
const HTML = `<html><body><article><div class="entry-content">${[1, 2, 3, 4].map((n) => `<p>${para(n)}</p>`).join('')}</div></article></body></html>`
const okReply = (obj) => async () => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
})
const quiet = () => {
  const lines = []
  return { lines, log: { log: (m) => lines.push(m), warn: (m) => lines.push(m) } }
}
const art = (n, date, extra = {}) => ({
  url: `https://x.test/${n}`, lang: 'fr', source: 'courrier', title: `Titre ${n}`, image: null, rubric: 'armenie', date, ...extra,
})

test('listArticles dédoublonne par URL, langue de contenu et source renseignées', () => {
  const a = { title: 'A', url: 'https://x.test/a', date: '2026-11-28T08:00:00Z', image: 'i.jpg' }
  const b = { title: 'B', url: 'https://x.test/b', date: '2026-11-27T08:00:00Z' }
  const news = {
    armenpress: { fr: [{ categoryKey: 'armenia', articles: [a] }, { categoryKey: 'world', articles: [a] }] },
    courrier: [{ sectionKey: 'societe', articles: [b] }],
  }
  const out = listArticles(news)
  assert.equal(out.length, 2)
  assert.ok(out.every((x) => x.lang === 'fr' && x.source))
  const pa = out.find((x) => x.url === a.url)
  assert.equal(pa.source, 'armenpress')
  assert.equal(pa.rubric, 'armenie')
  assert.equal(out.find((x) => x.url === b.url).rubric, 'societe')
})

test('summaryLangs : fr donne fr/de/it, les autres leur langue', () => {
  assert.deepEqual(summaryLangs('fr'), ['fr', 'de', 'it'])
  assert.deepEqual(summaryLangs('hy'), ['hy'])
})

test('pendingArticles : fenêtre, complétude, essais, tri, plafond', () => {
  const old = art('old', '2026-11-15T10:00:00Z')
  const done = art('done', '2026-11-27T10:00:00Z')
  const tired = art('tired', '2026-11-27T11:00:00Z')
  const n27 = art('n27', '2026-11-27T12:00:00Z')
  const n28 = art('n28', '2026-11-28T09:00:00Z')
  const archive = {
    [done.url]: { ...done, attempts: 1, resumes: { fr: FR, de: DE, it: IT } },
    [tired.url]: { ...tired, attempts: 3, resumes: { fr: FR } },
  }
  const all = [old, done, tired, n27, n28]
  assert.deepEqual(pendingArticles(all, archive, NOW).map((a) => a.url), [n28.url, n27.url])
  assert.equal(pendingArticles(all, archive, NOW, 1).length, 1)
  const undated = art('nodate', null)
  assert.equal(pendingArticles([n28, undated], {}, NOW)[0].url, undated.url)
})

test('vetArticleResumes : alphabet et longueur', () => {
  const hyBad = HY.slice(0, 250) + ' successoffice ' + HY.slice(250, 300)
  const { kept, rejected } = vetArticleResumes({ hy: hyBad, ru: RU }, { title: 'T', text: 'texte' })
  assert.deepEqual(Object.keys(kept), ['ru'])
  assert.deepEqual(rejected, [['hy', 'alphabet']])
  const r2 = vetArticleResumes({ fr: 'Trop court.' }, { title: '', text: '' })
  assert.deepEqual(r2.rejected, [['fr', 'longueur']])
})

test('buildArticleMessages : clés = langues demandées', () => {
  const [sys, usr] = buildArticleMessages(art('m', null), 'corps', ['fr', 'de'])
  assert.match(sys.content, /"fr": <French>, "de": <German>/)
  assert.match(usr.content, /^Title: Titre m\nSource: Courrier d'Erevan\n\nArticle:\ncorps$/)
})

test('résume et archive', async () => {
  const a = art('1', '2026-11-28T09:00:00Z', { image: 'i.jpg' })
  const { log } = quiet()
  const out = await summarizeArticles({
    articles: [a], archive: {}, apiKey: 'k', now: NOW, log,
    fetchPage: async () => HTML,
    fetchImpl: okReply({ fr: FR, de: DE, it: IT }),
  })
  const e = out[a.url]
  assert.deepEqual(e.resumes, { fr: FR, de: DE, it: IT })
  assert.equal(e.attempts, 1)
  assert.ok(e.hash)
  assert.equal(e.title, 'Titre 1')
  assert.equal(e.source, 'courrier')
  assert.equal(e.image, 'i.jpg')
  assert.equal(e.lang, 'fr')
  assert.ok(!JSON.stringify(e).includes('xxxxxxxx'), "le texte de l'article n'est jamais archivé")
})

test('fetch en échec : essai compté, aucune exception', async () => {
  const a = art('2', '2026-11-28T09:00:00Z')
  const { log, lines } = quiet()
  const out = await summarizeArticles({
    articles: [a], archive: {}, apiKey: 'k', now: NOW, log,
    fetchPage: async () => { throw new Error('HTTP 403') },
    fetchImpl: async () => { throw new Error('ne doit pas être appelé') },
  })
  assert.equal(out[a.url].attempts, 1)
  assert.deepEqual(out[a.url].resumes, {})
  assert.ok(lines.some((l) => l.includes('✗ résumé-article') && l.includes('HTTP 403')))
})

test("429 : on s'arrête, aucun essai compté", async () => {
  const arts = [1, 2, 3].map((n) => art(`q${n}`, `2026-11-28T0${n}:00:00Z`))
  const { log, lines } = quiet()
  let calls = 0
  const out = await summarizeArticles({
    articles: arts, archive: {}, apiKey: 'k', now: NOW, log, concurrency: 1,
    fetchPage: async () => HTML,
    fetchImpl: async () => { calls++; return { ok: false, status: 429 } },
  })
  assert.equal(calls, 1)
  assert.ok(Object.values(out).every((e) => e.attempts === 0))
  assert.ok(lines.some((l) => l.includes('✗ résumé-article: quota (429)')))
})

test('sans clé : archive inchangée', async () => {
  const { log, lines } = quiet()
  const out = await summarizeArticles({ articles: [art('k', '2026-11-28T09:00:00Z')], archive: {}, apiKey: '', now: NOW, log })
  assert.deepEqual(out, {})
  assert.ok(lines.some((l) => l.includes('✗ résumé-article: OPENROUTER_API_KEY absente')))
})

test('texte modifié : résumés vidés puis réécrits', async () => {
  const a = art('3', '2026-11-28T09:00:00Z')
  const archive = { [a.url]: { ...a, hash: 'ancien', attempts: 2, resumes: { fr: 'ANCIEN' } } }
  const { log } = quiet()
  const out = await summarizeArticles({
    articles: [a], archive, apiKey: 'k', now: NOW, log,
    fetchPage: async () => HTML,
    fetchImpl: okReply({ fr: FR, de: DE, it: IT }),
  })
  assert.deepEqual(out[a.url].resumes, { fr: FR, de: DE, it: IT })
  assert.equal(out[a.url].attempts, 1)
  assert.notEqual(out[a.url].hash, 'ancien')
})
