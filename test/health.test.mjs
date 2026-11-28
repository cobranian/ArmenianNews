// L'alerte de santé du job horaire (scripts/lib/health.mjs) : une source figée,
// une brève absente ou un agenda vide ouvrent une issue. Sans réseau.
import test from 'node:test'
import assert from 'node:assert/strict'
import { STALE_HOURS, staleHours, checkNews, checkBriefs, checkAgenda, checkClassify, checkArticleResumes, MIN_RESUME_SAMPLE, MIN_RESUME_ARCHIVE, checkSteps, checkHarvest, healthReport, MAX_UNCLASSIFIED, MAX_HARVEST_DAYS } from '../scripts/lib/health.mjs'
import { ALL_LANGS } from '../sites.config.js'

const NOW = new Date('2026-10-24T12:00:00Z') // 16 h à Erevan
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600e3).toISOString()
const art = (h) => ({ title: 't', url: `https://x/${h}`, date: hoursAgo(h) })

test('checkNews : une source fraîche ne dit rien', () => {
  const news = { generatedAt: NOW.toISOString(), newsam: { en: [{ articles: [art(2)] }] } }
  assert.deepEqual(checkNews(news, NOW), [])
})

test('checkNews : une source figée au-delà de son seuil est signalée, avec son âge', () => {
  const news = { generatedAt: NOW.toISOString(), newsam: { en: [{ articles: [art(200), art(300)] }] } }
  const p = checkNews(news, NOW)
  assert.equal(p.length, 1)
  assert.match(p[0], /newsam\/en/)
  assert.match(p[0], /8 j/) // 200 h
})

test('checkNews : une source à liste plate (sans langue) est lue aussi', () => {
  const news = { generatedAt: NOW.toISOString(), courrier: [{ sectionKey: 'a', articles: [art(500)] }] }
  assert.match(checkNews(news, NOW)[0], /courrier/)
})

test('checkNews : une source vide est signalée', () => {
  const news = { generatedAt: NOW.toISOString(), civilnet: { fr: [] } }
  assert.match(checkNews(news, NOW)[0], /civilnet\/fr.*aucun article daté/)
})

test('checkNews : une source qui publie par numéros (Artzakank) n’est jamais signalée', () => {
  assert.equal(staleHours('artzakank', '-'), null)
  const news = { generatedAt: NOW.toISOString(), artzakank: [{ articles: [art(2000)] }] }
  assert.deepEqual(checkNews(news, NOW), [])
})

test('checkNews : les hebdomadaires ont un seuil plus long que les agences', () => {
  assert.ok(staleHours('californiacourier', 'fr') > staleHours('newsam', 'en'))
  const news = { generatedAt: NOW.toISOString(), californiacourier: { fr: [{ articles: [art(200)] }] } }
  assert.deepEqual(checkNews(news, NOW), [])
})

test('Armenpress es : seuil de 96 h (rien le week-end) ; 63 h de silence ne signale rien', () => {
  assert.equal(staleHours('armenpress', 'es'), 96)
  const news = { generatedAt: NOW.toISOString(), armenpress: { es: [{ articles: [art(63)] }] } }
  assert.deepEqual(checkNews(news, NOW), [])
})

test('STALE_HOURS : chaque seuil est un nombre d’heures positif ou null', () => {
  for (const [k, v] of Object.entries(STALE_HOURS)) assert.ok(v === null || (Number.isFinite(v) && v > 0), k)
})

test('checkBriefs : avant midi à Erevan, une brève absente n’est pas encore une panne', () => {
  const morning = new Date('2026-10-24T06:00:00Z') // 10 h à Erevan
  assert.deepEqual(checkBriefs({}, morning), [])
})

test('checkBriefs : après midi à Erevan, chaque langue sans brève du jour est signalée', () => {
  const dates = Object.fromEntries(ALL_LANGS.map((l) => [l, ['2026-10-24']]))
  dates.hy = ['2026-10-23']
  const p = checkBriefs(dates, NOW)
  assert.equal(p.length, 1)
  assert.match(p[0], /hy.*2026-10-24/)
})

test('checkAgenda : un agenda sans événement à venir est signalé', () => {
  assert.equal(checkAgenda({ switzerland: [], world: [] }, NOW).length, 1)
  const ev = { title: 'e', url: 'https://a/1', date: '2026-11-01T19:00' }
  assert.deepEqual(checkAgenda({ switzerland: [ev], world: [] }, NOW), [])
})

test('healthReport : un rapport sain n’a aucun problème', () => {
  const r = healthReport({ problems: [] })
  assert.equal(r.ok, true)
})

test('healthReport : le rapport en panne liste chaque problème en Markdown', () => {
  const r = healthReport({ problems: ['a', 'b'] })
  assert.equal(r.ok, false)
  assert.match(r.markdown, /- a\n- b/)
})

// Le classeur en panne range tout dans le défaut du fil, sans erreur : ses
// articles restent hors de rubric-cache.json. Mesuré du 16 au 24 octobre 2026 :
// 0 à 11 non classés sur 291 ; 171 le jour de la panne du 15.
const mixedNews = (n) => ({
  courrier: [{ sectionKey: 'actualite', articles: Array.from({ length: n }, (_, i) => ({ title: 't', url: 'https://c/' + i })) }],
})
test('checkClassify : quelques articles en attente de classement ne sont pas une panne', () => {
  const news = mixedNews(MAX_UNCLASSIFIED)
  assert.deepEqual(checkClassify(news, {}, { courrier: { actualite: { mixed: 'armenie' } } }), [])
})
test('checkClassify : au-delà du seuil, le classeur est signalé en panne', () => {
  const p = checkClassify(mixedNews(MAX_UNCLASSIFIED + 1), {}, { courrier: { actualite: { mixed: 'armenie' } } })
  assert.equal(p.length, 1)
  assert.match(p[0], /classement/)
})
test('checkClassify : des articles en cache sont classés', () => {
  const news = mixedNews(100)
  const cache = Object.fromEntries(Array.from({ length: 100 }, (_, i) => ['https://c/' + i, 'politique']))
  assert.deepEqual(checkClassify(news, cache, { courrier: { actualite: { mixed: 'armenie' } } }), [])
})

// Une étape en continue-on-error rend « success » à l'API même en échec :
// seul steps.<id>.outcome dit la vérité, et le job le passe ici.
test('checkSteps : une capture d’écran en échec est signalée, un succès ou un saut non', () => {
  assert.equal(checkSteps({ screenshot: 'failure' }).length, 1)
  assert.deepEqual(checkSteps({ screenshot: 'success' }), [])
  assert.deepEqual(checkSteps({ screenshot: 'skipped' }), [])
  assert.deepEqual(checkSteps({}), [])
})

test('checkSteps : une purge des salles en échec est signalée, et nomme le rôle IAM', () => {
  const [ligne, ...reste] = checkSteps({ purge: 'failure', screenshot: 'success' })
  assert.deepEqual(reste, [])
  assert.match(ligne, /salles/)
  assert.match(ligne, /Realtime Database Admin/)
  assert.deepEqual(checkSteps({ purge: 'success' }), [])
})

// Le site ne fait que REMÉLANGER le pool ; seule une récolte locale
// (npm run ig-scrape) apporte des posts neufs. Rien ne le rappelait.
test('checkHarvest : une récolte de moins de trois semaines ne dit rien', () => {
  assert.deepEqual(checkHarvest({ harvestedAt: hoursAgo(24 * 20) }, NOW), [])
})
test('checkHarvest : au-delà de MAX_HARVEST_DAYS, un rappel de récolte', () => {
  const p = checkHarvest({ harvestedAt: hoursAgo(24 * (MAX_HARVEST_DAYS + 1)) }, NOW)
  assert.equal(p.length, 1)
  assert.match(p[0], /ig-scrape/)
})
test('checkHarvest : un pool sans date de récolte n’alerte pas (on ne devine pas)', () => {
  assert.deepEqual(checkHarvest({}, NOW), [])
})

// --- Résumés d'articles ---------------------------------------------------
const RNOW = new Date('2026-11-28T12:00:00Z')
const rArticles = (n) =>
  Array.from({ length: n }, (_, i) => ({ url: `https://x.test/${i}`, lang: 'en', date: '2026-11-28T06:00:00Z' }))
// Des entrées anciennes, hors des 24 h, pour franchir MIN_RESUME_ARCHIVE.
const rFiller = () =>
  Object.fromEntries(Array.from({ length: MIN_RESUME_ARCHIVE }, (_, i) => [`https://old.test/${i}`, { resumes: { en: 'x' } }]))
const rArchive = (k) => ({
  ...rFiller(),
  ...Object.fromEntries(rArticles(k).map((a) => [a.url, { resumes: { en: 'texte' } }])),
})

test('checkArticleResumes : couverture sous 30 % signalée, avec le compte et le signe au log', () => {
  const p = checkArticleResumes(rArticles(30), rArchive(5), RNOW)
  assert.equal(p.length, 1)
  assert.ok(p[0].startsWith("**résumés d'articles**"))
  assert.match(p[0], /5 sur 30/)
  assert.match(p[0], /« ✗ résumé-article » au log/)
})
test('checkArticleResumes : couverture suffisante, rien', () => {
  assert.deepEqual(checkArticleResumes(rArticles(30), rArchive(20), RNOW), [])
})
test('checkArticleResumes : échantillon trop petit, rien', () => {
  assert.ok(10 < MIN_RESUME_SAMPLE)
  assert.deepEqual(checkArticleResumes(rArticles(10), {}, RNOW), [])
})
test('checkArticleResumes : un article français exige fr, de et it', () => {
  const arts = rArticles(30).map((a) => ({ ...a, lang: 'fr' }))
  const arch = { ...rFiller(), ...Object.fromEntries(arts.map((a) => [a.url, { resumes: { fr: 'a' } }])) }
  assert.equal(checkArticleResumes(arts, arch, RNOW).length, 1)
})
test('checkArticleResumes : archive au lancement (< MIN_RESUME_ARCHIVE entrées), rien', () => {
  const small = Object.fromEntries(rArticles(5).map((a) => [a.url, { resumes: { en: 'texte' } }]))
  assert.ok(Object.keys(small).length < MIN_RESUME_ARCHIVE)
  assert.deepEqual(checkArticleResumes(rArticles(30), small, RNOW), [])
})
test('checkArticleResumes : les hôtes de NO_RESUME_HOSTS sortent du dénominateur', () => {
  const cc = Array.from({ length: 60 }, (_, i) => ({
    url: `https://www.thecaliforniacourier.com/${i}`, lang: 'en', date: '2026-11-28T06:00:00Z',
  }))
  // 20 articles résumés sur 20 joignables : couverture pleine malgré 60 Courier (25 % sans la sortie).
  assert.deepEqual(checkArticleResumes([...rArticles(20), ...cc], rArchive(20), RNOW), [])
})
