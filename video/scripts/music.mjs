// La musique des Shorts, côté Node : même données que music.tsx (music.json),
// même ligne de crédit. Un slug inconnu retombe sur « otar ».
import { readFileSync } from 'node:fs'
import { musicLine } from '../../scripts/lib/youtube-meta.mjs'

const { TRACKS, BY_SLUG } = JSON.parse(
  readFileSync(new URL('../src/shorts/music.json', import.meta.url), 'utf8'),
)

export const trackFor = (slug) => TRACKS[BY_SLUG[slug] ?? 'otar']

// La ligne elle-même n'est écrite qu'une fois, dans scripts/lib/youtube-meta.mjs.
export const musicCredit = (slug) => musicLine(BY_SLUG[slug] ?? 'otar')
