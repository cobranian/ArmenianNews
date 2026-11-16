import type { Fact, Lang } from '../garni/content'

export type ShortLangData = {
  facts: Fact[]
  outroTitle: string
  ytTitle: string
  ytLead: string
}

export type ShortData = { slug: string } & Record<Lang, ShortLangData>

export type Credit = { author: string; license: string; commonsUrl: string }
