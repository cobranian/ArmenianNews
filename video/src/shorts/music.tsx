// La musique des Shorts : une piste de duduk par thème, sous licence libre.
// Les fichiers de public/music/ sont normalisés à ~-16 LUFS (ffmpeg loudnorm)
// depuis les originaux de music-src/ (hors git) ; le premier silence de la
// piste de Mazia est déjà coupé.
//
// Jamais un enregistrement du commerce : Content ID le revendiquerait et les
// Reels partiraient muets. Le crédit va dans CHAQUE description (musicCredit).
import React from 'react'
import { interpolate, staticFile, useVideoConfig } from 'remotion'
import { Audio } from '@remotion/media'
import music from './music.json'

export type TrackId = 'mazia' | 'sergo' | 'otar'

export type Track = {
  file: string
  title: string
  author: string
  license: string
  url: string
}

// Les pistes et leur classement par slug vivent dans music.json : Node (scripts/)
// les lit sans analyseur TSX. Les commentaires de choix musical y sont perdus ;
// repères : mazia = ample (foi, écrit, pierre), sergo = sombre (histoire,
// batailles, royaumes), otar = populaire (vie, fête, arts).
export const TRACKS = music.TRACKS as Record<TrackId, Track>


// Un slug absent tombe sur « otar » : un nouvel article a donc toujours une
// musique, mais il vaut mieux le classer dans music.json en l'ajoutant.
const BY_SLUG = music.BY_SLUG as Record<string, TrackId>

export const trackFor = (slug: string): Track => TRACKS[BY_SLUG[slug] ?? 'otar']

// Ligne de crédit pour la description YouTube / la légende du Reel.
export const musicCredit = (slug: string) => {
  const t = trackFor(slug)
  return `♪ ${t.title} — ${t.author} · ${t.license} · ${t.url}`
}

const FADE_IN = 0.6 // s
const FADE_OUT = 3 // s
// Sous la voix : 0,3 (≈ −10 dB), rampes de 0,25 s de part et d'autre.
const DUCK = 0.3
const RAMP = 0.25 // s

// Posée sous le TransitionSeries : la composition entière, fondu au début et
// à la fin calés sur sa durée réelle. `speech` : les fenêtres où la voix
// parle (timing.mjs#speechWindows) ; absent (Garni), la musique reste pleine.
export const ShortMusic: React.FC<{ slug: string; speech?: [number, number][] }> = ({ slug, speech = [] }) => {
  const { fps, durationInFrames } = useVideoConfig()
  const end = durationInFrames
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
  const r = RAMP * fps
  const duck = (f: number) =>
    speech.reduce(
      (v, [from, to]) => Math.min(v, interpolate(f, [from - r, from, to, to + r], [1, DUCK, DUCK, 1], clamp)),
      1,
    )
  return (
    <Audio
      src={staticFile(trackFor(slug).file)}
      volume={(f) => interpolate(f, [0, FADE_IN * fps, end - FADE_OUT * fps, end], [0, 1, 1, 0], clamp) * duck(f)}
    />
  )
}
