import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateArticle, chosenImage, factsChecked } from '../scripts/lib/culture-validate.mjs'
import { serializeFrontMatter, bodyHash } from '../scripts/lib/culture-markdown.mjs'
import { meta, texts, candidate } from './helpers/culture-fixture.mjs'

const ok = (over = {}) => ({ slug: 'komitas', meta: meta('komitas'), texts: texts(), images: { webp: true, jpg: true }, ...over })

test('article complet : aucune erreur, quatre langues', () => {
  const r = validateArticle(ok())
  assert.deepEqual(r.errors, [])
  assert.deepEqual(Object.keys(r.langs), ['fr', 'en', 'hy', 'ru'])
  assert.equal(r.langs.fr.date, '2026-10-19')
})

test('traduction absente : erreur, les autres langues restent', () => {
  const r = validateArticle(ok({ texts: { ...texts(), hy: null } }))
  assert.match(r.errors.join('\n'), /hy\.md absent/)
  assert.deepEqual(Object.keys(r.langs), ['fr', 'en', 'ru'])
})

test('traduction périmée : le français a changé après la traduction', () => {
  const t = texts()
  t.fr = serializeFrontMatter({ title: 'Komitas', description: 'd', date: '2026-10-19' }, 'Texte corrigé.')
  const r = validateArticle(ok({ texts: t }))
  assert.equal(r.errors.filter((e) => /périmée/.test(e)).length, 3)
  assert.deepEqual(Object.keys(r.langs), ['fr'])
})

test('fr cassé à la main : bloquant, message lisible', () => {
  const r = validateArticle(ok({ texts: { ...texts(), fr: 'title: x\ncorps' } }))
  assert.match(r.errors[0], /^fr\.md : front-matter absent/)
  assert.deepEqual(r.langs, {})
})

test('front-matter incomplet ou description trop longue', () => {
  const long = serializeFrontMatter({ title: 'T', description: 'x'.repeat(161), date: '2026-10-19' }, 'b')
  assert.match(validateArticle(ok({ texts: { ...texts(), fr: long } })).errors[0], /161 caractères/)
  const nodate = serializeFrontMatter({ title: 'T', description: 'd', date: '19/10/2026' }, 'b')
  assert.match(validateArticle(ok({ texts: { ...texts(), fr: nodate } })).errors[0], /AAAA-MM-JJ/)
})

test('licence refusée et sources absentes : bloquant', () => {
  const nc = meta('komitas', { image: { ...candidate(0, { license: 'CC BY-NC 4.0' }) }, candidates: [candidate(0, { license: 'CC BY-NC 4.0' })] })
  const r = validateArticle(ok({ meta: nc }))
  assert.match(r.errors.join('\n'), /licence d'image refusée/)
  assert.deepEqual(r.langs, {})
  assert.deepEqual(validateArticle(ok({ meta: meta('komitas', { sources: [] }) })).langs, {})
})

test('fichiers image absents alors que l’image est déclarée : bloquant', () => {
  const r = validateArticle(ok({ images: { webp: false, jpg: true } }))
  assert.match(r.errors.join('\n'), /image\.webp/)
  assert.deepEqual(r.langs, {})
})

test('imageChoice changé après la traduction : signalé, non bloquant', () => {
  const r = validateArticle(ok({ meta: meta('komitas', { imageChoice: 1 }) }))
  assert.match(r.errors.join('\n'), /reposez l'étiquette/)
  assert.equal(Object.keys(r.langs).length, 4)
})

test('article sans image : valide', () => {
  const r = validateArticle(ok({ meta: meta('komitas', { candidates: [], imageChoice: null, image: null }), images: { webp: false, jpg: false } }))
  assert.deepEqual(r.errors, [])
})

test('slug de meta incohérent ou slug invalide', () => {
  assert.deepEqual(validateArticle(ok({ meta: meta('autre') })).langs, {})
  assert.match(validateArticle(ok({ slug: '../x' })).errors[0], /slug invalide/)
})

test('chosenImage et factsChecked', () => {
  assert.equal(chosenImage(meta('k', { imageChoice: 1 })).file, 'File:K1.jpg')
  assert.equal(chosenImage(meta('k', { imageChoice: null })), null)
  assert.equal(chosenImage(meta('k', { imageChoice: 9 })), null)
  assert.equal(factsChecked('blabla\n- [x] Faits vérifiés\n'), true)
  assert.equal(factsChecked('- [X] Faits vérifiés'), true)
  assert.equal(factsChecked('- [ ] Faits vérifiés'), false)
  assert.equal(factsChecked(null), false)
})

test('agendaEvent présent mais invalide : signalé, non bloquant ; absent : silencieux', () => {
  const r = validateArticle(ok({ meta: meta('komitas', { agendaEvent: { title: 'C', url: 'javascript:x', date: '2026-10-25' } }) }))
  assert.ok(r.errors.includes('meta.json : agendaEvent invalide (ignoré)'))
  assert.equal(Object.keys(r.langs).length, 4)
  const n = validateArticle(ok({ meta: meta('komitas', { agendaEvent: { title: 'C', url: 'https://e/1', date: 5 } }) }))
  assert.match(n.errors.join('\n'), /agendaEvent invalide/)
  assert.deepEqual(validateArticle(ok()).errors, [])
  const good = { title: 'C', url: 'https://e/1', date: '2026-10-25T20:00' }
  assert.deepEqual(validateArticle(ok({ meta: meta('komitas', { agendaEvent: good }) })).errors, [])
})

test('traduction : un lien absent du français relu retire la langue', () => {
  const frBody = 'Voir [Komitas](https://fr.wikipedia.org/wiki/Komitas).'
  const t = texts({ frBody })
  const tr = (body) =>
    serializeFrontMatter({ title: 'T', description: 'D', date: '2026-10-19', sourceHash: bodyHash(frBody), model: 'm' }, body)
  t.en = tr('See [Komitas](https://fr.wikipedia.org/wiki/Komitas).')
  t.hy = tr('Տես [Կոմիտաս](https://evil.example/x).')
  t.ru = tr('См. [Комитас](https://fr.wikipedia.org/wiki/Komitas) и [ещё](https://ru.example/y "t").')
  const r = validateArticle(ok({ texts: t }))
  assert.deepEqual(Object.keys(r.langs), ['fr', 'en'])
  assert.ok(r.errors.includes('hy.md : liens absents du français relu'))
  assert.ok(r.errors.includes('ru.md : liens absents du français relu'))
})
