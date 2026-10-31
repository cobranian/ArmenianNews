import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseRest, isLayoutCategory, SECTIONS, AGENDA_SLUG } from '../scripts/sources/diarioarmenia.mjs'
import { mirrorImages, pruneMirror } from '../scripts/lib/mirror-images.mjs'
import { RUBRIC_MAP } from '../src/rubrics.js'
import { SOURCE_NAMES } from '../src/newsLangs.js'

// Invariants : les réponses REST réelles de diarioarmenia.org.ar (31 octobre
// 2026) donnent des articles complets ; un post de la catégorie Agenda (id 233)
// n'entre JAMAIS dans une étagère, même s'il porte aussi Slider/Destacado ;
// les images, une fois recopiées, pointent sur /da/ (le site sert une vignette
// 200×200 muette à tout Referer étranger).
const posts = readFileSync(new URL('./fixtures/diarioarmenia-posts.json', import.meta.url), 'utf-8')
const media = readFileSync(new URL('./fixtures/diarioarmenia-media.json', import.meta.url), 'utf-8')
const AGENDA_ID = 233

test('parseRest rend des articles complets', () => {
  const arts = parseRest(posts, media, { agendaId: AGENDA_ID })
  assert.equal(arts.length, 8)
  for (const a of arts) {
    assert.ok(a.title && !/&#?\w+;/.test(a.title))
    assert.match(a.url, /^https:\/\/www\.diarioarmenia\.org\.ar\//)
    assert.match(a.date, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
    assert.match(a.image, /^https:\/\//)
  }
})

test('un post Agenda n’apparaît dans aucune étagère, même étiqueté Slider', () => {
  const list = JSON.parse(posts)
  const agendaAndSlider = { ...list[0], link: 'https://www.diarioarmenia.org.ar/agenda-slider/', categories: [131, AGENDA_ID] }
  const arts = parseRest(JSON.stringify([agendaAndSlider, ...list]), media, { agendaId: AGENDA_ID })
  assert.equal(arts.length, list.length)
  assert.ok(!arts.some((a) => a.url.includes('agenda-slider')))
})

test('isLayoutCategory reconnaît les étiquettes de mise en page', () => {
  for (const s of ['slider', 'destacado1', 'destacado-2']) assert.equal(isLayoutCategory(s), true, s)
  for (const s of ['armenia', 'cultura', 'agenda']) assert.equal(isLayoutCategory(s), false, s)
})

test('aucune étagère n’est Agenda ni une étiquette de mise en page', () => {
  for (const s of SECTIONS) {
    assert.notEqual(s, AGENDA_SLUG)
    assert.equal(isLayoutCategory(s), false, s)
  }
})

test('chaque étagère est repliée dans RUBRIC_MAP, la source est nommée', () => {
  for (const s of SECTIONS) assert.ok(RUBRIC_MAP.diarioarmenia[s], `étagère ${s} absente`)
  assert.equal(SOURCE_NAMES.diarioarmenia, 'Diario Armenia')
})

test('après mirrorImages, chaque image d’article commence par /da/', async () => {
  const arts = parseRest(posts, media, { agendaId: AGENDA_ID })
  const dir = mkdtempSync(join(tmpdir(), 'da-'))
  const seen = []
  const fetchImg = async (url) => {
    seen.push(url)
    return Buffer.from('x')
  }
  const encode = async (buf) => buf
  const log = { warn() {} }
  await mirrorImages(arts, { dir, prefix: '/da/', encode, fetchImg, log })
  assert.ok(seen.length > 0)
  for (const a of arts) assert.match(a.image, /^\/da\/[0-9a-f]{16}\.webp$/)
  assert.equal(pruneMirror(arts, { dir, prefix: '/da/' }), 0)
  assert.ok(existsSync(join(dir, arts[0].image.slice(4))))
})
