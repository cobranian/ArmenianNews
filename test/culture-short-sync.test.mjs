// La synchronisation des images d'un Short : meta.shortImages ⇔
// short-<empreinte>.jpg, sur un vrai dossier. Revue du 27 nov. 2026 : avec
// des fichiers numérotés par place, retirer, échanger ou renouveler une entrée
// laissait l'image d'une autre sous son crédit (CC BY / BY-SA mal attribuée,
// dans une vidéo qu'on ne corrige plus une fois publiée).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { syncShortImages, gatherShortImages } from '../scripts/lib/culture-short-images.mjs'
import { usableShortImages, creditedShortImages, shortImagesNeedSync, shortImageFile } from '../scripts/lib/culture-short-credits.mjs'

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

const fakes = (known) => {
  const downloads = []
  return {
    downloads,
    fetchCommonsCandidates: async ({ files }) => files.filter((f) => known.includes(f)).map((f) => info(f)),
    download: async (url) => (downloads.push(url), Buffer.from(url)),
    makeShortImage: async (b) => b,
    gather: async () => ['File:G1.jpg', 'File:G2.jpg'].map((f) => info(f)),
    wait: 0,
  }
}
const tmp = () => mkdtemp(path.join(os.tmpdir(), 'short-img-'))
const fileOf = (f) => shortImageFile(info(f))
// Le contenu d'un fichier de test = l'URL dont il vient : on peut vérifier
// quelle image est réellement sous quel crédit.
const put = (dir, f) => writeFile(path.join(dir, fileOf(f)), info(f).thumbUrl)
const sorted = (a) => [...a].sort()

test('sans liste, elle est rassemblée et chaque entrée téléchargée', async () => {
  const dir = await tmp()
  const meta = { image: info('File:A.jpg') }
  const r = await syncShortImages(dir, meta, fakes([]))
  assert.equal(r.failed, 0)
  assert.deepEqual(meta.shortImages.map((c) => c.file), ['File:G1.jpg', 'File:G2.jpg'])
  assert.deepEqual(sorted(await readdir(dir)), sorted([fileOf('File:G1.jpg'), fileOf('File:G2.jpg')]))
})

test('article publié (gatherIfMissing: false) : sans liste, rien n’est rassemblé', async () => {
  const dir = await tmp()
  const meta = { image: info('File:A.jpg') }
  const r = await syncShortImages(dir, meta, { ...fakes([]), gatherIfMissing: false })
  assert.equal(meta.shortImages, undefined)
  assert.deepEqual(r, { lines: [], failed: 0 })
  assert.deepEqual(await readdir(dir), [])
})

test('un fichier remplacé à la main est relu et téléchargé, les autres non', async () => {
  const dir = await tmp()
  await put(dir, 'File:G1.jpg')
  await put(dir, 'File:G2.jpg')
  const f = fakes(['File:Neuf.jpg'])
  const meta = { shortImages: [info('File:G1.jpg'), { ...info('File:G2.jpg'), file: 'File:Neuf.jpg' }] }
  const r = await syncShortImages(dir, meta, f)
  assert.equal(r.failed, 0)
  assert.equal(meta.shortImages[1].commonsUrl, 'https://commons.wikimedia.org/wiki/File:Neuf.jpg')
  assert.deepEqual(f.downloads, [info('File:Neuf.jpg').thumbUrl])
  assert.deepEqual(sorted(await readdir(dir)), sorted([fileOf('File:G1.jpg'), fileOf('File:Neuf.jpg')]))
})

test('retirer la première entrée ne laisse jamais son image sous un autre crédit', async () => {
  const dir = await tmp()
  for (const f of ['File:Mona.jpg', 'File:B.jpg', 'File:C.jpg']) await put(dir, f)
  const meta = { shortImages: [info('File:B.jpg'), info('File:C.jpg')] }
  await syncShortImages(dir, meta, fakes([]))
  const shown = usableShortImages(dir, meta)
  assert.deepEqual(shown.map((u) => u.entry.file), ['File:B.jpg', 'File:C.jpg'])
  for (const u of shown) assert.equal(await readFile(u.src, 'utf8'), u.entry.thumbUrl, u.entry.file)
  assert.ok(!(await readdir(dir)).includes(fileOf('File:Mona.jpg')))
})

test('refresh : une liste neuve, chaque image neuve téléchargée, l’ancienne retirée', async () => {
  const dir = await tmp()
  await put(dir, 'File:Old.jpg')
  const f = fakes([])
  const meta = { shortImages: [info('File:Old.jpg')] }
  await syncShortImages(dir, meta, { ...f, refresh: true })
  assert.equal(f.downloads.length, 2)
  assert.deepEqual(sorted(await readdir(dir)), sorted([fileOf('File:G1.jpg'), fileOf('File:G2.jpg')]))
})

test('fichier introuvable, trop petit ou non libre → échec en clair, rien de faux écrit', async () => {
  const dir = await tmp()
  const meta = { shortImages: [{ file: 'File:Refusé.jpg' }] }
  const r = await syncShortImages(dir, meta, fakes([]))
  assert.equal(r.failed, 1)
  assert.match(r.lines.join('\n'), /✗ .*File:Refusé\.jpg.*introuvable, trop petit ou licence non libre/)
  assert.equal(meta.shortImages[0].commonsUrl, undefined)
  assert.equal(shortImagesNeedSync(meta), true)
})

test('la liste raccourcit → les images en trop disparaissent, image.jpg reste', async () => {
  const dir = await tmp()
  for (const f of ['File:G1.jpg', 'File:G2.jpg', 'File:G3.jpg', 'File:G4.jpg']) await put(dir, f)
  await writeFile(path.join(dir, 'image.jpg'), 'x')
  const meta = { shortImages: [info('File:G1.jpg'), info('File:G2.jpg')] }
  await syncShortImages(dir, meta, fakes([]))
  assert.deepEqual(sorted(await readdir(dir)), sorted(['image.jpg', fileOf('File:G1.jpg'), fileOf('File:G2.jpg')]))
})

test('creditedShortImages : ni la photo de l’article (imageChoice changé), ni doublon, ni entrée périmée', () => {
  const meta = {
    image: info('File:C1.jpg'),
    shortImages: [info('File:C1.jpg'), info('File:B.jpg'), info('File:B.jpg'), { ...info('File:D.jpg'), file: 'File:X.jpg' }, info('File:E.jpg')],
  }
  assert.deepEqual(creditedShortImages(meta).map((e) => e.file), ['File:B.jpg', 'File:E.jpg'])
  assert.deepEqual(creditedShortImages({}), [])
  assert.equal(shortImagesNeedSync(meta), true)
  assert.equal(shortImagesNeedSync({ shortImages: [info('File:B.jpg')] }), false)
})

test('usableShortImages : crédit à jour ET fichier présent, sinon écartée', async () => {
  const dir = await tmp()
  await put(dir, 'File:A.jpg')
  const meta = { shortImages: [info('File:A.jpg'), { ...info('File:B.jpg'), file: 'File:Remplacée.jpg' }, info('File:C.jpg')] }
  assert.deepEqual(usableShortImages(dir, meta).map((u) => u.entry.file), ['File:A.jpg'])
  assert.deepEqual(usableShortImages(dir, {}), [])
})

test('gatherShortImages : une page Wikipédia en échec n’empêche pas les autres', async () => {
  const impl = async (url) => {
    if (new URL(url).host === 'fr.wikipedia.org') return { ok: false, status: 429, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({ query: { pages: [{ images: [{ title: 'File:En.jpg' }] }] } }) }
  }
  const meta = { sources: [{ kind: 'wikipedia', lang: 'fr', title: 'X' }, { kind: 'wikipedia', lang: 'en', title: 'X' }], candidates: [] }
  const got = await gatherShortImages(meta, { fetchImpl: impl, wait: 0, fetchCommonsCandidates: async ({ files }) => files.map((f) => info(f)) })
  assert.deepEqual(got.map((c) => c.file), ['File:En.jpg'])
})

test('gatherShortImages : chaque langue a sa part des 50 titres, le français ne prend pas tout', async () => {
  const impl = async (url) => {
    const lang = new URL(url).host.split('.')[0]
    const images = Array.from({ length: 80 }, (_, i) => ({ title: `File:${lang}${i}.jpg` }))
    return { ok: true, status: 200, json: async () => ({ query: { pages: [{ images }] } }) }
  }
  let asked = []
  const meta = { sources: ['fr', 'en'].map((lang) => ({ kind: 'wikipedia', lang, title: 'X' })), candidates: [] }
  await gatherShortImages(meta, { fetchImpl: impl, wait: 0, fetchCommonsCandidates: async ({ files }) => ((asked = files), []) })
  assert.ok(asked.some((f) => f.startsWith('File:en')), 'des fichiers de la page anglaise sont examinés')
  assert.ok(asked.length <= 50)
})
