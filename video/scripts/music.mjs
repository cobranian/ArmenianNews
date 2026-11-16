// La musique des Shorts, côté Node : même données que music.tsx (music.json),
// même ligne de crédit. Un slug inconnu retombe sur « otar ».
import { readFileSync } from 'node:fs'

const { TRACKS, BY_SLUG } = JSON.parse(
  readFileSync(new URL('../src/shorts/music.json', import.meta.url), 'utf8'),
)

export const trackFor = (slug) => TRACKS[BY_SLUG[slug] ?? 'otar']

export const musicCredit = (slug) => {
  const t = trackFor(slug)
  return `♪ ${t.title} — ${t.author} · ${t.license} · ${t.url}`
}
