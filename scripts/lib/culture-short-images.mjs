// scripts/lib/culture-short-images.mjs
//
// Les images d'un Short Culture : une par fait, pour le rythme (une seule
// photo pendant ~50 s rendait la vidéo monotone). Image 1 = la photo de
// l'article (meta.image, image.jpg) ; les SHORT_EXTRA suivantes sont
// rangées dans meta.shortImages et téléchargées en short-<empreinte>.jpg à
// côté de l'article — un nom que le site ne publie pas (il ne lit que image.*).
// Quelles entrées sont montrées et créditées : culture-short-credits.mjs.
//
// Source : les images des articles Wikipédia du sujet (fr, en, hy, ru) et les
// candidates du brouillon — dans le sujet par construction. JAMAIS la
// recherche Commons plein texte : elle a rendu le koshary égyptien pour
// « Kochari ». Wikipédia référence aussi du bruit (icônes, drapeaux, et une
// « Mona Lisa detail eyes.jpg » sur la page de Gorky) : d'où les filtres, et
// la revue des images dans la PR avant publication.
import { existsSync } from 'node:fs'
import { readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { api, downloadImage, fetchCommonsCandidates as commons, getJson } from './culture-sources.mjs'
import { makeShortImage as shrink } from './culture-image.mjs'
import { isStale, SHORT_FILE, shortImageFile } from './culture-short-credits.mjs'

export { isStale, shortImageFile, creditedShortImages, usableShortImages, shortImagesNeedSync } from './culture-short-credits.mjs'

export const SHORT_EXTRA = 6
const PAGE_LANGS = ['fr', 'en', 'hy', 'ru']
const BITMAP = /\.(jpe?g|png|webp)$/i
// Des fichiers valides mais qui ne montrent pas le sujet.
const NOT_A_PICTURE = /\b(icon|logo|flag|signature|pictogram|coat of arms|map)\b/i
// Ni bandeau ni bâton : la planche du Short est en 920×540.
const RATIO = { min: 0.5, max: 2.5 }
// Commons ne décrit que 50 titres par requête.
const COMMONS_MAX = 50

const pause = (ms) => new Promise((r) => setTimeout(r, ms))

export const wikiImageTitles = (sources = []) =>
  sources.filter((s) => (s?.kind ?? 'wikipedia') === 'wikipedia' && PAGE_LANGS.includes(s.lang) && s.title).map(({ lang, title }) => ({ lang, title }))

// Les fichiers image d'une page, dans l'ordre de la page. L'API rend le
// préfixe dans la langue du wiki (« Fichier: », « Պատկեր: ») : ramené à File:.
export async function fetchPageImageFiles({ lang, title }, fetchImpl = fetch) {
  const j = await getJson(api(`${lang}.wikipedia.org`, { redirects: '1', prop: 'images', imlimit: '100', titles: title }), fetchImpl)
  return (j?.query?.pages?.[0]?.images ?? [])
    .map((i) => i.title.replace(/^[^:]+:/, 'File:'))
    .filter((f) => BITMAP.test(f))
}

const usable = (c) =>
  c && c.width && c.height && c.width / c.height >= RATIO.min && c.width / c.height <= RATIO.max && !NOT_A_PICTURE.test(c.file)

// `infos` : la sortie de fetchCommonsCandidates (licence, MIME et largeur
// déjà vérifiés), dans l'ordre des titres demandés. Les candidates passent
// en tête, puis Wikipédia ; la photo de l'article et les doublons sont exclus.
export function pickShortImages({ articleImage, candidates = [], infos = [] }) {
  const byFile = new Map(infos.map((c) => [c.file, c]))
  const order = [...candidates.map((c) => c.file), ...infos.map((c) => c.file)]
  const seen = new Set(articleImage?.file ? [articleImage.file] : [])
  const out = []
  for (const file of order) {
    if (seen.has(file)) continue
    seen.add(file)
    const c = byFile.get(file)
    if (usable(c)) out.push(c)
    if (out.length === SHORT_EXTRA) break
  }
  return out
}

// Les pages en échec (429 de Wikimedia, page absente) sont sautées : les
// autres langues suffisent souvent. Les titres sont pris à tour de rôle dans
// chaque page, pour que la française (souvent la plus fournie, et la première)
// ne remplisse pas seule les 50 places de la requête Commons.
export async function gatherShortImages(meta, { fetchCommonsCandidates = commons, fetchImpl = fetch, wait = 1000 } = {}) {
  const pages = []
  for (const page of wikiImageTitles(meta.sources)) {
    await pause(wait)
    try {
      pages.push(await fetchPageImageFiles(page, fetchImpl))
    } catch (e) {
      console.warn(`  ✗ images de ${page.lang}:${page.title} : ${e.message}`)
    }
  }
  const files = new Set((meta.candidates ?? []).map((c) => c.file))
  for (let i = 0; files.size < COMMONS_MAX && pages.some((p) => i < p.length); i++)
    for (const p of pages) if (i < p.length && files.size < COMMONS_MAX) files.add(p[i])
  await pause(wait)
  const infos = await fetchCommonsCandidates({ files: [...files], limit: COMMONS_MAX, max: COMMONS_MAX }, fetchImpl)
  return pickShortImages({ articleImage: meta.image, candidates: meta.candidates, infos })
}

// meta.shortImages ⇔ short-<empreinte>.jpg dans `base`. Sans liste, elle est
// rassemblée — sauf `gatherIfMissing: false` (la publication : un article
// déjà publié ne reçoit jamais d'images que personne n'a revues). `refresh`
// rassemble à nouveau. Une entrée remplacée à la main est relue sur Commons
// par son `file` — refusée = échec en clair, jamais une image sans crédit.
// Le nom du fichier suit la page Commons : une entrée retirée, déplacée ou
// renouvelée ne peut pas garder l'image d'une autre. Les fichiers qu'aucune
// entrée ne nomme sont supprimés. Modifie `meta` ; à l'appelant d'écrire
// meta.json.
export async function syncShortImages(base, meta, deps = {}) {
  const {
    fetchCommonsCandidates = commons,
    download = downloadImage,
    makeShortImage = shrink,
    gather = (m) => gatherShortImages(m, { fetchCommonsCandidates }),
    refresh = false,
    gatherIfMissing = true,
    wait = 1000,
  } = deps
  if (!Array.isArray(meta.shortImages) && !gatherIfMissing && !refresh) return { lines: [], failed: 0 }
  const lines = []
  let failed = 0
  if (!Array.isArray(meta.shortImages) || refresh) meta.shortImages = await gather(meta)
  let downloads = 0
  for (const [i, entry] of meta.shortImages.entries()) {
    try {
      if (isStale(entry)) {
        const [fresh] = await fetchCommonsCandidates({ files: [entry.file], limit: 1 })
        // fetchCommonsCandidates écarte aussi ce qui fait moins de 800 px.
        if (!fresh) throw new Error('introuvable, trop petit ou licence non libre')
        meta.shortImages[i] = fresh
      }
      const file = path.join(base, shortImageFile(meta.shortImages[i]))
      if (!existsSync(file)) {
        // Un téléchargement à la fois, espacés : Wikimedia limite les IP des runners.
        if (downloads++) await pause(wait)
        await writeFile(file, await makeShortImage(await download(meta.shortImages[i].thumbUrl)))
      }
      lines.push(`- ✓ image ${i + 2} : ${meta.shortImages[i].file}`)
    } catch (e) {
      failed++
      lines.push(`- ✗ image ${i + 2} (${entry.file}) : ${e.message}`)
    }
  }
  const keep = new Set(meta.shortImages.filter((e) => !isStale(e)).map(shortImageFile))
  for (const f of await readdir(base)) if (SHORT_FILE.test(f) && !keep.has(f)) await rm(path.join(base, f))
  return { lines, failed }
}
