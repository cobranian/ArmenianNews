import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cultureHeadFor } from '../scripts/lib/site-meta.mjs'
import { cultureAlternates } from '../scripts/lib/culture-links.mjs'
import { ALL_LANGS } from '../sites.config.js'

const art = (image = { author: 'A', license: 'CC0', commonsUrl: 'https://c', width: 1200, height: 800 }) => ({
  slug: 'komitas', date: '2026-10-19', image,
  sources: [{ url: 'https://fr.wikipedia.org/wiki/Komitas' }],
  langs: {
    fr: { title: 'Komitas, <le> père', description: 'Desc "fr"', date: '2026-10-19', body: 'x' },
    en: { title: 'Komitas EN', description: 'Desc en', date: '2026-10-19', body: 'x' },
  },
})
const bySlug = new Map([['komitas', ['fr', 'en']]])
const alts = (h) => [...h.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])

test('page article : canonical, hreflang des langues présentes, carte propre, Article', () => {
  const h = cultureHeadFor({ siteId: 'ch', lang: 'fr', slug: 'komitas', article: art(), bySlug })
  assert.ok(h.includes('<link rel="canonical" href="https://armenieinfo.ch/culture/komitas/" />'))
  assert.deepEqual(alts(h), cultureAlternates('komitas', bySlug))
  assert.ok(h.includes('<meta property="og:image" content="https://armenieinfo.ch/culture/komitas/image.jpg" />'))
  assert.ok(h.includes('<meta property="og:type" content="article" />'))
  assert.ok(h.includes('<title>Komitas, &lt;le&gt; père · Arménie Info</title>'))
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'))
  const a = ld['@graph'].find((n) => n['@type'] === 'Article')
  assert.equal(a.headline, 'Komitas, <le> père')
  assert.equal(a.datePublished, '2026-10-19')
  assert.deepEqual(a.citation, ['https://fr.wikipedia.org/wiki/Komitas'])
})

test('article sans image : carte de la vitrine', () => {
  const h = cultureHeadFor({ siteId: 'org', lang: 'en', slug: 'komitas', article: art(null), bySlug })
  assert.ok(h.includes('<meta property="og:image" content="https://armenianews.org/og-image-org.jpg" />'))
})

test('index : toutes les langues, pas d’Article, robots transmis', () => {
  const h = cultureHeadFor({ siteId: 'org', lang: 'hy', bySlug, robots: 'noindex, follow' })
  assert.equal(alts(h).length, ALL_LANGS.length + 1)
  assert.ok(!h.includes('"Article"'))
  assert.ok(h.includes('<meta name="robots" content="noindex, follow" />'))
  assert.ok(h.includes('<link rel="canonical" href="https://armenianews.org/hy/culture/" />'))
})

test('article absent dans la langue demandée : lève', () => {
  assert.throws(() => cultureHeadFor({ siteId: 'org', lang: 'ru', slug: 'komitas', article: art(), bySlug }))
})

// --- SEO (audit du 17 octobre 2026).
const ldOf = (h) => JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'))

test('Article : sujet désigné par son entité Wikidata, nom de la Wikipédia de la langue', () => {
  const article = {
    ...art(),
    meta: { qid: 'Q12345' },
    sources: [
      { kind: 'wikipedia', lang: 'fr', title: 'Komitas (fr)', url: 'https://fr.wikipedia.org/wiki/Komitas' },
      { kind: 'wikipedia', lang: 'en', title: 'Komitas', url: 'https://en.wikipedia.org/wiki/Komitas' },
    ],
  }
  const g = ldOf(cultureHeadFor({ siteId: 'org', lang: 'en', slug: 'komitas', article, bySlug }))['@graph']
  const about = g.find((n) => n['@type'] === 'Article').about
  assert.equal(about['@id'], 'http://www.wikidata.org/entity/Q12345')
  assert.equal(about.name, 'Komitas')
  assert.deepEqual(about.sameAs, ['https://www.wikidata.org/wiki/Q12345', 'https://en.wikipedia.org/wiki/Komitas'])
})

test('Article sans qid : pas de champ about (jamais un qid inventé)', () => {
  const g = ldOf(cultureHeadFor({ siteId: 'ch', lang: 'fr', slug: 'komitas', article: art(), bySlug }))['@graph']
  assert.equal(g.find((n) => n['@type'] === 'Article').about, undefined)
})

test('fil d’Ariane : Accueil › Culture › article, URL absolues de la vitrine', () => {
  const g = ldOf(cultureHeadFor({ siteId: 'ch', lang: 'fr', slug: 'komitas', article: art(), bySlug }))['@graph']
  const bc = g.find((n) => n['@type'] === 'BreadcrumbList')
  assert.deepEqual(bc.itemListElement.map((x) => [x.position, x.name, x.item]), [
    [1, 'Accueil', 'https://armenieinfo.ch/'],
    [2, 'Culture arménienne', 'https://armenieinfo.ch/culture/'],
    [3, 'Komitas, <le> père', 'https://armenieinfo.ch/culture/komitas/'],
  ])
})
