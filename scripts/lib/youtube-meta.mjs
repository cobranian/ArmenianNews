// Titre et description YouTube d'un Short — la partie PURE, partagée par la CI
// (scripts/video-publish.mjs, qui remplit src/data/youtube-queue.json) et par
// l'outil local video/scripts/describe.mjs. Une seule écriture : les Shorts
// envoyés automatiquement disent exactement ce que disaient les 160 envoyés à
// la main (historique : video/youtube-meta/<slug>-<lang>.json).
//
// Description = chapeau, lien vers l'article (utm), crédit de la photo,
// mots-dièse, puis crédit de la musique. La licence de la photo décide de sa
// dernière ligne : une photo CC BY-SA oblige la vidéo à la même licence
// (partage dans les mêmes conditions) ; domaine public, CC0 et CC BY
// n'imposent que la mention de l'auteur.
import { readFileSync } from 'node:fs'
import { cultureUrl } from '../../sites.config.js'
import { HASHTAG, YT_TITLE_MAX } from './culture-short.mjs'

// Les pistes : la même table que lit Remotion (video/src/shorts/music.json).
const { TRACKS } = JSON.parse(readFileSync(new URL('../../video/src/shorts/music.json', import.meta.url), 'utf8'))

const TAGS = {
  fr: '#Arménie #culture #histoire #Shorts',
  en: '#Armenia #culture #history #Shorts',
  hy: '#Հայաստան #մշակույթ #պատմություն #Shorts',
  ru: '#Армения #культура #история #Shorts',
  de: '#Armenien #Kultur #Geschichte #Shorts',
  it: '#Armenia #cultura #storia #Shorts',
  es: '#Armenia #cultura #historia #Shorts',
}
const FULL = {
  fr: "L'article complet :",
  en: 'Full article:',
  hy: 'Ամբողջական հոդվածը՝',
  ru: 'Полная статья:',
  de: 'Der vollständige Artikel:',
  it: "L'articolo completo:",
  es: 'Artículo completo:',
}
// L'anglais garde « Public domain » tel que Commons l'écrit.
const PD = {
  fr: 'domaine public',
  hy: 'հանրային սեփականություն',
  ru: 'общественное достояние',
  de: 'gemeinfrei',
  it: 'pubblico dominio',
  es: 'dominio público',
}
const PHOTO = {
  fr: (a, l) => `Photo : ${a}, ${l}, via Wikimedia Commons :`,
  en: (a, l) => `Photo: ${a}, ${l}, via Wikimedia Commons:`,
  hy: (a, l) => `Լուսանկարը՝ ${a}, ${l}, Wikimedia Commons-ի միջոցով՝`,
  ru: (a, l) => `Фото: ${a}, ${l}, через Wikimedia Commons:`,
  de: (a, l) => `Foto: ${a}, ${l}, via Wikimedia Commons:`,
  it: (a, l) => `Foto: ${a}, ${l}, via Wikimedia Commons:`,
  es: (a, l) => `Foto: ${a}, ${l}, vía Wikimedia Commons:`,
}
const SAME = {
  fr: (l) => `Cette vidéo est diffusée sous la même licence (${l}).`,
  en: (l) => `This video is shared under the same licence (${l}).`,
  hy: (l) => `Այս տեսանյութը տարածվում է նույն լիցենզիայով (${l})։`,
  ru: (l) => `Это видео распространяется по той же лицензии (${l}).`,
  de: (l) => `Dieses Video wird unter derselben Lizenz (${l}) veröffentlicht.`,
  it: (l) => `Questo video è distribuito con la stessa licenza (${l}).`,
  es: (l) => `Este vídeo se distribuye bajo la misma licencia (${l}).`,
}

// La ligne de crédit d'une piste (♪ …) : aussi celle de src/data/reels.json.
export function musicLine(trackId) {
  const t = TRACKS[trackId]
  if (!t) throw new Error(`piste « ${trackId} » inconnue (video/src/shorts/music.json)`)
  return `♪ ${t.title} — ${t.author} · ${t.license} · ${t.url}`
}

function photoLines(lang, credit) {
  const lic = PD[lang] && /^public domain$/i.test(credit.license) ? PD[lang] : credit.license
  const lines = [PHOTO[lang](credit.author, lic), credit.commonsUrl]
  if (/BY-SA/i.test(credit.license)) lines.push(SAME[lang](credit.license))
  return lines
}

// short : { ytTitle, ytLead } ; credit : { author, license, commonsUrl } (le
// meta.json de l'article) ; music : l'id de piste (short.fr.json#music).
export function youtubeMeta({ slug, lang, short, credit, music }) {
  if (!TAGS[lang]) throw new Error(`langue inconnue : ${lang}`)
  const title = `${short.ytTitle} ${HASHTAG[lang]}`
  if (title.length > YT_TITLE_MAX) throw new Error(`${slug}/${lang} : titre de ${title.length} caractères (YouTube : ${YT_TITLE_MAX} max)`)
  const url = `${cultureUrl(lang, slug)}?utm_source=youtube&utm_medium=video`
  const description = [
    short.ytLead,
    '',
    `${FULL[lang]} ${url}`,
    '',
    ...photoLines(lang, credit),
    '',
    TAGS[lang],
    '',
    musicLine(music),
  ].join('\n')
  return { title, description }
}
