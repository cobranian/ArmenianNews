/**
 * Les décisions pures de la récolte Instagram, sorties de `ig-scrape.mjs` pour
 * être testables : ce script pilote un Chrome et n'est pas exécutable en test.
 */

// Les tuiles rendent autour de 300px, la lightbox guère plus de 900. Instagram
// propose plusieurs formats et le script prenait toujours le plus grand
// (~1080px) : 229 Ko de moyenne sur les 218 images du dépôt, que l'historique
// git garde pour toujours.
export const MIN_IMAGE_WIDTH = 640

// Ce que récolte un compte qui ne demande rien.
export const DEFAULT_COUNT = 9

// Plafond dur d'un `count: 'all'`. Il n'est pas là pour brider un catalogue
// plausible mais pour qu'un compte inattendu — ou une pagination qui ne se
// termine pas — ne remplisse pas le dépôt en silence.
export const MAX_COUNT = 500

// Ce qu'on demande à l'endpoint en une fois. Borne de politesse : au-delà, la
// pagination prend le relais.
export const MAX_PAGE = 50

export const shortcodeOf = (url) =>
  String(url || '').match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1] || null

/** Le plus petit format d'au moins MIN_IMAGE_WIDTH ; à défaut, le plus grand. */
export function pickImage(candidates) {
  const usable = (candidates || []).filter((c) => c && c.url)
  if (!usable.length) return null
  const w = (c) => c.width || 0
  const big = usable.filter((c) => w(c) >= MIN_IMAGE_WIDTH)
  const pool = big.length ? big : usable
  const pick = big.length
    ? pool.reduce((a, b) => (w(b) < w(a) ? b : a))
    : pool.reduce((a, b) => (w(b) > w(a) ? b : a))
  return pick.url
}

/** Combien de posts ce compte veut. `'all'` = tout, jusqu'au plafond dur. */
export function wantedFor(acc = {}) {
  const c = acc.count
  if (c === 'all') return MAX_COUNT
  if (Number.isInteger(c) && c > 0) return Math.min(c, MAX_COUNT)
  return DEFAULT_COUNT
}

/**
 * Ce qu'une page doit demander pour rendre `want` posts après exclusion, dans le
 * pire cas où tous les exclus sont en tête de grille.
 */
export function pageCount(want, excludeCount) {
  return Math.min(MAX_PAGE, want + excludeCount)
}

/** Retire les posts nommés dans la liste d'exclusion, sans changer l'ordre. */
export function keepable(items, exclude) {
  if (!exclude || !exclude.size) return items
  return items.filter((it) => !exclude.has(it.shortcode))
}
