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

// Le point de l'image sous (px, py) y reste après le changement d'échelle.
export function zoomAt(state, newScale, px, py, box) {
  const scale = clampScale(newScale)
  const k = scale / state.scale
  return clampPan({ x: px - (px - state.x) * k, y: py - (py - state.y) * k, scale }, box)
}

export function toggleZoom(state, px, py, box) {
  if (state.scale > MIN_SCALE) return { x: 0, y: 0, scale: MIN_SCALE }
  return zoomAt(state, DOUBLE_TAP_SCALE, px, py, box)
}
