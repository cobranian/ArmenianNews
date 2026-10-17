import { test } from 'node:test'
import assert from 'node:assert/strict'
import { llmsFor } from '../scripts/lib/llms.mjs'
import { SITES, urlFor, cultureUrl, briefUrl } from '../sites.config.js'

const culture = [{
  slug: 'duduk',
  langs: {
    fr: { title: 'Le duduk', description: 'Desc fr' },
    en: { title: 'The duduk', description: 'Desc en' },
  },
}]
const briefs = { fr: [{ date: '2026-10-17', intro: 'Intro fr' }], en: [], hy: [], ru: [] }
const links = (txt) => [...txt.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((m) => m[1])

test('llms.txt du .ch : marque, vues, brève datée, articles — en français seulement', () => {
  const t = llmsFor('ch', { briefs, culture })
  assert.ok(t.startsWith('# Arménie Info\n'))
  for (const u of [urlFor('fr'), urlFor('fr', 'radio'), urlFor('fr', 'agenda'), urlFor('fr', 'about'),
    briefUrl('fr'), briefUrl('fr', '2026-10-17'), cultureUrl('fr'), cultureUrl('fr', 'duduk')])
    assert.ok(links(t).includes(u), u)
  assert.ok(!t.includes('The duduk'))
  // Seule URL hors vitrine : le renvoi vers le llms.txt du voisin.
  assert.deepEqual(links(t).filter((u) => !u.startsWith(SITES.ch.host + '/')), [`${SITES.org.host}/llms.txt`])
})

test('llms.txt du .org : trois langues, article absent d’une langue non listé', () => {
  const t = llmsFor('org', { briefs, culture })
  assert.ok(t.startsWith('# Armenia News\n'))
  for (const l of ['en', 'hy', 'ru']) assert.ok(links(t).includes(urlFor(l)), l)
  assert.ok(links(t).includes(cultureUrl('en', 'duduk')))
  assert.ok(!links(t).includes(cultureUrl('hy', 'duduk')))
  assert.deepEqual(links(t).filter((u) => u.startsWith(SITES.ch.host)), [`${SITES.ch.host}/llms.txt`])
})
