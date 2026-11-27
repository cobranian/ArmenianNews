// scripts/lib/culture-short-images.mjs
//
// Les images d'un Short Culture : une par fait, pour le rythme (une seule
// photo pendant ~50 s rendait la vidéo monotone). Image 1 = la photo de
// l'article (meta.image, image.jpg) ; les SHORT_EXTRA suivantes sont
// rangées dans meta.shortImages et téléchargées en short-<n>.jpg à côté de
// l'article — un nom que le site ne publie pas (il ne lit que image.*).
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

export const SHORT_EXTRA = 6
const PAGE_LANGS = ['fr', 'en', 'hy', 'ru']
const BITMAP = /\.(jpe?g|png|webp)$/i
// Des fichiers valides mais qui ne montrent pas le sujet.
const NOT_A_PICTURE = /\b(icon|logo|flag|signature|pictogram|coat of arms|map)\b/i
// Ni bandeau ni bâton : la planche du Short est en 920×540.
const RATIO = { min: 0.5, max: 2.5 }

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

export async function gatherShortImages(meta, { fetchCommonsCandidates = commons, fetchImpl = fetch, wait = 1000 } = {}) {
  const files = (meta.candidates ?? []).map((c) => c.file)
  for (const page of wikiImageTitles(meta.sources)) {
    await pause(wait)
    files.push(...(await fetchPageImageFiles(page, fetchImpl)))
  }
  await pause(wait)
  const infos = await fetchCommonsCandidates({ files: [...new Set(files)], limit: 50, max: 50 }, fetchImpl)
  return pickShortImages({ articleImage: meta.image, candidates: meta.candidates, infos })
}

// Vrai si l'entrée doit être relue sur Commons : Nareg a remplacé son `file`
// à la main dans la PR (le commonsUrl ne finit plus par ce fichier), ou
// l'entrée n'a jamais été résolue.
export function isStale(entry) {
  if (!entry?.commonsUrl || !entry.file) return true
  const tail = decodeURIComponent(entry.commonsUrl.split('/wiki/').pop() ?? '')
  return tail.replace(/_/g, ' ') !== entry.file.replace(/_/g, ' ')
}

export const shortImageFile = (n) => `short-${n}.jpg`

// meta.shortImages ⇔ short-<n>.jpg dans `base`. Sans liste (ou `refresh`),
// elle est rassemblée ; une entrée remplacée à la main est relue sur Commons
// par son `file` — introuvable ou non libre = échec en clair, jamais une
// image sans crédit. Les fichiers manquants ou périmés sont téléchargés, ceux
// au-delà de la liste supprimés (sync les recopierait sans crédit). Modifie
// `meta` ; à l'appelant d'écrire meta.json.
export async function syncShortImages(base, meta, deps = {}) {
  const {
    fetchCommonsCandidates = commons,
    download = downloadImage,
    makeShortImage = shrink,
    gather = (m) => gatherShortImages(m, { fetchCommonsCandidates }),
    refresh = false,
  } = deps
  const lines = []
  let failed = 0
  if (!Array.isArray(meta.shortImages) || refresh) meta.shortImages = await gather(meta)
  for (const [i, entry] of meta.shortImages.entries()) {
    const n = i + 1
    const file = path.join(base, shortImageFile(n))
    try {
      const stale = isStale(entry)
      if (stale) {
        const [fresh] = await fetchCommonsCandidates({ files: [entry.file], limit: 1 })
        if (!fresh) throw new Error('introuvable ou licence non libre')
        meta.shortImages[i] = fresh
      }
      if (stale || !existsSync(file)) await writeFile(file, await makeShortImage(await download(meta.shortImages[i].thumbUrl)))
      lines.push(`- ✓ image ${n + 1} : ${meta.shortImages[i].file}`)
    } catch (e) {
      failed++
      lines.push(`- ✗ image ${n + 1} (${entry.file}) : ${e.message}`)
    }
  }
  const keep = new Set(meta.shortImages.map((_, i) => shortImageFile(i + 1)))
  for (const f of await readdir(base))
    if (/^short-\d+\.jpg$/.test(f) && !keep.has(f)) await rm(path.join(base, f))
  return { lines, failed }
}
