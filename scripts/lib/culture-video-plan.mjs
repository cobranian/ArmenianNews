// Quelles vidéos un article attend — à partir du résultat de validateArticle.
// Module pur, partagé par articles-publish.yml (Shorts à traduire avant la
// fusion) et video.yml (Shorts à rendre après).
import { ALL_LANGS } from '../../sites.config.js'

const online = (videos, slug, lang) => Boolean(videos?.[slug]?.[lang])

// Les langues à rendre : Short publiable, ni sur YouTube, ni déjà en file
// (youtube-queue.json) — un second lancement ne rend pas deux fois le même.
export function videoLangs(result, { slug, videos, queue }) {
  const queued = new Set((queue?.items ?? []).filter((i) => i.slug === slug).map((i) => i.lang))
  return ALL_LANGS.filter((l) => result.shorts?.[l] && !online(videos, slug, l) && !queued.has(l))
}

// Les langues dont l'article est publiable mais le Short ne l'est pas (absent,
// périmé ou non conforme) : une traduction --short-only les rattrape sans
// retoucher les articles déjà relus. Sans Short français valide, rien à traduire.
export function shortsToTranslate(result, { slug, videos }) {
  if (!result.shorts?.fr) return []
  return ALL_LANGS.filter((l) => l !== 'fr' && result.langs?.[l] && !result.shorts?.[l] && !online(videos, slug, l))
}
