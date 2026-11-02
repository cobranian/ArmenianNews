// Invariant : un titre court (src/data/culture-seo-titles.json) ne remplace le
// <title> que d'un article dont le titre dépasse TITLE_MAX, tient lui-même
// dans TITLE_MAX, et désigne un article et une langue qui existent. Le <h1> et
// le JSON-LD gardent le titre complet.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { cultureHeadFor, TITLE_MAX } from '../scripts/lib/site-meta.mjs'

const titles = JSON.parse(await readFile(new URL('../src/data/culture-seo-titles.json', import.meta.url), 'utf-8'))

test('chaque titre court tient dans TITLE_MAX et vise un article existant', () => {
  for (const [slug, langs] of Object.entries(titles))
    for (const [lang, t] of Object.entries(langs)) {
      assert.ok([...t].length <= TITLE_MAX, `${slug}/${lang} : ${[...t].length} caractères`)
      assert.ok(t.trim().length >= 10, `${slug}/${lang} : titre vide`)
      assert.ok(existsSync(new URL(`../src/data/culture/${slug}/${lang}.md`, import.meta.url)), `${slug}/${lang}.md absent`)
    }
})

const long = 'Un titre d’article Culture bien trop long pour tenir dans les résultats de Google'
const article = { slug: 'x', langs: { fr: { title: long, description: 'D', date: '2026-10-20', body: '' } }, sources: [] }
const bySlug = new Map([['x', ['fr']]])
const head = (seoTitle, a = article) => cultureHeadFor({ siteId: 'ch', lang: 'fr', slug: 'x', article: a, bySlug, seoTitle })
const titre = (h) => h.match(/<title>(.*?)<\/title>/)[1]

test('titre long + titre court : le <title> prend le court, le JSON-LD garde le long', () => {
  const h = head('Titre court')
  assert.equal(titre(h), 'Titre court · Arménie Info')
  assert.match(h, /"headline":"Un titre d’article Culture bien trop long/)
})

test('sans titre court, ou titre court trop long : titre complet', () => {
  assert.equal(titre(head(null)), long)
  assert.equal(titre(head('x'.repeat(TITLE_MAX + 1))), long)
})

test('article dont le titre tient : le titre court est ignoré', () => {
  const court = { ...article, langs: { fr: { ...article.langs.fr, title: 'Ani' } } }
  assert.equal(titre(head('Autre chose', court)), 'Ani · Arménie Info')
})
