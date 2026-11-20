// La musique des Shorts, côté Node : même table de pistes que music.tsx
// (music.json#TRACKS), même ligne de crédit.
//
// La piste d'un slug se lit dans son article, src/data/culture/<slug>/short.fr.json
// (`music`) — là où elle se choisit, et là où la lit la CI (video-publish.mjs).
// music.json#BY_SLUG n'en est qu'une COPIE, écrite par sync.mjs et jetée en CI
// (`git checkout -- .`) : la lire d'abord donnait « otar » à tout article
// postérieur à la dernière copie commitée — crédit et licence faux dans
// reels.json (reels:add) et dans les descriptions YouTube (describe.mjs).
// BY_SLUG ne sert plus qu'aux slugs SANS short.fr.json, écrits à la main
// (Garni). Un slug inconnu des deux est une ERREUR, jamais « otar » en silence.
import { existsSync, readFileSync } from 'node:fs'
import { musicLine } from '../../scripts/lib/youtube-meta.mjs'

const { TRACKS, BY_SLUG } = JSON.parse(
  readFileSync(new URL('../src/shorts/music.json', import.meta.url), 'utf8'),
)
const CULTURE = new URL('../../src/data/culture/', import.meta.url)

// `culture` : le dossier des articles (les tests en donnent un autre).
export function musicFor(slug, { culture = CULTURE } = {}) {
  const file = new URL(`${slug}/short.fr.json`, culture)
  if (existsSync(file)) {
    const id = JSON.parse(readFileSync(file, 'utf8'))?.music
    if (!(id in TRACKS)) throw new Error(`${slug} : music « ${id} » inconnue (short.fr.json)`)
    return id
  }
  const id = BY_SLUG[slug]
  if (!(id in TRACKS)) throw new Error(`${slug} : aucune piste (ni short.fr.json, ni music.json#BY_SLUG)`)
  return id
}

export const trackFor = (slug, opts) => TRACKS[musicFor(slug, opts)]

// La ligne elle-même n'est écrite qu'une fois, dans scripts/lib/youtube-meta.mjs.
export const musicCredit = (slug, opts) => musicLine(musicFor(slug, opts))
