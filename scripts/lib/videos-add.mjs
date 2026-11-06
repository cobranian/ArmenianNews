// Ajouter des Shorts publiés à src/data/culture-videos.json — la partie PURE.
//
// Ce fichier est LA trace de ce qui est en ligne sur YouTube : il alimente les
// pages (bloc « En vidéo », VideoObject) et le tableau de bord (🎬 Vidéos).
// Les identifiants vivaient aussi dans armenie-video/out/youtube/ids-*.txt,
// dossier ignoré par git et présent sur un seul PC ; ils ne font plus foi.
//
// Le titre et la description viennent des métadonnées d'envoi
// (armenie-video/out/youtube/<slug>-<lang>.json), sous la forme où YouTube
// les affiche : on retire le mot-dièse final du titre (#Armenien), et on ne
// garde de la description que le premier paragraphe (le reste : lien, crédits).
import { cleanVideo } from './culture-videos.mjs'

export const DEFAULT_DURATION = 'PT44S'

export function entryFromMeta(meta, { youtube, uploadDate, duration = DEFAULT_DURATION }) {
  return {
    youtube,
    title: String(meta.title ?? '').replace(/\s*#\S+\s*$/, '').trim(),
    description: String(meta.description ?? '').split(/\r?\n\s*\r?\n/)[0].trim(),
    uploadDate,
    duration,
  }
}

// `adds` : [{ slug, lang, entry }]. Rend { videos, added, skipped } sans muter
// l'entrée. Une entrée déjà là avec le MÊME id est sautée (relancer est sans
// danger) ; avec un AUTRE id, c'est une erreur, sauf `force` — un Short
// remplacé se décide, il ne s'écrase pas par mégarde.
export function addVideos(videos, adds, { force = false } = {}) {
  const next = structuredClone(videos ?? {})
  const added = []
  const skipped = []
  for (const { slug, lang, entry } of adds) {
    if (!cleanVideo(entry)) throw new Error(`${slug}/${lang} : entrée invalide (${JSON.stringify(entry)})`)
    const had = next[slug]?.[lang]
    if (had?.youtube === entry.youtube) {
      skipped.push(`${slug}/${lang}`)
      continue
    }
    if (had && !force) throw new Error(`${slug}/${lang} a déjà la vidéo ${had.youtube} (≠ ${entry.youtube}) — --force pour remplacer`)
    ;(next[slug] ??= {})[lang] = entry
    added.push(`${slug}/${lang}`)
  }
  return { videos: next, added, skipped }
}

// « slug id » par ligne (format des ids-*.txt), lignes vides et # ignorées.
export function parseIdLines(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [slug, youtube, extra] = l.split(/\s+/)
      if (!slug || !youtube || extra) throw new Error(`ligne illisible : « ${l} » (attendu : <slug> <id>)`)
      return { slug, youtube }
    })
}
