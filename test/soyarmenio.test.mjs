import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseRest, SECTIONS } from '../scripts/sources/soyarmenio.mjs'
import { RUBRIC_MAP } from '../src/rubrics.js'
import { SOURCE_NAMES } from '../src/newsLangs.js'

// Invariant : les réponses REST réelles de soyarmenio.com (posts + media, captées
// le 31 octobre 2026) donnent des articles {title, url, date ISO, image https},
// titres sans entités HTML, et chaque étagère est repliée sur une rubrique commune.
const posts = readFileSync(new URL('./fixtures/soyarmenio-posts.json', import.meta.url), 'utf-8')
const media = readFileSync(new URL('./fixtures/soyarmenio-media.json', import.meta.url), 'utf-8')

test('parseRest rend des articles complets', () => {
  const arts = parseRest(posts, media)
  assert.equal(arts.length, 10)
  for (const a of arts) {
    assert.ok(a.title && !/&#?\w+;/.test(a.title), `entité dans « ${a.title} »`)
    assert.match(a.url, /^https:\/\/soyarmenio\.com\//)
    assert.match(a.date, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
    assert.match(a.image, /^https:\/\//)
  }
  assert.ok(arts[1].title.includes('“Semillas”'), 'guillemets décodés')
  assert.ok(arts[1].image.includes('-768x526'), 'taille medium_large préférée')
})

test('un média introuvable laisse image à null', () => {
  const arts = parseRest(posts, '[]')
  assert.equal(arts.length, 10)
  assert.ok(arts.every((a) => a.image === null))
})

test('une réponse qui n’est pas une liste lève', () => {
  assert.throws(() => parseRest('{"code":"x"}', '[]'))
})

test('chaque étagère est repliée dans RUBRIC_MAP, la source est nommée', () => {
  for (const s of SECTIONS) assert.ok(RUBRIC_MAP.soyarmenio[s], `étagère ${s} absente`)
  assert.equal(SOURCE_NAMES.soyarmenio, 'Soy Armenio')
})
