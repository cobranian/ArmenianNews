import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { briefLangsByDate, briefAlternates, longDate } from '../scripts/lib/brief-links.mjs'
import { briefHeadFor, headFor } from '../scripts/lib/site-meta.mjs'
import { briefUrl } from '../sites.config.js'

const HEAD_SNAPSHOT = readFileSync(new URL('./fixtures/head-ch-fr-radio.txt', import.meta.url), 'utf-8')
  .replace(/\r\n/g, '\n')

const b = (lang, date, extra = {}) => ({
  date, lang, generatedAt: `${date}T03:23:00Z`, model: 'm', intro: `Intro ${lang}`,
  topics: [{ title: 'T', text: 'x', rubric: 'politique', sources: [{ source: 'armenpress', url: 'https://a/1', title: 'A' }] }],
  ...extra,
})
const briefs = {
  fr: [b('fr', '2026-10-16')],
  en: [b('en', '2026-10-15')],
  hy: [b('hy', '2026-10-16'), b('hy', '2026-10-15')],
  ru: [],
}

test('briefLangsByDate : langues présentes par date, ordre ALL_LANGS', () => {
  const m = briefLangsByDate(briefs)
  assert.deepEqual(m.get('2026-10-16'), ['fr', 'hy'])
  assert.deepEqual(m.get('2026-10-15'), ['en', 'hy'])
})

test('briefAlternates : index = langues qui ont une brève + x-default anglais', () => {
  const byDate = briefLangsByDate(briefs)
  const alt = briefAlternates(null, byDate, 'fr')
  assert.deepEqual(alt.map(([h]) => h), ['fr', 'en', 'hy', 'x-default'])
  assert.equal(alt.at(-1)[1], briefUrl('en'))
  // Réciprocité : chaque index cité cite exactement le même ensemble.
  for (const l of ['fr', 'en', 'hy']) assert.deepEqual(briefAlternates(null, byDate, l), alt, l)
  // Un index vide (noindex, jamais cité) se cite tout de même lui-même.
  assert.deepEqual(briefAlternates(null, byDate, 'de').map(([h]) => h), ['fr', 'de', 'en', 'hy', 'x-default'])
  assert.deepEqual(briefAlternates(null, new Map(), 'it'), [['it', briefUrl('it')]])
})

test('briefAlternates : page datée = langues présentes seulement', () => {
  const byDate = briefLangsByDate(briefs)
  // en absent le 16 : pas de x-default (il désignerait une page inexistante).
  assert.deepEqual(briefAlternates('2026-10-16', byDate), [
    ['fr', briefUrl('fr', '2026-10-16')],
    ['hy', briefUrl('hy', '2026-10-16')],
  ])
  assert.deepEqual(briefAlternates('2026-10-15', byDate).map(([h]) => h), ['en', 'hy', 'x-default'])
})

test('longDate : fr/en/ru par Intl (Node), hy par hyDate', () => {
  assert.equal(longDate('fr', '2026-10-16'), 'vendredi 16 octobre 2026')
  assert.equal(longDate('en', '2026-10-16'), 'Friday, October 16, 2026')
  assert.match(longDate('hy', '2026-10-16'), /^16 հոկտեմբերի, 2026 թ\.$/)
  assert.match(longDate('ru', '2026-10-16'), /16 октября 2026/)
})

test('briefHeadFor : page datée', () => {
  const byDate = briefLangsByDate(briefs)
  const h = briefHeadFor({ siteId: 'org', lang: 'hy', date: '2026-10-16', brief: briefs.hy[0], byDate })
  assert.ok(h.includes(`<link rel="canonical" href="${briefUrl('hy', '2026-10-16')}" />`))
  assert.equal((h.match(/hreflang=/g) || []).length, 2)
  assert.ok(!h.includes('hreflang="en"'))
  assert.ok(h.includes('<meta property="og:type" content="article" />'))
  assert.ok(h.includes('"@type":"NewsArticle"'))
  assert.ok(h.includes('"image":"https://armenianews.org/og-image-org.jpg"'))
  assert.ok(h.includes('"author":{"@id":"https://armenianews.org/#organization"}'))
  assert.ok(h.includes('"citation":["https://a/1"]'))
  assert.ok(h.includes('content="Intro hy"'))
})

test('briefHeadFor : index sans brève — description par défaut, ne cite que lui-même', () => {
  const h = briefHeadFor({ siteId: 'ch', lang: 'fr', byDate: new Map() })
  assert.ok(h.includes(`<link rel="canonical" href="${briefUrl('fr')}" />`))
  assert.deepEqual([...h.matchAll(/hreflang="([^"]+)"/g)].map((m) => m[1]), ['fr'])
  assert.ok(h.includes('<title>La brève du jour · Arménie Info</title>'))
  assert.ok(!h.includes('NewsArticle'))
})

test('briefHeadFor échappe < dans le JSON-LD', () => {
  const evil = b('fr', '2026-10-16', { intro: '</script><script>alert(1)</script>' })
  const h = briefHeadFor({ siteId: 'ch', lang: 'fr', date: '2026-10-16', brief: evil, byDate: briefLangsByDate({ fr: [evil] }) })
  assert.ok(!h.includes('</script><script>'))
})

test('briefHeadFor échappe " et & dans la description', () => {
  const odd = b('fr', '2026-10-16', { intro: 'Le "oui" & le non' })
  const h = briefHeadFor({ siteId: 'ch', lang: 'fr', date: '2026-10-16', brief: odd, byDate: briefLangsByDate({ fr: [odd] }) })
  assert.ok(h.includes('<meta name="description" content="Le &quot;oui&quot; &amp; le non" />'))
})

test('headFor inchangé par la factorisation', () => {
  // Instantané de garde : la sortie capturée AVANT la factorisation.
  assert.equal(headFor({ siteId: 'ch', lang: 'fr', view: 'radio' }), HEAD_SNAPSHOT)
})
