// Ce qu'articles-publish.yml retraduit avant la fusion. Le piège gardé : un
// Short en/hy/ru périmé ou non conforme fait échouer culture-check, et le
// robot retraduisait alors les SIX articles déjà relus (au modèle de secours,
// parfois). Un <lang>.md à jour ne doit jamais repartir au modèle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readArticle, readVideos } from '../scripts/lib/culture-load.mjs'
import { validateArticle } from '../scripts/lib/culture-validate.mjs'
import { translationRuns } from '../scripts/lib/culture-video-plan.mjs'
import { shortHash, shortNeedsTranslation } from '../scripts/lib/culture-short.mjs'

const DIR = fileURLToPath(new URL('../src/data/culture/', import.meta.url))
const SLUG = 'khorovats-et-la-tradition-du-barbecue-armenien'
// L'article sert de cas « vidéo pas encore publiée » : ses entrées de
// culture-videos.json sont retirées, sinon un Short fautif n'y est plus
// qu'une note (vidéo déjà en ligne) et ces tests suivraient la publication.
const load = async () => {
  const videos = await readVideos(DIR)
  delete videos[SLUG]
  return { article: await readArticle(DIR, SLUG), videos }
}
const plan = (article, videos, checkPassed) =>
  translationRuns(validateArticle({ ...article, videos }), { slug: SLUG, videos, meta: article.meta, checkPassed })

test('article complet et conforme : rien à traduire', async () => {
  const { article, videos } = await load()
  assert.deepEqual(plan(article, videos, true), [])
  assert.deepEqual(plan(article, videos, false), [])
})

test('Short en périmé (short fr retouché) : --short-only sur en, aucun article retraduit', async () => {
  const { article, videos } = await load()
  const en = JSON.parse(article.shorts.en)
  const stale = { ...article, shorts: { ...article.shorts, en: JSON.stringify({ ...en, sourceHash: 'x' }) } }
  const r = validateArticle({ ...stale, videos })
  assert.ok(r.errors.some((e) => e.startsWith('short.en.json')), 'culture-check échoue bien')
  assert.deepEqual(plan(stale, videos, false), [['--short-only', '--langs', 'en']])
})

test('Short hy à jour mais non conforme : --short-only sur hy', async () => {
  const { article, videos } = await load()
  const hy = JSON.parse(article.shorts.hy)
  const bad = { ...article, shorts: { ...article.shorts, hy: JSON.stringify({ ...hy, facts: hy.facts.slice(1) }) } }
  assert.deepEqual(plan(bad, videos, false), [['--short-only', '--langs', 'hy']])
})

test('Short fr retouché : tous les Shorts traduits, contre les articles relus', async () => {
  const { article, videos } = await load()
  const fr = JSON.parse(article.shorts.fr)
  const shorts = { ...article.shorts, fr: JSON.stringify({ ...fr, ytLead: `${fr.ytLead} Encore.` }) }
  assert.deepEqual(plan({ ...article, shorts }, videos, false), [['--short-only', '--langs', 'de,it,en,es,hy,ru']])
})

test('ru.md périmé et Short de absent : ru retraduit seul, de en --short-only', async () => {
  const { article, videos } = await load()
  const texts = { ...article.texts, ru: article.texts.ru.replace(/sourceHash: \S+/, 'sourceHash: "perime"') }
  const shorts = { ...article.shorts, de: null }
  assert.deepEqual(plan({ ...article, texts, shorts }, videos, false), [['--langs', 'ru'], ['--short-only', '--langs', 'de']])
})

test('contrôle passé : un article facultatif absent n’est pas traduit, son Short non plus', async () => {
  const { article, videos } = await load()
  const texts = { ...article.texts, it: null }
  assert.deepEqual(plan({ ...article, texts }, videos, true), [])
  assert.deepEqual(plan({ ...article, texts }, videos, false), [['--langs', 'it']])
})

test('image changée sans autre travail : un --short-only seul (synchronise l’image)', async () => {
  const { article, videos } = await load()
  const other = { ...article.meta.image, commonsUrl: 'https://commons.wikimedia.org/wiki/File:Autre.jpg' }
  const meta = { ...article.meta, candidates: [other], imageChoice: 0 }
  assert.deepEqual(plan({ ...article, meta }, videos, false), [['--short-only']])
})

// Revue du 27 nov. : une image de vidéo remplacée à la main dans la PR, sans
// autre travail, laissait le plan vide — la publication ne la relisait
// jamais, et le Short partait sans le choix du relecteur.
test('image de vidéo remplacée à la main sans autre travail : un --short-only seul', async () => {
  const { article, videos } = await load()
  const meta = { ...article.meta, shortImages: [{ file: 'File:Choisie.jpg', commonsUrl: 'https://commons.wikimedia.org/wiki/File:Ancienne.jpg' }] }
  assert.deepEqual(plan({ ...article, meta }, videos, false), [['--short-only']])
  const synced = { ...article.meta, shortImages: [{ file: 'File:Choisie.jpg', commonsUrl: 'https://commons.wikimedia.org/wiki/File:Choisie.jpg' }] }
  assert.deepEqual(plan({ ...article, meta: synced }, videos, false), [])
})

test('fr.md illisible : aucune traduction n’y peut rien', () => {
  assert.deepEqual(translationRuns({ langs: {}, shorts: {} }, { slug: 'x', videos: {}, meta: {}, checkPassed: false }), [])
})

test('shortNeedsTranslation : absent, périmé, non conforme → oui ; à jour et conforme → non', async () => {
  const { article } = await load()
  const fr = JSON.parse(article.shorts.fr)
  const en = JSON.parse(article.shorts.en)
  const ctx = { want: shortHash(fr), lang: 'en', articleText: article.texts.en }
  assert.equal(shortNeedsTranslation(en, ctx), false)
  assert.equal(shortNeedsTranslation(null, ctx), true)
  assert.equal(shortNeedsTranslation({ ...en, sourceHash: 'x' }, ctx), true)
  assert.equal(shortNeedsTranslation({ ...en, facts: [] }, ctx), true)
})

// Zvartnots (17 nov. 2026) : le brouillon n'avait pas pu écrire short.fr.json
// (garde des nombres) et rien ne le rattrapait — l'article partait sans vidéo.
test('Short fr absent, vidéos pas en ligne : --short-only sur toutes les langues (fr rédigé d’abord)', async () => {
  const { article, videos } = await load()
  const shorts = { ...article.shorts }
  delete shorts.fr
  assert.deepEqual(plan({ ...article, shorts }, videos, false), [['--short-only', '--langs', 'de,it,en,es,hy,ru']])
})

test('Short fr absent, mais les vidéos sont en ligne (Garni) : rien', async () => {
  const videos = await readVideos(DIR)
  const article = await readArticle(DIR, SLUG)
  const shorts = { ...article.shorts }
  delete shorts.fr
  assert.deepEqual(plan({ ...article, shorts }, videos, false), [])
})

test('Short fr absent, seules les autres langues en ligne : --short-only seul', async () => {
  const videos = await readVideos(DIR)
  videos[SLUG] = Object.fromEntries(Object.entries(videos[SLUG]).filter(([l]) => l !== 'fr'))
  const article = await readArticle(DIR, SLUG)
  const shorts = { ...article.shorts }
  delete shorts.fr
  assert.deepEqual(plan({ ...article, shorts }, videos, false), [['--short-only']])
})
