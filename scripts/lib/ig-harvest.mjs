/**
 * Les décisions pures de la récolte Instagram, sorties de `ig-scrape.mjs` pour
 * être testables : ce script pilote un Chrome et n'est pas exécutable en test.
 */

// Le plus petit format qu'on accepte de DEMANDER à Instagram — à ne pas
// confondre avec la taille qu'on ÉCRIT, fixée par `image.mjs` (800px). Les deux
// existent : inutile de télécharger 1440px pour en garder 800, mais quand l'API
// n'offre aucun palier entre 640 et le plein format, c'est le plein format qui
// arrive et que l'encodage réduit. Ne pas remonter cette valeur à 800 en
// croyant simplifier : on perdrait les sources à 640-799px, qui n'ont alors
// plus rien à offrir en dessous.
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

/**
 * Faut-il arrêter de paginer ? Trois sorties, et la troisième est celle qui
 * manque à l'intuition.
 *
 * Une page qui n'ajoute rien À GARDER n'est pas forcément une page sans
 * progrès : elle peut être pleine de posts NEUFS mais tous exclus, pendant que
 * des posts valides attendent à la page suivante. La progression se mesure donc
 * sur les shortcodes BRUTS — jamais sur ce qui est retenu. Mesurée sur le
 * retenu, une liste d'exclusion qui couvre le haut d'une grille tronque la
 * récolte en silence, avec le même symptôme qu'un compte qui a peu publié.
 */
export function stopPaging({ kept, want, freshRaw, cursor }) {
  if (kept >= want) return true // on a ce qu'on voulait
  if (!cursor) return true // fin du catalogue
  if (freshRaw === 0) return true // le curseur tourne en rond : que du déjà-vu
  return false
}
