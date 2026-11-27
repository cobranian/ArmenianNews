// scripts/lib/culture-short-credits.mjs
//
// Quelles images d'un fait (meta.shortImages) un Short peut montrer, et sous
// quel nom de fichier. Module léger (ni sharp ni réseau) : la vidéo
// (video/scripts/sync.mjs), la description YouTube (video-publish.mjs) et
// les légendes des Reels (social.mjs) lisent CETTE règle, pour que l'écran et
// les textes créditent les mêmes photos.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'

// Vrai si l'entrée doit être relue sur Commons : son `file` a été remplacé à
// la main dans la PR (le commonsUrl ne finit plus par ce fichier), ou elle n'a
// jamais été résolue.
export function isStale(entry) {
  if (!entry?.commonsUrl || !entry.file) return true
  const tail = decodeURIComponent(entry.commonsUrl.split('/wiki/').pop() ?? '')
  return tail.replace(/_/g, ' ') !== entry.file.replace(/_/g, ' ')
}

// Le fichier porte l'empreinte de SA page Commons, jamais un numéro de place :
// supprimer, échanger ou renouveler des entrées ne peut pas laisser l'image
// d'une autre sous un crédit (revue du 27 nov. 2026 — avec short-<n>.jpg,
// retirer l'entrée 2 laissait son image sous le crédit de l'entrée 3).
export const shortImageFile = (entry) => `short-${createHash('sha1').update(entry.commonsUrl).digest('hex').slice(0, 10)}.jpg`
export const SHORT_FILE = /^short-[0-9a-f]{10}\.jpg$/

// Les entrées créditables, dans l'ordre : à jour, ni la photo de l'article
// (un imageChoice changé la ferait passer deux fois de suite), ni un doublon.
export function creditedShortImages(meta) {
  const seen = new Set([meta?.image?.commonsUrl].filter(Boolean))
  return (meta?.shortImages ?? []).filter((e) => {
    if (isStale(e) || seen.has(e.commonsUrl)) return false
    seen.add(e.commonsUrl)
    return true
  })
}

// Les mêmes, avec leur fichier présent dans le dossier de l'article.
export function usableShortImages(base, meta) {
  return creditedShortImages(meta)
    .map((entry) => ({ entry, src: path.join(base, shortImageFile(entry)) }))
    .filter(({ src }) => existsSync(src))
}

// Une entrée remplacée à la main attend d'être relue : la publication doit
// alors passer par culture-translate (translationRuns).
export const shortImagesNeedSync = (meta) => (meta?.shortImages ?? []).some(isStale)
