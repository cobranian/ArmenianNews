// Les voix des Shorts narrés, côté Node : une femme et un homme par langue.
//
// L'alternance se fait par RANG DE SUJET : le rang d'un article dans l'ordre de
// publication (date puis slug). Pair = voix femme, impair = voix homme. Ainsi
// deux articles consécutifs ne partagent jamais la même voix.
//
// Aucune voix par défaut : une langue inconnue ou un slug absent lève une
// erreur. Un Short muet en repli est pire qu'un run rouge.

export const VOICES = {
  fr: { female: 'Kore', male: 'Sadaltager' },
  en: { female: 'Kore', male: 'Sadaltager' },
  de: { female: 'Kore', male: 'Sadaltager' },
  it: { female: 'Sulafat', male: 'Sadaltager' },
  es: { female: 'Sulafat', male: 'Sadaltager' },
  hy: { female: 'Sulafat', male: 'Sadaltager' },
  ru: { female: 'Kore', male: 'Sadaltager' },
}

// Voix d'une langue pour un rang de sujet : pair = femme, impair = homme.
export function voiceFor({ lang, ordinal }) {
  const v = Object.hasOwn(VOICES, lang) ? VOICES[lang] : undefined
  if (!v) throw new Error(`voix : langue « ${lang} » inconnue`)
  const gender = ordinal % 2 === 0 ? 'female' : 'male'
  return { name: v[gender], gender }
}

// Rang d'un slug parmi les articles triés par date puis par slug (stable).
export function subjectOrdinal(slug, articles) {
  const sorted = [...articles].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0,
  )
  const i = sorted.findIndex((a) => a.slug === slug)
  if (i < 0) throw new Error(`voix : slug « ${slug} » absent de la liste des articles`)
  return i
}
