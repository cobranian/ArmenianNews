// Résumés des événements de l'agenda : 2-3 phrases écrites par un modèle :free
// OpenRouter, dans les six langues, à partir du texte de présentation de la
// page armenopole. Affichés dans la visionneuse (Lightbox.jsx), chargés au
// premier dépli. Conception : docs/superpowers/specs/2026-10-24-agenda-resume-design.md
//
// Ce module est PUR jusqu'à `summarizeAgenda`, qui seule touche le réseau — et
// par des fonctions injectées, pour que les tests n'en touchent aucun.
import * as cheerio from 'cheerio'
import { createHash } from 'node:crypto'

// Un texte source plus court ne dit rien qu'un résumé puisse reprendre.
export const MIN_SOURCE = 80

// Le texte de présentation d'une page d'événement armenopole, ou null.
// [itemprop="description"] d'abord (vérifié le 24 oct. 2026 sur plusieurs
// pays) ; repli sur le premier div de la colonne principale, où il vivait.
export function extractEventText(html) {
  const $ = cheerio.load(html)
  let el = $('[itemprop="description"]').first()
  if (!el.length) el = $('.col-md-8.col-md-pull-4').first().children('div').first()
  if (!el.length) return null
  el.find('br').replaceWith('\n')
  el.find('p, div, li, h1, h2, h3, h4').append('\n')
  const text = el
    .text()
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return text.length >= MIN_SOURCE ? text : null
}

// Empreinte du texte source : s'il change chez armenopole, le résumé est refait.
export const sourceHash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12)

// Ce qu'un résumé ne doit JAMAIS contenir : une heure, un prix, une adresse.
// Ce sont les détails qu'une traduction automatique fausse, et la visionneuse
// affiche déjà lieu, date et heure tirés des données d'armenopole. Les années,
// ordinaux et petits nombres (« 33e édition », « 2 concerts ») restent permis.
const NOT_LETTER_AFTER = '(?![\\p{L}])'
const VOIE =
  'rue|route|place|avenue|av\\.|chemin|ch\\.|boulevard|bd|st\\.|street|ave|road|rd|' +
  'strasse|straße|gasse|via|piazza|улица|ул\\.|проспект|փողոց|պողոտա'
const RULES = [
  ['heure', /(?<!\d)\d{1,2}[:h.]\d{2}(?!\d)|(?<!\d)\d{1,2}\s?(?:am|pm)(?![\p{L}])/iu],
  [
    'prix',
    /\d[\d'’ .,]*\s?(?:CHF|EUR|USD|AMD|€|\$|£|֏|₽|руб|драм|dram)|(?:CHF|EUR|USD|AMD|€|\$|£|֏|₽)\s?\d/iu,
  ],
  [
    'adresse',
    new RegExp(
      `(?<!\\d)\\d{1,4}\\s+(?:${VOIE})${NOT_LETTER_AFTER}|\\p{L}*(?:gasse|strasse|straße)\\s+\\d{1,4}(?!\\d)`,
      'iu',
    ),
  ],
]

export function forbiddenDetail(text) {
  for (const [name, re] of RULES) if (re.test(text)) return name
  return null
}
