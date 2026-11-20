// Contrôles mécaniques d'un brouillon Culture, sans modèle : ce qu'il faut
// vérifier à la main (nombres, dates, noms) et l'alerte de ligne éditoriale.
// Ils n'alertent jamais pour bloquer : la décision reste humaine.
import { fold, buildClaimsMessages, parseClaims, findUnsupported, buildShortMessages } from './culture-prompts.mjs'
import { validateShort, parseShortJson } from './culture-short.mjs'

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
    // Seule l'année est une affirmation vérifiable : la phrase française
    // « 12 mars 1915 » ne se retrouverait pas telle quelle dans une source
    // en/hy/ru (faux positif). Le jour, lui, n'est pas émis.
    out.push(m.match(/\d{4}$/)[0])
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

// Les faits du texte (liste du modèle + nombres et dates mécaniques) confrontés
// aux sources. Contrôle, pas condition : une panne du modèle ne lève pas — le
// brouillon fini est gardé et `unsupported` vaut null (« vérifiez tout à la
// main »), jamais « rien à signaler ». Un repli de modèle est annoncé dans la PR.
// `chat` est chatDraft (injecté : ce module reste sans réseau).
export async function verifyClaims({ body, haystack, chat }) {
  const warnings = []
  let claims = null
  let error = null
  try {
    const res = await chat({ temperature: 0, messages: buildClaimsMessages(body) })
    if (res.fellBack) warnings.push(`Liste des faits extraite par le modèle de secours ${res.model} (Gemini indisponible).`)
    claims = parseClaims(res.text)
  } catch (e) {
    error = e.message
    warnings.push(`Extraction automatique des faits en échec (${e.message}).`)
  }
  const unsupported =
    claims === null ? null : splitClaims(findUnsupported([...new Set([...claims, ...mechanicalClaims(body)])], haystack))
  return { unsupported, warnings, error }
}

// Le Short ne garde que ses champs : ce qu'un modèle ajoute n'entre pas dans
// short.fr.json.
const pickShort = (s) => ({
  facts: s.facts.map(({ eyebrow, title, text, big }) => ({ eyebrow, title, text, big })),
  outroTitle: s.outroTitle,
  ytTitle: s.ytTitle,
  ytLead: s.ytLead,
  music: s.music,
})

// Le texte du Short, rédigé APRÈS l'article et validé contre lui
// (`articleText` : shortReference de l'article — titre, description, corps —,
// la référence même de culture-check et de culture-translate).
// Même contrat que verifyClaims : ne lève jamais. `short` vaut null après
// `attempts` échecs, `error` dit le dernier — la PR l'affiche
// (« ⚠️ Pas de vidéo : … ») et l'article part sans vidéo.
// Un essai refusé repart AVEC sa raison : redemandé à l'aveugle, le modèle
// refaisait la même faute (Zvartnots, 17 nov. 2026 : « 320 » absent de
// l'article aux deux essais — l'article est parti sans vidéo).
export async function draftShort({ title, description, body, articleText, chat, attempts = 3 }) {
  const warnings = []
  let error = null
  const base = buildShortMessages({ title, description, body })
  let messages = base
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await chat({ messages })
      const parsed = parseShortJson(res.text)
      const problems = parsed ? validateShort(parsed, { lang: 'fr', articleText }) : ['JSON illisible']
      if (!problems.length) {
        if (res.fellBack) warnings.push(`Texte de la vidéo rédigé par le modèle de secours ${res.model} (Gemini indisponible).`)
        return { short: pickShort(parsed), warnings, error: null }
      }
      error = problems.join(' ; ')
      messages = [
        ...base,
        { role: 'assistant', content: String(res.text ?? '') },
        { role: 'user', content: `Réponse refusée : ${error}. Corrige ces points en respectant toutes les règles (chaque nombre doit figurer tel quel dans l'article) et renvoie l'objet JSON complet, sans texte autour.` },
      ]
    } catch (e) {
      error = e.message
    }
  }
  return { short: null, warnings, error }
}

// Le Short après un « /corrige » : `returned` (celui que rend le modèle) s'il
// est valide contre le nouvel article ; sinon l'ancien, tant qu'il reste fidèle
// à l'article révisé ; sinon rien — un texte de vidéo périmé ne doit pas
// survivre en silence (`reason` part dans la réponse au relecteur). Article
// inchangé : l'ancien est gardé tel quel, valide ou non (culture-check le dira).
// `action` : updated | kept | deleted | none (aucun Short avant la révision).
export function reviseShort({ oldShort, returned, oldText, newText }) {
  if (!oldShort) return { short: null, action: 'none', reason: null }
  const fresh = returned && typeof returned === 'object' ? validateShort(returned, { lang: 'fr', articleText: newText }) : ['absent de la réponse']
  if (!fresh.length) return { short: pickShort(returned), action: 'updated', reason: null }
  if (oldText === newText) return { short: oldShort, action: 'kept', reason: fresh.join(' ; ') }
  const stale = validateShort(oldShort, { lang: 'fr', articleText: newText })
  if (!stale.length) return { short: oldShort, action: 'kept', reason: fresh.join(' ; ') }
  return { short: null, action: 'deleted', reason: stale.join(' ; ') }
}

export const EDITORIAL_TERMS =['azerbaïdjan', 'azerbaidjan', 'azerbaijan', 'azéri', 'azeri', 'köçəri']

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
