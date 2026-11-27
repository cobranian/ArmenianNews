// Les images d'un Short Culture : une par fait. Image 1 = la photo de
// l'article ; les 6 autres viennent des articles Wikipédia du sujet (et des
// candidates du brouillon), jamais de la recherche Commons plein texte, qui
// ramène des homonymes. Ce fichier garde le tri (licence, format, doublons)
// et l'ordre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SHORT_EXTRA, wikiImageTitles, fetchPageImageFiles, pickShortImages, isStale, shortImageFile,
} from '../scripts/lib/culture-short-images.mjs'

const info = (file, extra = {}) => ({
  file,
  thumbUrl: `https://upload.wikimedia.org/${encodeURIComponent(file)}`,
  width: 1600,
  height: 1200,
  mime: 'image/jpeg',
  author: 'A',
  license: 'CC BY-SA 4.0',
  licenseUrl: null,
  commonsUrl: `https://commons.wikimedia.org/wiki/${file.replace(/ /g, '_')}`,
  ...extra,
})

test('pickShortImages : 6 au plus, sans la photo de l’article', () => {
  const infos = Array.from({ length: 10 }, (_, i) => info(`File:P${i}.jpg`))
  const got = pickShortImages({ articleImage: info('File:P0.jpg'), candidates: [], infos })
  assert.equal(SHORT_EXTRA, 6)
  assert.deepEqual(got.map((c) => c.file), ['File:P1.jpg', 'File:P2.jpg', 'File:P3.jpg', 'File:P4.jpg', 'File:P5.jpg', 'File:P6.jpg'])
})

test('pickShortImages : un fichier référencé deux fois ne sort qu’une fois', () => {
  const got = pickShortImages({ articleImage: null, candidates: [], infos: [info('File:Duduk.jpg'), info('File:Duduk.jpg'), info('File:B.jpg')] })
  assert.deepEqual(got.map((c) => c.file), ['File:Duduk.jpg', 'File:B.jpg'])
})

test('pickShortImages : drapeaux, bandeaux et portraits trop étroits écartés', () => {
  const infos = [
    info('File:Flag of Armenia.png'),
    info('File:Coat of arms of Van.jpg'),
    info('File:Bandeau.jpg', { width: 3000, height: 400 }),
    info('File:Etroit.jpg', { width: 800, height: 1700 }),
    info('File:Garden in Sochi3.jpg', { width: 1280, height: 904 }),
  ]
  const got = pickShortImages({ articleImage: null, candidates: [], infos })
  assert.deepEqual(got.map((c) => c.file), ['File:Garden in Sochi3.jpg'])
})

test('pickShortImages : les candidates d’abord, puis Wikipédia dans l’ordre reçu', () => {
  const infos = [info('File:W1.jpg'), info('File:C2.jpg'), info('File:W2.jpg'), info('File:C1.jpg')]
  const got = pickShortImages({ articleImage: info('File:C0.jpg'), candidates: [info('File:C0.jpg'), info('File:C1.jpg'), info('File:C2.jpg')], infos })
  assert.deepEqual(got.map((c) => c.file), ['File:C1.jpg', 'File:C2.jpg', 'File:W1.jpg', 'File:W2.jpg'])
})

test('wikiImageTitles : pages Wikipédia fr/en/hy/ru de meta.sources seulement', () => {
  const sources = [
    { kind: 'wikipedia', lang: 'fr', title: 'Duduk' },
    { kind: 'wikipedia', lang: 'de', title: 'Duduk' },
    { kind: 'unesco', lang: 'en', title: 'Duduk and its music' },
    { kind: 'wikipedia', lang: 'hy', title: 'Դուդուկ' },
  ]
  assert.deepEqual(wikiImageTitles(sources), [{ lang: 'fr', title: 'Duduk' }, { lang: 'hy', title: 'Դուդուկ' }])
})

test('fetchPageImageFiles : SVG écartés, préfixe local ramené à File:', async () => {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url: new URL(url), init })
    return { ok: true, status: 200, json: async () => ({ query: { pages: [{ images: [{ title: 'Fichier:Duduk.jpg' }, { title: 'Fichier:Carte.svg' }, { title: 'Fichier:Anche.PNG' }] }] } }) }
  }
  assert.deepEqual(await fetchPageImageFiles({ lang: 'fr', title: 'Duduk' }, impl), ['File:Duduk.jpg', 'File:Anche.PNG'])
  assert.equal(calls[0].url.host, 'fr.wikipedia.org')
  assert.equal(calls[0].url.searchParams.get('prop'), 'images')
  assert.ok(!/Chrome/.test(calls[0].init.headers['User-Agent']))
})

test('isStale : entrée intacte, fichier changé à la main, espaces ↔ _', () => {
  assert.equal(isStale(info('File:A b.jpg')), false)
  assert.equal(isStale({ ...info('File:A b.jpg'), file: 'File:Autre.jpg' }), true)
  assert.equal(isStale({ file: 'File:Seul.jpg' }), true)
  assert.equal(isStale({ file: 'File:Garden in Sochi3.jpg', commonsUrl: 'https://commons.wikimedia.org/wiki/File:Garden_in_Sochi3.jpg' }), false)
  assert.equal(isStale({ file: 'File:Été.jpg', commonsUrl: 'https://commons.wikimedia.org/wiki/File:%C3%89t%C3%A9.jpg' }), false)
  assert.equal(shortImageFile(3), 'short-3.jpg')
})
