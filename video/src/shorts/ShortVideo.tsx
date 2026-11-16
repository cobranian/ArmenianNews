// Le Short générique d'un article Culture : les 7 faits de
// src/shorts/data/<slug>.json, la photo et le crédit rapatriés par
// scripts/sync.mjs, dans le gabarit de Garni (src/garni/Scenes.tsx).
import React from 'react'
import { linearTiming, TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import type { Copy, Lang } from '../garni/content'
import { FactScene, Outro } from '../garni/Scenes'
import { FADE, OUTRO, SCENE } from '../garni/GarniShort'
import { SHORTS } from './all'
import credits from './credits.json'
import type { Credit } from './types'
import { ShortMusic } from './music'

// hy, ru et es partent sur la chaîne Armenia News (le .org), de et it sur
// Arménie Info (le .ch) — chaque langue suit le domaine qui la sert
// (sites.config.js). La marque arménienne suit le site : /hy/ affiche
// « Արմենիա Ինֆո » (STRINGS.hy['site.title']).
export const BRAND: Record<Lang, string> = {
  fr: 'Arménie Info',
  en: 'Armenia News',
  hy: 'Արմենիա Ինֆո',
  ru: 'Armenia News',
  de: 'Arménie Info',
  it: 'Arménie Info',
  es: 'Armenia News',
}
export const SECTION: Record<Lang, string> = {
  fr: 'Culture',
  en: 'Culture',
  hy: 'Մշակույթ',
  ru: 'Культура',
  de: 'Kultur',
  it: 'Cultura',
  es: 'Cultura',
}
export const KICKER: Record<Lang, string> = {
  fr: "L'histoire complète",
  en: 'The full story',
  hy: 'Ամբողջական պատմությունը',
  ru: 'Вся история',
  de: 'Die ganze Geschichte',
  it: 'La storia completa',
  es: 'La historia completa',
}
export const URL: Record<Lang, string> = {
  fr: 'armenieinfo.ch/culture',
  en: 'armenianews.org/culture',
  hy: 'armenianews.org/hy/culture',
  ru: 'armenianews.org/ru/culture',
  // cultureUrl() de sites.config.js : CULTURE_SLUGS.de = 'kultur/', it/es = 'cultura/'.
  de: 'armenieinfo.ch/de/kultur',
  it: 'armenieinfo.ch/it/cultura',
  es: 'armenianews.org/es/cultura',
}

// « Public domain » se traduit (mêmes mots que out/youtube/translations.json).
const PUBLIC_DOMAIN: Record<Lang, string> = {
  fr: 'Domaine public',
  en: 'Public domain',
  hy: 'հանրային սեփականություն',
  ru: 'общественное достояние',
  de: 'gemeinfrei',
  it: 'pubblico dominio',
  es: 'dominio público',
}
const PHOTO: Record<Lang, string> = {
  fr: 'Photo : ',
  en: 'Photo: ',
  hy: 'Լուսանկարը՝ ',
  ru: 'Фото: ',
  de: 'Foto: ',
  it: 'Foto: ',
  es: 'Foto: ',
}
const licence = (l: string, lang: Lang) => (/^public domain$/i.test(l) ? PUBLIC_DOMAIN[lang] : l)

export const creditLine = (c: Credit, lang: Lang) =>
  `${PHOTO[lang]}${c.author} · ${licence(c.license, lang)} · Wikimedia Commons`

export function copyFor(slug: string, lang: Lang): Copy {
  const data = SHORTS.find((s) => s.slug === slug)
  if (!data) throw new Error(`Short inconnu : ${slug}`)
  const credit = (credits as Record<string, Credit>)[slug]
  const d = data[lang]
  return {
    brand: BRAND[lang],
    section: SECTION[lang],
    lang,
    facts: d.facts,
    outro: { kicker: KICKER[lang], title: d.outroTitle, url: URL[lang] },
    credit: creditLine(credit, lang),
    photo: `photos/${slug}.jpg`,
    // Les photos du site sont en 1200×630 : une planche de 920×540 les montre
    // presque entières, sans agrandissement.
    plate: 540,
  }
}

export const shortDuration = (slug: string, lang: Lang) => {
  const n = copyFor(slug, lang).facts.length
  return n * SCENE + OUTRO - n * FADE
}

export const ShortVideo: React.FC<{ slug: string; lang: Lang }> = ({ slug, lang }) => {
  const copy = copyFor(slug, lang)
  return (
    <>
      <ShortMusic slug={slug} />
      <TransitionSeries>
        {copy.facts.map((fact, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={SCENE} name={`Fait ${i + 1}`}>
              <FactScene fact={fact} copy={copy} first={i === 0} />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
          </React.Fragment>
        ))}
        <TransitionSeries.Sequence durationInFrames={OUTRO} name="Fin">
          <Outro copy={copy} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  )
}
