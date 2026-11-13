// Calculs du zoom de la visionneuse (ZoomView.jsx), sans React : module plat
// pour que Node le teste (test/zoom-math.test.mjs) et pour qu'aucun export
// non-composant n'aille dans un .jsx (le lint ajouterait un avertissement
// react-refresh — voir CLAUDE.md, section Lint).
//
// L'état est { x, y, scale } : un `transform: translate(x, y) scale(scale)`
// d'origine centrale. `box` = { vw, vh } la taille de l'écran, { iw, ih } celle
// de l'image affichée à l'échelle 1 (ajustée « contain »). Les points (px, py)
// sont relatifs au CENTRE de l'écran.

export const MIN_SCALE = 1
export const MAX_SCALE = 4
export const DOUBLE_TAP_SCALE = 2.5

export function clampScale(s) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
}

// Déplacement maximal par axe : la moitié de ce qui dépasse de l'écran. Une
// image plus petite que l'écran sur un axe y reste centrée. `|| 0` évite un
// -0 qui ferait échouer les comparaisons strictes.
const bound = (v, i, s) => Math.max(0, (i * s - v) / 2)
const clamp = (v, m) => Math.min(m, Math.max(-m, v)) || 0

export function clampPan(state, box) {
  const { scale } = state
  return {
    x: clamp(state.x, bound(box.vw, box.iw, scale)),
    y: clamp(state.y, bound(box.vh, box.ih, scale)),
    scale,
  }
}

// Pincement : `view0` et `mid0` sont l'état et le milieu des doigts au DÉBUT
// du geste, `mid` le milieu actuel, `ratio` l'écart actuel / l'écart de
// départ. Le point de l'image qui était sous `mid0` se retrouve sous `mid` :
// glisser à deux doigts déplace, écarter zoome, les deux ensemble se composent.
export function pinchTo(view0, mid0, mid, ratio, box) {
  const scale = clampScale(view0.scale * ratio)
  const k = scale / view0.scale
  return clampPan(
    { x: mid.x - (mid0.x - view0.x) * k, y: mid.y - (mid0.y - view0.y) * k, scale },
    box,
  )
}

// Le point de l'image sous (px, py) y reste après le changement d'échelle.
export function zoomAt(state, newScale, px, py, box) {
  const p = { x: px, y: py }
  return pinchTo(state, p, p, newScale / state.scale, box)
}

export function toggleZoom(state, px, py, box) {
  if (state.scale > MIN_SCALE) return { x: 0, y: 0, scale: MIN_SCALE }
  return zoomAt(state, DOUBLE_TAP_SCALE, px, py, box)
}
