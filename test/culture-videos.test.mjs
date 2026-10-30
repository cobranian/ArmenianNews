// test/culture-videos.test.mjs
//
// Les Shorts YouTube des articles Culture (scripts/lib/culture-videos.mjs).
// Ce qui est gardé :
//   - une vidéo ne s'affiche QUE sur la page de sa langue, avec son VideoObject ;
//   - une entrée mal formée est écartée, sans casser le build ;
//   - chaque entrée du fichier de données vise un article qui existe ;
//   - la CSP des DEUX vitrines ouvre le lecteur youtube-nocookie, et lui seul.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { cleanVideo, loadCultureVideos, videoLd } from '../scripts/lib/culture-videos.mjs'
import { cultureArticleHtml } from '../scripts/lib/culture-pages.mjs'
import { loadCulture } from '../scripts/lib/culture-load.mjs'
import { cultureLangsBySlug } from '../scripts/lib/culture-links.mjs'
import { SITES } from '../sites.config.js'
import { writeArticle, texts, meta } from './helpers/culture-fixture.mjs'

const V = { youtube: 'dvMyEVpzB4Y', title: 'Titre', description: 'Desc', uploadDate: '2026-10-29', duration: 'PT44S' }
const silent = { warn: () => {} }

test('cleanVideo : écarte un identifiant, une date ou une durée mal formés', () => {
  assert.ok(cleanVideo(V))
  assert.equal(cleanVideo({ ...V, youtube: 'https://youtu.be/x' }), null)
  assert.equal(cleanVideo({ ...V, uploadDate: '29/10/2026' }), null)
  assert.equal(cleanVideo({ ...V, duration: '44s' }), null)
  assert.equal(cleanVideo({ ...V, title: '' }), null)
  assert.equal(cleanVideo({ ...V, description: undefined }).description, 'Titre')
})

test('loadCultureVideos : une entrée invalide est ignorée, le reste chargé', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'videos-'))
  const file = path.join(dir, 'v.json')
  await writeFile(file, JSON.stringify({ a: { fr: V, en: { ...V, youtube: 'x' } } }))
  const got = await loadCultureVideos(file, silent)
  assert.deepEqual(Object.keys(got.a), ['fr'])
  assert.deepEqual(await loadCultureVideos(path.join(dir, 'absent.json'), silent), {})
})

test('la vidéo ne paraît que sur la page de sa langue, avec son VideoObject', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'culture-'))
  await writeArticle(dir, 'komitas', { m: meta('komitas'), t: texts({ date: '2026-10-19', title: 'Komitas' }) })
  const list = await loadCulture(dir, silent)
  const article = list[0]
  const bySlug = cultureLangsBySlug(list)
  const videos = { komitas: { fr: V } }
  const page = (siteId, lang) =>
    cultureArticleHtml({ siteId, lang, article, list, bySlug, cssHref: '/a.css', videos })

  const fr = page('ch', 'fr')
  assert.ok(fr.includes('src="https://www.youtube-nocookie.com/embed/dvMyEVpzB4Y"'))
  assert.ok(fr.includes('loading="lazy"'))
  assert.ok(fr.includes('"@type":"VideoObject"'))
  assert.ok(fr.includes('"embedUrl":"https://www.youtube-nocookie.com/embed/dvMyEVpzB4Y"'))
  assert.ok(fr.includes('"video":{"@id":"https://armenieinfo.ch/culture/komitas/#video"}'))

  const en = page('org', 'en')
  // Le lecteur, pas « youtube » : le pied de page du .org cite sa chaîne.
  assert.ok(!en.includes('youtube-nocookie'), 'une vidéo française sur la page anglaise')
  assert.ok(!en.includes('VideoObject'))
})

test('videoLd : nœud complet, rattaché à la page et à l’éditeur', () => {
  const n = videoLd(V, 'fr', 'https://armenieinfo.ch/culture/x/', SITES.ch)
  assert.equal(n['@id'], 'https://armenieinfo.ch/culture/x/#video')
  assert.deepEqual(n.thumbnailUrl, ['https://i.ytimg.com/vi/dvMyEVpzB4Y/hqdefault.jpg'])
  assert.equal(n.uploadDate, '2026-10-29')
  assert.equal(n.inLanguage, 'fr')
  assert.deepEqual(n.publisher, { '@id': 'https://armenieinfo.ch/#organization' })
})

test('le fichier de données : entrées valides, articles et langues existants', async () => {
  const file = new URL('../src/data/culture-videos.json', import.meta.url)
  const raw = JSON.parse(await readFile(file, 'utf-8'))
  const slugs = await readdir(new URL('../src/data/culture/', import.meta.url))
  for (const [slug, langs] of Object.entries(raw)) {
    assert.ok(slugs.includes(slug), `article inconnu : ${slug}`)
    for (const [lang, v] of Object.entries(langs)) {
      assert.ok(cleanVideo(v), `${slug}/${lang} invalide`)
      const md = await readFile(new URL(`../src/data/culture/${slug}/${lang}.md`, import.meta.url), 'utf-8').catch(() => null)
      assert.ok(md, `${slug} n'existe pas en ${lang}`)
    }
  }
})

test('CSP : les deux vitrines ouvrent youtube-nocookie en frame-src, et rien d’autre', async () => {
  const fb = await readFile(new URL('../firebase.json', import.meta.url), 'utf-8')
  const csps = [...fb.matchAll(/"value":\s*"(default-src[^"]*)"/g)].map((m) => m[1])
  assert.equal(csps.length, 2)
  for (const csp of csps) {
    const frame = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('frame-src'))
    assert.equal(frame, 'frame-src https://www.youtube-nocookie.com')
    assert.ok(csp.includes("frame-ancestors 'none'"), 'frame-ancestors doit rester fermé')
  }
})
