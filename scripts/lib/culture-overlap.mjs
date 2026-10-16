// scripts/lib/culture-overlap.mjs
//
// Mesure anti-paraphrase : la part des suites de 8 mots du brouillon qu'on
// retrouve telles quelles dans les extraits Wikipédia. Au-delà du seuil, la
// PR le signale : c'est le garde-fou du « contenu propre » qu'AdSense exige.
// Les mots sont pliés (casse, diacritiques) et reconnus par \p{L}\p{N}, pour
// que l'arménien et le russe comptent autant que le français.
export const OVERLAP_N = 8
export const OVERLAP_THRESHOLD = 0.15

const words = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

export function ngrams(text, n = OVERLAP_N) {
  const w = words(text)
  const out = []
  for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(' '))
  return out
}

export function overlapRatio(draft, sources, n = OVERLAP_N) {
  const d = ngrams(draft, n)
  if (!d.length) return 0
  const s = new Set(sources.flatMap((x) => ngrams(x, n)))
  return d.filter((g) => s.has(g)).length / d.length
}
