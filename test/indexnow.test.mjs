import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { INDEXNOW_KEY, parseSitemap, urlsToSubmit, payloadFor } from '../scripts/lib/indexnow.mjs'
import { sitemapFor } from '../scripts/lib/sitemap.mjs'

// Le fichier de clé prouve la propriété de l'hôte : absent ou divergent, chaque
// soumission répond « key not valid » et rien d'autre ne casse.
test('le fichier de clé IndexNow est servi depuis public/ et contient la clé', () => {
  const f = new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url)
  assert.ok(existsSync(f), `public/${INDEXNOW_KEY}.txt manquant`)
  assert.equal(readFileSync(f, 'utf8').trim(), INDEXNOW_KEY)
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{8,128}$/)
})

test('parseSitemap lit le sitemap que le dépôt écrit', () => {
  const m = parseSitemap(sitemapFor('ch', '2026-10-19T10:00:00Z'))
  assert.equal(m.get('https://armenieinfo.ch/'), '2026-10-19T10:00:00Z')
  assert.ok(m.size >= 4)
})

test('urlsToSubmit : nouvelles URL et jour changé, pas l’heure', () => {
  const before = new Map([['https://a.ch/', '2026-10-19T08:00:00Z'], ['https://a.ch/x/', '2026-10-01']])
  const after = new Map([
    ['https://a.ch/', '2026-10-19T09:00:00Z'], // même jour → non
    ['https://a.ch/x/', '2026-10-01'], // inchangée → non
    ['https://a.ch/new/', '2026-10-19'], // nouvelle → oui
  ])
  assert.deepEqual(urlsToSubmit(before, after), ['https://a.ch/new/'])
  after.set('https://a.ch/', '2026-10-20T00:23:00Z')
  assert.deepEqual(urlsToSubmit(before, after), ['https://a.ch/', 'https://a.ch/new/'])
})

test('urlsToSubmit : sitemap en ligne illisible → rien, jamais tout', () => {
  assert.deepEqual(urlsToSubmit(new Map(), new Map([['https://a.ch/', 'x']])), [])
})

test('payloadFor refuse un lot qui mêle les hôtes', () => {
  const p = payloadFor('https://armenieinfo.ch', ['https://armenieinfo.ch/culture/'])
  assert.equal(p.host, 'armenieinfo.ch')
  assert.equal(p.keyLocation, `https://armenieinfo.ch/${INDEXNOW_KEY}.txt`)
  assert.throws(() => payloadFor('https://armenieinfo.ch', ['https://armenianews.org/']))
})
