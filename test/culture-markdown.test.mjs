import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseFrontMatter, serializeFrontMatter, renderMarkdown, bodyHash,
} from '../scripts/lib/culture-markdown.mjs'

test('aller-retour du front-matter, guillemets et deux-points compris', () => {
  const data = { title: 'Komitas : le "père" de la musique', description: 'a: b', date: '2026-10-19' }
  const text = serializeFrontMatter(data, 'Corps.\n\n## Titre')
  const back = parseFrontMatter(text)
  assert.deepEqual(back.data, data)
  assert.equal(back.body, 'Corps.\n\n## Titre')
})

test('front-matter édité à la main : valeur non citée avec deux-points, BOM, CRLF', () => {
  const t = '﻿---\r\ntitle: Komitas : le père\r\ndate: 2026-10-19\r\n---\r\n\r\nLigne 1\r\nLigne 2\r\n'
  const { data, body } = parseFrontMatter(t)
  assert.equal(data.title, 'Komitas : le père')
  assert.equal(body, 'Ligne 1\nLigne 2')
})

test('front-matter cassé : message lisible', () => {
  assert.throws(() => parseFrontMatter('title: x\n\ncorps'), /front-matter absent/)
  assert.throws(() => parseFrontMatter('---\ntitle x\n---\ncorps'), /illisible/)
  assert.throws(() => parseFrontMatter('---\ntitle: "x\n---\ncorps'), /illisible/)
})

test('renderMarkdown : intertitres, paragraphes, gras, italique', () => {
  const html = renderMarkdown('# Grand\n\n## Deux\n\n### Trois\n\nUn **gras** et *italique*\nsur deux lignes.')
  assert.equal(
    html,
    '<h2>Grand</h2>\n<h2>Deux</h2>\n<h3>Trois</h3>\n<p>Un <strong>gras</strong> et <em>italique</em> sur deux lignes.</p>',
  )
})

test('renderMarkdown neutralise le HTML et les liens dangereux', () => {
  const html = renderMarkdown('<script>alert(1)</script> [a](javascript:alert(1)) [b](//evil.com) [c](http://x.am)')
  assert.ok(!html.includes('<script'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!/href="javascript:/.test(html))
  assert.ok(!/href="\/\/evil/.test(html))
  assert.ok(!/href="http:/.test(html))
})

test('renderMarkdown garde les liens https et internes', () => {
  const html = renderMarkdown('[Wiki](https://fr.wikipedia.org/wiki/A?x=1&y=2) et [agenda](/agenda/)')
  assert.ok(html.includes('<a href="https://fr.wikipedia.org/wiki/A?x=1&amp;y=2" rel="noopener">Wiki</a>'))
  assert.ok(html.includes('<a href="/agenda/">agenda</a>'))
})

test('bodyHash : stable malgré CRLF et espaces de bord, sensible au texte', () => {
  assert.equal(bodyHash('a\r\nb\n'), bodyHash('  a\nb'))
  assert.notEqual(bodyHash('a b'), bodyHash('a c'))
  assert.match(bodyHash('x'), /^[0-9a-f]{16}$/)
})
