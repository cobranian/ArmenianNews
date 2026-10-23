// test/culture-sitemap.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sitemapFor } from '../scripts/lib/sitemap.mjs'

const A = (slug, date, langs) => ({
  slug, date, image: null, sources: [], meta: {},
  langs: Object.fromEntries(langs.map((l) => [l, { title: slug, description: 'd', date, body: 'b' }])),
})
const culture = [A('duduk', '2026-10-26', ['fr', 'en', 'hy']), A('komitas', '2026-10-19', ['fr', 'en', 'hy', 'ru'])]

test('sitemap .org : index et articles par langue, hreflang des langues présentes', () => {
  const xml = sitemapFor('org', '2026-10-27T10:00:00Z', {}, culture)
  assert.ok(xml.includes('<loc>https://armenianews.org/culture/</loc>'))
  assert.ok(xml.includes('<loc>https://armenianews.org/ru/culture/komitas/</loc>'))
  assert.ok(!xml.includes('<loc>https://armenianews.org/ru/culture/duduk/</loc>'))
  assert.ok(!xml.includes('<loc>https://armenieinfo.ch/'))
  const duduk = xml.split('<url>').find((b) => b.includes('<loc>https://armenianews.org/culture/duduk/</loc>'))
  assert.ok(duduk.includes('<lastmod>2026-10-26</lastmod>'))
  assert.ok(!duduk.includes('hreflang="ru"'))
  assert.ok(duduk.includes('hreflang="x-default" href="https://armenianews.org/culture/duduk/"'))
  // L'index ne cite pas les index vides (de, it) : ils sont noindex.
  const index = xml.split('<url>').find((b) => b.includes('<loc>https://armenianews.org/culture/</loc>'))
  assert.deepEqual([...index.matchAll(/hreflang="([^"]+)"/g)].map((m) => m[1]), ['fr', 'en', 'hy', 'ru', 'x-default'])
})

test('sitemap : un index de langue sans article n’est pas listé (il est noindex)', () => {
  const xml = sitemapFor('org', '2026-10-27T10:00:00Z', {}, [A('x', '2026-10-01', ['fr'])])
  assert.ok(!xml.includes('/culture/'))
  const ch = sitemapFor('ch', '2026-10-27T10:00:00Z', {}, [A('x', '2026-10-01', ['fr'])])
  assert.ok(ch.includes('<loc>https://armenieinfo.ch/culture/x/</loc>'))
})

test('sitemap sans culture : inchangé', () => {
  assert.equal(sitemapFor('ch', '2026-10-27T10:00:00Z', {}), sitemapFor('ch', '2026-10-27T10:00:00Z', {}, []))
})
