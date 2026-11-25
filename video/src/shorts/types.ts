import type { Fact, Lang } from '../garni/content'
import type { VoiceLine } from './timing.mjs'

// Écrit par scripts/voice.mjs : 7 phrases (les faits) puis la phrase de fin.
// Absent des Shorts d'avant la narration, qui ne sont jamais re-rendus.
export type ShortVoice = { name: string; gender: string; model: string; lines: VoiceLine[] }

export type ShortLangData = {
  facts: Fact[]
  outroTitle: string
  ytTitle: string
  ytLead: string
  voice?: ShortVoice
}

export type ShortData = { slug: string } & Record<Lang, ShortLangData>

export type Credit = { author: string; license: string; commonsUrl: string }
