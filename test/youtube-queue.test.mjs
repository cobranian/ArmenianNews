// La file des Shorts à mettre en ligne sur YouTube (src/data/youtube-queue.json)
// et le titre/la description de chaque envoi. Deux pièges muets gardés ici :
// un slug×lang mis deux fois en file partirait deux fois sur la chaîne (YouTube
// ne dédoublonne pas), et une description qui s'écarte de celle déjà publiée
// ferait diverger les Shorts automatiques des 160 envoyés à la main.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { enqueue, EMPTY_QUEUE } from '../scripts/lib/youtube-queue.mjs'
import { youtubeMeta, musicLine } from '../scripts/lib/youtube-meta.mjs'
import { videoLangs, shortsToTranslate } from '../scripts/lib/culture-video-plan.mjs'

const NOW = new Date('2026-11-16T12:00:00Z')
const item = (slug, lang) => ({ slug, lang, asset: `${lang}-${slug}.mp4`, title: `T ${lang}`, description: `D ${lang}` })

test('enqueue : ajoute dans l’ordre d’arrivée, horodaté, sans muter l’entrée', () => {
  const q0 = structuredClone(EMPTY_QUEUE)
  const q = enqueue(q0, [item('duduk', 'fr'), item('duduk', 'en')], NOW)
  assert.deepEqual(q0, EMPTY_QUEUE)
  assert.equal(q.version, 1)
  assert.deepEqual(q.items.map((i) => `${i.slug}/${i.lang}`), ['duduk/fr', 'duduk/en'])
  assert.equal(q.items[0].addedAt, '2026-11-16T12:00:00.000Z')
  assert.equal(q.items[0].asset, 'fr-duduk.mp4')
})

test('enqueue : un slug×lang déjà en file est ignoré (même à l’intérieur d’un lot)', () => {
  const q1 = enqueue(EMPTY_QUEUE, [item('duduk', 'fr')], NOW)
  const q2 = enqueue(q1, [{ ...item('duduk', 'fr'), title: 'autre' }, item('ani', 'fr'), item('ani', 'fr')], new Date('2026-11-17T00:00:00Z'))
  assert.deepEqual(q2.items.map((i) => `${i.slug}/${i.lang}`), ['duduk/fr', 'ani/fr'])
  assert.equal(q2.items[0].title, 'T fr', 'l’entrée déjà en file garde son texte')
  assert.equal(q2.items[0].addedAt, '2026-11-16T12:00:00.000Z')
})

test('enqueue : un slug×lang déjà dans culture-videos.json (déjà sur YouTube) est ignoré', () => {
  const videos = { duduk: { fr: { youtube: 'abc' } } }
  const q = enqueue(EMPTY_QUEUE, [item('duduk', 'fr'), item('duduk', 'hy')], NOW, { videos })
  assert.deepEqual(q.items.map((i) => `${i.slug}/${i.lang}`), ['duduk/hy'])
})

test('enqueue : une file absente ou d’une autre version est refusée plutôt qu’écrasée', () => {
  assert.throws(() => enqueue({ version: 2, items: [] }, [], NOW), /version/)
})

test('youtubeMeta : Khor Virap fr rend EXACTEMENT les métadonnées déjà publiées', async () => {
  const slug = 'monastere-de-khor-virap-au-pied-du-mont-ararat'
  const base = new URL(`../src/data/culture/${slug}/`, import.meta.url)
  const short = JSON.parse(await readFile(new URL('short.fr.json', base), 'utf8'))
  const meta = JSON.parse(await readFile(new URL('meta.json', base), 'utf8'))
  const want = JSON.parse(
    await readFile(new URL(`../video/youtube-meta/${slug}-fr.json`, import.meta.url), 'utf8'),
  )
  const { author, license, commonsUrl } = meta.image
  const got = youtubeMeta({ slug, lang: 'fr', short, credit: { author, license, commonsUrl }, music: short.music })
  assert.equal(got.title, want.title)
  assert.equal(got.description, want.description)
})

test('youtubeMeta : domaine public traduit, pas de ligne de même licence hors BY-SA', () => {
  const short = { ytTitle: 'Titre', ytLead: 'Chapeau.' }
  const credit = { author: 'Anonyme', license: 'Public domain', commonsUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg' }
  const { title, description } = youtubeMeta({ slug: 'duduk', lang: 'de', short, credit, music: 'sergo' })
  assert.equal(title, 'Titre #Armenien')
  assert.match(description, /Foto: Anonyme, gemeinfrei, via Wikimedia Commons:/)
  assert.match(description, /https:\/\/armenieinfo\.ch\/de\/kultur\/duduk\/\?utm_source=youtube&utm_medium=video/)
  assert.doesNotMatch(description, /Lizenz/)
  assert.ok(description.endsWith(`\n\n${musicLine('sergo')}`))
})

test('youtubeMeta : titre de plus de 100 caractères refusé, piste inconnue refusée', () => {
  const credit = { author: 'A', license: 'CC0', commonsUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg' }
  assert.throws(() => youtubeMeta({ slug: 'duduk', lang: 'fr', short: { ytTitle: 'x'.repeat(95), ytLead: 'y' }, credit, music: 'mazia' }), /100/)
  assert.throws(() => youtubeMeta({ slug: 'duduk', lang: 'fr', short: { ytTitle: 'x', ytLead: 'y' }, credit, music: 'inconnue' }), /inconnue/)
})

// Un résultat de validateArticle réduit à ce que lisent les deux fonctions.
const result = (langs, shorts) => ({
  langs: Object.fromEntries(langs.map((l) => [l, {}])),
  shorts: Object.fromEntries(shorts.map((l) => [l, {}])),
})

test('videoLangs : les Shorts publiables, moins ceux déjà sur YouTube, dans l’ordre d’ALL_LANGS', () => {
  const r = result(['fr', 'en', 'hy', 'ru'], ['ru', 'fr', 'hy', 'en'])
  assert.deepEqual(videoLangs(r, { slug: 'duduk', videos: { duduk: { en: { youtube: 'x' } } } }), ['fr', 'hy', 'ru'])
  assert.deepEqual(videoLangs(result(['fr'], []), { slug: 'duduk', videos: {} }), [])
  const queue = { version: 1, items: [item('duduk', 'hy'), item('ani', 'fr')] }
  assert.deepEqual(videoLangs(r, { slug: 'duduk', videos: {}, queue }), ['fr', 'en', 'ru'], 'déjà en file : pas rendu deux fois')
})

test('shortsToTranslate : article à jour sans Short valide, hors vidéos publiées ; sans Short français, toutes (il sera rédigé)', () => {
  const r = result(['fr', 'en', 'hy', 'ru', 'de'], ['fr', 'en'])
  assert.deepEqual(shortsToTranslate(r, { slug: 'duduk', videos: { duduk: { ru: { youtube: 'x' } } } }), ['de', 'hy'])
  assert.deepEqual(shortsToTranslate(result(['fr', 'en'], []), { slug: 'duduk', videos: {} }), ['en'])
  assert.deepEqual(shortsToTranslate(result(['fr', 'en'], []), { slug: 'duduk', videos: { duduk: { en: { youtube: 'x' } } } }), [])
})
