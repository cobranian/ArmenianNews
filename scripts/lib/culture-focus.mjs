// Où cadrer verticalement l'image d'un article quand un cadre plus large
// qu'elle la rogne : carrousel de l'accueil (4:3), vignettes (3:2), carte de
// partage (1200×630). Module plat, sans dépendance : le build (vite.config.js,
// via culture-links), les pages statiques et le script d'images le lisent.
//
// 0 = garder le haut, 1 = garder le bas, même sens que le second terme de
// `object-position` en pourcentage — la carte JPG est rognée avec la même
// règle, pour que les trois cadrages concordent.
//
// Pourquoi : rogné au centre (CSS) ou là où « l'œil va » (sharp, position
// 'attention'), un portrait ou une statue perdait sa tête — David de Sassoun
// réduit à son socle sur la carte de partage, et donc sur Instagram
// (26 oct. 2026). Une image plus haute que large montre presque toujours une
// personne ou une statue : on garde le haut par défaut. `image.focusY` dans
// meta.json corrige un cas particulier.
export const PORTRAIT_FOCUS_Y = 0.15

export function focusY(image) {
  if (!image) return null
  const f = image.focusY
  if (typeof f === 'number' && f >= 0 && f <= 1) return f
  const w = Number(image.width)
  const h = Number(image.height)
  return w > 0 && h > w ? PORTRAIT_FOCUS_Y : null
}

// La valeur CSS, ou null (centre, le défaut du navigateur).
export function objectPosition(f) {
  return f == null ? null : `50% ${Math.round(f * 100)}%`
}
