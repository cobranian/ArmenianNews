import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateArticle, chosenImage, factsChecked, OPTIONAL, TRANSLATED, REQUIRED, pageSources, draftSources } from '../scripts/lib/culture-validate.mjs'
import { serializeFrontMatter, bodyHash } from '../scripts/lib/culture-markdown.mjs'
import { shortHash, SPOKEN_SINCE } from '../scripts/lib/culture-short.mjs'
import { meta, texts, candidate, FR_BODY } from './helpers/culture-fixture.mjs'

const ok = (over = {}) => ({ slug: 'komitas', meta: meta('komitas'), texts: texts(), images: { webp: true, jpg: true }, ...over })

test('article complet : aucune erreur, quatre langues', () => {
  const r = validateArticle(ok())
  assert.deepEqual(r.errors, [])
  assert.deepEqual(Object.keys(r.langs), ['fr', 'en', 'hy', 'ru'])
  assert.equal(r.langs.fr.date, '2026-10-19')
})

// de/it sont facultatives : un article sans de.md ni it.md passe culture-check
// (aucune erreur) — deux NOTES, non bloquantes — et ne paraît simplement pas
// dans ces langues.
test('de, it et es facultatives : leur absence est une note, pas une erreur', () => {
  assert.deepEqual(OPTIONAL, ['de', 'it', 'es'])
  assert.deepEqual(TRANSLATED, ['de', 'it', 'en', 'es', 'hy', 'ru'])
  assert.deepEqual(REQUIRED, ['en', 'hy', 'ru'])
  const r = validateArticle(ok())
  assert.deepEqual(r.errors, [])
  assert.equal(r.notes.filter((n) => !n.startsWith('short.')).length, 3)
  assert.deepEqual(Object.keys(r.langs), ['fr', 'en', 'hy', 'ru'])
})

const trDe = (frBody, hash = bodyHash(frBody)) =>
  serializeFrontMatter({ title: 'Komitas', description: 'Der Vater', date: '2026-10-19', sourceHash: hash, model: 'm' }, 'Text de.')

test('de valide : publiée ; de périmée ou cassée : note, jamais erreur', () => {
  const t = texts()
  const frBody = FR_BODY
  const good = validateArticle(ok({ texts: { ...t, de: trDe(frBody) } }))
  assert.deepEqual(good.errors, [])
  assert.deepEqual(Object.keys(good.langs), ['fr', 'de', 'en', 'hy', 'ru'])
  assert.equal(good.notes.filter((n) => !n.startsWith('short.')).length, 2) // it et es absentes
  const stale = validateArticle(ok({ texts: { ...t, de: trDe(frBody, 'deadbeef'), it: 'cassé' } }))
  assert.deepEqual(stale.errors, [])
  const notes = stale.notes.join(' | ')
  assert.match(notes, /de\.md : traduction périmée/)
  assert.match(notes, /it\.md : front-matter absent/)
  assert.ok(!('de' in stale.langs) && !('it' in stale.langs))
})

test('sources Wikipédia de/it : citées sur leur page seulement, jamais au brouillon', () => {
  const src = [
    { lang: 'fr', title: 'Komitas', url: 'https://fr.wikipedia.org/wiki/Komitas' },
    { kind: 'wikipedia', lang: 'de', title: 'Komitas Vardapet', url: 'https://de.wikipedia.org/wiki/Komitas_Vardapet' },
    { kind: 'wikipedia', lang: 'it', title: 'Komitas', url: 'https://it.wikipedia.org/wiki/Komitas' },
    { kind: 'unesco', lang: 'en', title: 'U', url: 'https://ich.unesco.org/x' },
  ]
  assert.deepEqual(pageSources(src, 'fr').map((s) => s.lang), ['fr', 'en'])
  assert.deepEqual(pageSources(src, 'de').map((s) => s.lang), ['fr', 'de', 'en'])
  assert.deepEqual(draftSources(src).map((s) => s.lang), ['fr', 'en'])
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

// --- Shorts (short.<lang>.json) ---
const shortFr = () => ({
  facts: Array.from({ length: 7 }, (_, i) => ({ eyebrow: 'Titre', title: 'Fait', text: 'Un fait.', big: i === 0 })),
  outroTitle: 'Fin', ytTitle: 'Komitas', ytLead: 'Le père.', music: 'mazia',
})
const shortTr = (fr, over = {}) => ({ ...fr, music: undefined, sourceHash: shortHash(fr), ...over })
const js = (o) => JSON.stringify(o)
const withShorts = (shorts, over = {}) => ok({ shorts, ...over })

test('short.fr.json absent : note, aucune erreur, aucun short', () => {
  const r = validateArticle(withShorts({}))
  assert.deepEqual(r.errors, [])
  assert.ok(r.notes.includes('short.fr.json absent : pas de vidéo'))
  assert.ok(r.notes.includes('short.hy.json absent : pas de vidéo hy'))
  assert.deepEqual(r.shorts, {})
})

test('short.fr.json invalide : erreur bloquante', () => {
  const bad = { ...shortFr(), music: 'inconnue' }
  const r = validateArticle(withShorts({ fr: js(bad) }))
  assert.ok(r.errors.some((e) => e.startsWith('short.fr.json : music')))
  assert.deepEqual(r.shorts, {})
  assert.ok(validateArticle(withShorts({ fr: '{pas du json' })).errors.some((e) => /^short\.fr\.json : JSON illisible/.test(e)))
})

test('shorts conformes : fr et traductions publiables', () => {
  const fr = shortFr()
  const r = validateArticle(withShorts({ fr: js(fr), en: js(shortTr(fr)), de: js(shortTr(fr)) }))
  assert.deepEqual(r.errors, [])
  // de n'a pas de de.md publiable : pas de short de.
  assert.deepEqual(Object.keys(r.shorts), ['fr', 'en'])
})

test('traduction de short périmée : erreur en/hy/ru, note de/it/es', () => {
  const fr = shortFr()
  const r = validateArticle(withShorts({ fr: js(fr), hy: js(shortTr(fr, { sourceHash: 'vieux' })), de: js(shortTr(fr, { sourceHash: 'vieux' })) }))
  assert.ok(r.errors.includes('short.hy.json : traduction périmée'))
  assert.ok(r.notes.includes('short.de.json : traduction périmée'))
  assert.ok(!r.errors.some((e) => e.startsWith('short.de')))
  assert.deepEqual(Object.keys(r.shorts), ['fr'])
})

test('article hy.md refusé : pas de short hy même conforme', () => {
  const fr = shortFr()
  const r = validateArticle(withShorts({ fr: js(fr), hy: js(shortTr(fr)) }, { texts: { ...texts(), hy: null } }))
  assert.equal(r.shorts.hy, undefined)
  assert.ok(r.shorts.fr)
})

// Revue du 20 nov. 2026. Le front-matter d'une traduction porte sourceHash
// (64 hex), date et model : lus comme « l'article », leurs chiffres
// blanchissaient un nombre inventé. Le Short se lit contre titre, description
// et corps.
test('short traduit : un nombre présent dans le seul front-matter (sourceHash, date) est refusé', () => {
  const fr = shortFr()
  const t = texts()
  // Le 19 (date 2026-10-19) n'est écrit que dans le front-matter de en.md.
  const en = shortTr(fr, { ytLead: 'Mort un 19, en 2026.' })
  const r = validateArticle(withShorts({ fr: js(fr), en: js(en) }, { texts: t }))
  assert.ok(r.errors.some((e) => /^short\.en\.json : nombres absents de l’article : 19, 2026/.test(e)), r.errors.join(' / '))
  assert.equal(r.shorts.en, undefined)
})

test('vidéo française déjà en ligne, short fr en note : les autres langues restent publiables', () => {
  const fr = { ...shortFr(), ytLead: 'Né en 1234.' } // nombre absent de fr.md : une note, la vidéo est en ligne
  const r = validateArticle(withShorts({ fr: js(fr), en: js(shortTr(fr, { ytLead: 'Born.' })) }, { videos: { komitas: { fr: { youtube: 'x' } } } }))
  assert.deepEqual(r.errors, [])
  assert.ok(r.notes.some((n) => n.startsWith('short.fr.json : nombres absents')))
  assert.deepEqual(Object.keys(r.shorts), ['en'])
  assert.deepEqual(r.frShort, fr, 'la référence (et sa piste) reste exposée')
})

test('vidéo déjà publiée : l’erreur du short devient une note, short non retenu', () => {
  const bad = { ...shortFr(), music: 'inconnue' }
  const r = validateArticle(withShorts({ fr: js(bad) }, { videos: { komitas: { fr: { youtube: 'x' } } } }))
  assert.deepEqual(r.errors, [])
  assert.ok(r.notes.some((n) => n.startsWith('short.fr.json : music')))
  assert.deepEqual(r.shorts, {})
})

// spoken : exigé seulement pour un article daté de SPOKEN_SINCE ou après.
test('short.fr.json sans spoken : erreur dès SPOKEN_SINCE, aucune avant', () => {
  const fr = js(shortFr())
  const recent = validateArticle(withShorts({ fr }, { texts: texts({ date: SPOKEN_SINCE }) }))
  assert.ok(recent.errors.includes('short.fr.json : fait 1 : spoken manquant'), recent.errors.join(' | '))
  const old = validateArticle(withShorts({ fr }, { texts: texts({ date: '2026-10-17' }) }))
  assert.ok(!old.errors.some((e) => /spoken/.test(e)), old.errors.join(' | '))
})
