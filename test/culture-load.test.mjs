import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadCulture, articleSlugs, invalidDirs, unpublishedTranslations, unpublishedLine } from '../scripts/lib/culture-load.mjs'
import { cultureLangsBySlug, cultureAlternates, teaserFor } from '../scripts/lib/culture-links.mjs'
import { writeArticle, texts } from './helpers/culture-fixture.mjs'

const silent = () => { const w = []; return { warn: (m) => w.push(m), w } }

test('loadCulture : tri par date, article cassé ignoré avec avertissement', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  await writeArticle(dir, 'komitas', { t: texts({ date: '2026-10-19' }) })
  await writeArticle(dir, 'duduk', { t: texts({ date: '2026-10-26' }) })
  await writeArticle(dir, 'casse', { t: { ...texts(), fr: 'pas de front-matter' } })
  await writeFile(path.join(dir, 'sujets.json'), '{}')
  await mkdir(path.join(dir, 'Pas_Un_Slug'))
  const log = silent()
  const got = await loadCulture(dir, log)
  assert.deepEqual(got.map((a) => a.slug), ['duduk', 'komitas'])
  assert.ok(log.w.some((m) => /culture\/casse/.test(m)))
  assert.deepEqual(await articleSlugs(dir), ['casse', 'duduk', 'komitas'])
  assert.equal(got[0].image.width, 1200)
  assert.equal(got[0].sources[0].url, 'https://fr.wikipedia.org/wiki/Komitas')
})

test('loadCulture : dossier au nom invalide signalé', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  await writeArticle(dir, 'komitas')
  await mkdir(path.join(dir, 'Duduk'))
  const log = silent()
  assert.deepEqual((await loadCulture(dir, log)).map((a) => a.slug), ['komitas'])
  assert.ok(log.w.some((m) => m.includes('⚠ culture/Duduk : nom de dossier invalide (ignoré)')), log.w.join('\n'))
  assert.deepEqual(await invalidDirs(dir), ['Duduk'])
})

test('traductions non publiées : compte et ligne du build', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  const t = texts()
  t.fr = t.fr.replace('Second paragraphe.', 'Second paragraphe corrigé sur main.')
  await writeArticle(dir, 'komitas', { t })
  await writeArticle(dir, 'duduk', { t: { ...texts(), ru: null } })
  const arts = await loadCulture(dir, silent())
  assert.equal(unpublishedTranslations(arts), 4)
  assert.equal(
    unpublishedLine(arts),
    '⚠ culture : 4 traduction(s) non publiée(s) (périmées ou absentes) — voir les avertissements ci-dessus',
  )
  const full = await mkdtemp(path.join(tmpdir(), 'culture-'))
  await writeArticle(full, 'komitas')
  assert.equal(unpublishedLine(await loadCulture(full, silent())), null)
  assert.equal(unpublishedLine([]), null)
})

test('loadCulture : dossier absent → liste vide', async () => {
  assert.deepEqual(await loadCulture(path.join(tmpdir(), 'nexiste-pas-culture'), silent()), [])
})

test('alternates : seulement les langues présentes ; index dans les quatre', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  await writeArticle(dir, 'komitas', { t: { ...texts(), hy: null } })
  const arts = await loadCulture(dir, silent())
  const bySlug = cultureLangsBySlug(arts)
  assert.deepEqual(bySlug.get('komitas'), ['fr', 'en', 'ru'])
  assert.deepEqual(cultureAlternates('komitas', bySlug), [
    ['fr', 'https://armenieinfo.ch/culture/komitas/'],
    ['en', 'https://armenianews.org/culture/komitas/'],
    ['ru', 'https://armenianews.org/ru/culture/komitas/'],
    ['x-default', 'https://armenianews.org/culture/komitas/'],
  ])
  assert.equal(cultureAlternates(null, bySlug).length, 5)
  assert.deepEqual(cultureAlternates('inconnu', bySlug), [])
})

test('teaserFor : trois plus récents par langue, langue absente exclue', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  for (const [s, d] of [['a', '2026-10-01'], ['b', '2026-10-08'], ['c', '2026-10-15'], ['d', '2026-10-22']])
    await writeArticle(dir, s, { t: texts({ date: d, title: s.toUpperCase() }) })
  await writeArticle(dir, 'e', { t: { ...texts({ date: '2026-10-29', title: 'E' }), ru: null } })
  const t = teaserFor(await loadCulture(dir, silent()), ['fr', 'ru'])
  assert.deepEqual(t.fr.map((x) => x.slug), ['e', 'd', 'c'])
  assert.deepEqual(t.ru.map((x) => x.slug), ['d', 'c', 'b'])
  assert.deepEqual(Object.keys(t.fr[0]).sort(), ['date', 'description', 'image', 'slug', 'title'])
})
