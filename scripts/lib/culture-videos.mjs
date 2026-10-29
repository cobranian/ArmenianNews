// Les vidéos YouTube des articles Culture (src/data/culture-videos.json),
// rangées par article PUIS par langue : une vidéo est tournée dans une langue
// (le Short Garni est en français) et ne s'affiche que sur la page de cette
// langue. Une vidéo française sur la page allemande serait un contenu que le
// lecteur ne comprend pas, et un VideoObject en `inLanguage: de` mentirait.
//
// Écrit à la main après chaque mise en ligne (voir videos dans la mémoire du
// projet et ../armenie-video/CHAINE-YOUTUBE.md). Fichier à part plutôt que
// dans meta.json : celui-ci est réécrit par le pipeline Culture.
//
// Une entrée invalide est IGNORÉE avec un avertissement, comme une brève
// corrompue : elle ne doit pas casser le déploiement horaire.
import { readFile } from 'node:fs/promises'

const ID = /^[\w-]{11}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DURATION = /^PT(\d+M)?\d+S$/

export function cleanVideo(v) {
  if (!v || !ID.test(v.youtube ?? '')) return null
  if (typeof v.title !== 'string' || !v.title.trim()) return null
  if (!DATE.test(v.uploadDate ?? '') || !DURATION.test(v.duration ?? '')) return null
  return {
    youtube: v.youtube,
    title: v.title,
    description: typeof v.description === 'string' ? v.description : v.title,
    uploadDate: v.uploadDate,
    duration: v.duration,
  }
}

export async function loadCultureVideos(file, log = console) {
  let raw
  try {
    raw = JSON.parse(await readFile(file, 'utf-8'))
  } catch {
    return {}
  }
  const out = {}
  for (const [slug, langs] of Object.entries(raw ?? {})) {
    for (const [lang, v] of Object.entries(langs ?? {})) {
      const ok = cleanVideo(v)
      if (!ok) {
        log.warn(`  ⚠ vidéo ${slug}/${lang} ignorée : entrée invalide`)
        continue
      }
      ;(out[slug] ??= {})[lang] = ok
    }
  }
  return out
}

export const videoFor = (videos, slug, lang) => videos?.[slug]?.[lang] ?? null

// youtube-nocookie : aucun cookie avant la lecture. C'est le SEUL domaine que
// la CSP ouvre en frame-src (firebase.json, deux blocs).
export const embedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}`
export const watchUrl = (id) => `https://www.youtube.com/shorts/${id}`
export const thumbUrl = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

// Le nœud schema.org. `embedUrl` est ce que Google demande pour une vidéo
// hébergée ailleurs ; pas de `contentUrl` : nous n'avons pas le fichier.
export function videoLd(video, lang, pageUrl, site) {
  return {
    '@type': 'VideoObject',
    '@id': `${pageUrl}#video`,
    name: video.title,
    description: video.description,
    thumbnailUrl: [thumbUrl(video.youtube)],
    uploadDate: video.uploadDate,
    duration: video.duration,
    embedUrl: embedUrl(video.youtube),
    url: watchUrl(video.youtube),
    inLanguage: lang,
    publisher: { '@id': `${site.host}/#organization` },
  }
}
