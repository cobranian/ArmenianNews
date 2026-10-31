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

const EXPECTED = { fr: 'Latin', de: 'Latin', it: 'Latin', en: 'Latin', es: 'Latin', hy: 'Armenian', ru: 'Cyrillic' }
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
// es : l'espagnol lit son propre fil, la fuite est le français OU l'anglais
// (le modèle recopie la langue d'un titre). « que », « entre », « sur » sont
// espagnols : absents. L'accent français ne peut pas être FRENCH_ACCENT, qui
// prend « también » (é + lettre) pour du français.
const ES_MARKERS = new Set([
  ...['les', 'une', 'dans', 'pour', 'avec', 'sont', 'cette', 'ont', 'aux', 'été', 'ses', 'leur', 'leurs', 'est', 'qui', 'des', 'du'],
  ...['the', 'and', 'with', 'which', 'from', 'this', 'that', 'were', 'been', 'have'],
])
const ES_ACCENT = /[àâçèêëîïôûùœ]/u

// Deux mots-outils français DISTINCTS ou plus, ÉCRITS EN MINUSCULES : du
// français. Les noms propres et les titres cités portent des initiales
// capitales (« Les Arméniens de France ») ; une fuite de français, elle, se voit
// en mots-outils minuscules au milieu des phrases. On n'exempte PAS le
// vocabulaire des titres sources : ils sont tous français, et la brève qui les
// recopie en prose aurait alors toutes ses fautes exemptées.
//
// Second indice, ajouté après la brève « it » du 23 octobre 2026 (titres
// italiens, textes français, passée parce que chaque sujet court n'avait qu'un
// seul mot-outil) : les mots minuscules qui portent un accent que ni
// l'allemand ni l'italien n'écrivent en milieu de mot — « développement »,
// « sécurité », « frontières ». L'italien n'accentue que la DERNIÈRE lettre
// (« perché », « città », « più ») ; ç, ê, ë, î, ï, ô, û, œ n'y existent pas.
const FRENCH_ACCENT = /[çêëîïôûœ]|[éèà]\p{L}/u
// `min` vaut 1 pour un TITRE : trop court pour porter deux indices, il est
// pourtant ce qui se lit en premier (brève « it » du 24 octobre 2026,
// « l'Arménie et les organisations internationales » : un seul, « les »).
export function frenchWords(text, lang, min = 2) {
  const markers = lang === 'es' ? ES_MARKERS : FRENCH_MARKERS_BY_LANG[lang]
  if (!markers) return []
  const accent = lang === 'es' ? ES_ACCENT : FRENCH_ACCENT
  // Minuscules seulement, pour les deux indices : « Arménie », « Grégory » sont
  // des noms propres, pas une fuite.
  const lower = words(text).filter((w) => w === w.toLowerCase())
  const found = new Set(lower.filter((w) => markers.has(w) || accent.test(w)))
  return found.size >= min ? [...found] : []
}
