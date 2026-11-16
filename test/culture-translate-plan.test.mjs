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
const load = async () => ({ article: await readArticle(DIR, SLUG), videos: await readVideos(DIR) })
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
