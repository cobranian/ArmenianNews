// Le garde-fou d'ÉCRITURE de la brève : un sujet arménien ou russe ne publie
// pas de mots en lettres latines sortis de nulle part, et l'inverse en
// français, allemand, italien et anglais.
//
// Mesuré le 17 octobre 2026 : les modèles :free intercalaient dans la brève
// arménienne « remporter », « capitaine », « successoffice », un mot à moitié
// latin (« Մասսudz »), et dans la russe « football », « wellbeing ». Un texte
// valide, publié, indexé — rien ne tombait.
//
// Ce n'est PAS une relecture éditoriale (la publication reste automatique) :
// seulement la cohérence de l'alphabet. Un mot d'une autre écriture reste
// permis quand il vient des TITRES SOURCES du sujet (un nom propre, une
// marque citée telle quelle), quand c'est le nom d'une rédaction, ou quand
// c'est un sigle en capitales (COP, UNESCO). Un mot qui MÉLANGE deux
// alphabets n'est jamais permis : aucune langue n'en écrit.
import { SOURCE_NAMES } from '../../src/newsLangs.js'

const EXPECTED = { fr: 'Latin', de: 'Latin', it: 'Latin', en: 'Latin', hy: 'Armenian', ru: 'Cyrillic' }
const SCRIPTS = {
  Latin: /\p{Script=Latin}/u,
  Armenian: /\p{Script=Armenian}/u,
  Cyrillic: /\p{Script=Cyrillic}/u,
}

const words = (s) => String(s ?? '').match(/[\p{L}\p{M}]+/gu) ?? []

// Les mots qu'un sujet a le droit d'écrire dans une autre écriture : ceux de
// ses titres sources, et les noms des rédactions.
export function allowedWords(titles = []) {
  const set = new Set()
  for (const t of [...titles, ...Object.keys(SOURCE_NAMES), ...Object.values(SOURCE_NAMES)])
    for (const w of words(t)) set.add(w.toLowerCase())
  return set
}

// Les mots fautifs d'un texte pour une langue donnée (vide = texte propre).
export function strayWords(text, lang, allowed = new Set()) {
  const expected = EXPECTED[lang]
  if (!expected) return []
  const out = []
  for (const w of words(text)) {
    const found = Object.keys(SCRIPTS).filter((s) => SCRIPTS[s].test(w))
    if (found.length > 1) {
      out.push(w) // alphabets mêlés dans un même mot
      continue
    }
    if (!found.length || found[0] === expected) continue
    if (w.length < 3) continue
    if (/^\p{Lu}{2,7}$/u.test(w)) continue // sigle
    if (allowed.has(w.toLowerCase())) continue
    out.push(w)
  }
  return out
}

// Le français qui s'est glissé dans une brève allemande ou italienne : le seul
// cas que l'alphabet ne voit pas, les trois langues s'écrivant en latin. de et
// it lisent des titres français, et un modèle :free recopie volontiers la
// langue de ses titres (mesuré le 23 octobre 2026 : brève « it » entièrement
// en français, publiée telle quelle sans ce garde).
//
// Les marqueurs sont PAR LANGUE CIBLE : seuls comptent des mots-outils qui ne
// sont jamais un mot ordinaire de cette langue. « des » et « du » sont
// allemands (génitif, pronom) ; « est » (point cardinal), « qui » (« ici ») et
// « ce » sont italiens — un garde commun rejetterait de la prose valide, en
// silence. « par » est écarté des deux listes (terme de golf, abréviations) ;
// « que » reste : ni l'allemand ni l'italien ne l'écrivent.
const COMMON = ['les', 'une', 'dans', 'pour', 'avec', 'sont', 'que', 'cette', 'ont', 'aux', 'sur', 'été', 'entre', 'ses', 'leur', 'leurs']
const FRENCH_MARKERS_BY_LANG = {
  de: new Set([...COMMON, 'est', 'qui']),
  it: new Set([...COMMON, 'des', 'du']),
}

// Deux mots-outils français DISTINCTS ou plus : du français. Les mots des
// titres sources du sujet (`allowed`, comme pour strayWords) sont exemptés : un
// titre français cité tel quel n'est pas une brève rédigée en français.
export function frenchWords(text, lang, allowed = new Set()) {
  const markers = FRENCH_MARKERS_BY_LANG[lang]
  if (!markers) return []
  const found = new Set(
    words(text).map((w) => w.toLowerCase()).filter((w) => markers.has(w) && !allowed.has(w)),
  )
  return found.size >= 2 ? [...found] : []
}
