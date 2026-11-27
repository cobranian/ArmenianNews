// Le Short générique d'un article Culture : les 7 faits de
// src/shorts/data/<slug>.json, la photo et le crédit rapatriés par
// scripts/sync.mjs, dans le gabarit de Garni (src/garni/Scenes.tsx).
//
// Narré : chaque scène dure le temps de sa phrase (timing.mjs), la voix
// (WAV de scripts/voice.mjs, bloc `voice` de la langue) part LEAD après le
// début de la scène, et la musique baisse dessous.
import React from 'react'
import { Sequence, staticFile, useVideoConfig } from 'remotion'
import { Audio } from '@remotion/media'
import { linearTiming, TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import type { Copy, Lang } from '../garni/content'
import { FactScene, Outro } from '../garni/Scenes'
import { FADE, FPS, OUTRO, SCENE } from '../garni/GarniShort'
import { SHORTS } from './all'
import credits from './credits.json'
import cta from './cta.json'
import type { Credit } from './types'
import { ShortMusic } from './music'
import { frameBox, slideFocus, slideImages, TEXT_TOP } from './slides.mjs'
import { fitsReel, fitsScene, LEAD, MAX_TOTAL, maxSpeechSeconds,narratedDuration, outroFrames, sceneFrames, speechWindows, type VoiceLine } from './timing.mjs'

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

const dataFor = (slug: string, lang: Lang) => {
  const data = SHORTS.find((s) => s.slug === slug)
  if (!data) throw new Error(`Short inconnu : ${slug}`)
  return data[lang]
}

// Les 8 phrases dites (7 faits + la fin), ou null pour un Short d'avant la
// narration. Root.tsx déclare aussi ces anciens Shorts : leur durée retombe
// sur le minutage fixe, et c'est le RENDU qui échoue (voicedLines), jamais
// le chargement du Studio.
const voiceOf = (slug: string, lang: Lang): VoiceLine[] | null => {
  const d = dataFor(slug, lang)
  const lines = d.voice?.lines
  return lines && lines.length === d.facts.length + 1 ? lines : null
}

// Jamais de Short muet : sans voix complète, le rendu s'arrête en clair.
export const voicedLines = (slug: string, lang: Lang): VoiceLine[] => {
  const lines = voiceOf(slug, lang)
  if (!lines) throw new Error(`Short sans voix : ${slug}/${lang} — lancer video/scripts/voice.mjs --slug ${slug} --lang ${lang}`)
  // Une phrase trop longue serait coupée en plein mot par le plafond de la
  // scène : un Short publié n'est jamais re-rendu, donc on refuse ici.
  lines.forEach((l, i) => {
    if (!fitsScene(l.seconds, FPS))
      throw new Error(
        `Short ${slug}/${lang} : phrase ${i} trop longue (${l.seconds} s > ${maxSpeechSeconds(FPS)} s) — raccourcir le texte parlé et relancer video/scripts/voice.mjs`,
      )
  })
  // Facebook refuse un Reel de plus de 90 s : refusé ici, pas à l'envoi.
  if (!fitsReel(lines, FPS, FADE))
    throw new Error(
      `Short ${slug}/${lang} : ${(narratedDuration(lines, FPS, FADE) / FPS).toFixed(1)} s au total (max ${MAX_TOTAL} s, limite des Reels) — raccourcir le texte parlé et relancer video/scripts/voice.mjs`,
    )
  return lines
}

// Les images du Short, la photo de l'article en tête (credits.json).
const imagesOf = (slug: string): Credit[] => {
  const list = (credits as Record<string, Credit[]>)[slug]
  if (!list?.length) throw new Error(`Short sans image : ${slug} — lancer video/scripts/sync.mjs`)
  return list
}

// `image` : l'index dans imagesOf (0 = la photo de l'article, <slug>.jpg ;
// k = <slug>-k.jpg). Le crédit suit l'image : c'est celui de la photo à l'écran.
export function copyFor(slug: string, lang: Lang, image = 0): Copy {
  const credit = imagesOf(slug)[image]
  const d = dataFor(slug, lang)
  return {
    brand: BRAND[lang],
    section: SECTION[lang],
    lang,
    facts: d.facts,
    outro: { kicker: KICKER[lang], title: d.outroTitle, url: URL[lang], subscribe: cta[lang].screen },
    credit: creditLine(credit, lang),
    photo: image === 0 ? `photos/${slug}.jpg` : `photos/${slug}-${image}.jpg`,
    // Le cadre épouse l'image, entière et centrée (slides.mjs).
    box: frameBox(credit),
    textTop: TEXT_TOP,
  }
}

export const shortDuration = (slug: string, lang: Lang) => {
  const lines = voiceOf(slug, lang)
  if (lines) return narratedDuration(lines, FPS, FADE)
  const n = dataFor(slug, lang).facts.length
  return n * SCENE + OUTRO - n * FADE
}

// La voix d'une séquence : LEAD après son début, coupée à sa fin.
const Voice: React.FC<{ line: VoiceLine }> = ({ line }) => {
  const { fps } = useVideoConfig()
  return (
    <Sequence from={Math.round(LEAD * fps)} layout="none" name="Voix">
      <Audio src={staticFile(line.file)} />
    </Sequence>
  )
}

export const ShortVideo: React.FC<{ slug: string; lang: Lang }> = ({ slug, lang }) => {
  const { fps } = useVideoConfig()
  const lines = voicedLines(slug, lang)
  const copy = copyFor(slug, lang)
  const outro = lines[copy.facts.length]
  // Une image par fait (slides.mjs) ; l'écran de fin garde la photo de l'article.
  const images = imagesOf(slug)
  const slides = slideImages(copy.facts.length, images.length)
  return (
    <>
      <ShortMusic slug={slug} speech={speechWindows(lines, fps, FADE)} />
      <TransitionSeries>
        {copy.facts.map((fact, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={sceneFrames(lines[i].seconds, fps)} name={`Fait ${i + 1}`}>
              <FactScene
                fact={{ ...fact, focus: slideFocus(images[slides[i]], fact.focus) }}
                copy={copyFor(slug, lang, slides[i])}
                first={i === 0}
              />
              <Voice line={lines[i]} />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
          </React.Fragment>
        ))}
        <TransitionSeries.Sequence durationInFrames={outroFrames(outro.seconds, fps)} name="Fin">
          <Outro copy={copy} />
          <Voice line={outro} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  )
}
