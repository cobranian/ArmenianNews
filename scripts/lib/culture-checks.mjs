// Contrôles mécaniques d'un brouillon Culture, sans modèle : ce qu'il faut
// vérifier à la main (nombres, dates, noms) et l'alerte de ligne éditoriale.
// Ils n'alertent jamais pour bloquer : la décision reste humaine.
import { fold } from './culture-prompts.mjs'

const MOIS = 'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre'
// « 12 mars 1915 » puis « mars 1915 » ; « 1er » accepté.
const DATE_RE = new RegExp(`(?:\\b\\d{1,2}(?:er)?\\s+)?\\b(?:${MOIS})\\s+\\d{4}\\b`, 'giu')
// Nombre de 2 chiffres ou plus, groupes de milliers (« 1 200 ») compris.
const NOMBRE_RE = /\d{1,3}(?:\s\d{3})+|\d{2,}/gu

// Les dates d'abord, retirées du texte ensuite : « 1915 » d'une date complète
// ne ressort pas une seconde fois ; un « 1915 » isolé, lui, est une affirmation.
export function mechanicalClaims(body) {
  const text = String(body ?? '')
  const out = []
  const reste = text.replace(DATE_RE, (m) => {
    out.push(m.trim())
    return ' '
  })
  for (const m of reste.match(NOMBRE_RE) ?? []) out.push(m)
  return [...new Set(out)]
}

// Libellés et alias fr/en : à ajouter à la botte de foin des sources.
export function entityTexts(entity) {
  if (!entity) return []
  const l = entity.labels ?? {}
  const a = entity.aliases ?? {}
  return [l.fr, l.en, ...(a.fr ?? []), ...(a.en ?? [])].filter(Boolean)
}

export function splitClaims(unsupported) {
  const facts = []
  const names = []
  for (const c of unsupported) (/\d/.test(c) ? facts : names).push(c)
  return { facts, names }
}

export const EDITORIAL_TERMS = ['azerbaïdjan', 'azerbaidjan', 'azerbaijan', 'azéri', 'azeri', 'köçəri']

// Comparaison pliée des deux côtés (« köçəri » devient « kocəri »), en début
// de mot : « azerbaïdjanaise » compte, « Arménie » non.
const TERMES_PLIES = [...new Set(EDITORIAL_TERMS.map(fold))]
const TERME_RE = new RegExp(`(^|[^\\p{L}\\p{N}])(?:${TERMES_PLIES.join('|')})`, 'u')

export function editorialAlerts(body) {
  return String(body ?? '')
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s && TERME_RE.test(fold(s)))
    .map((s) => (s.length > 160 ? s.slice(0, 160) : s))
}
