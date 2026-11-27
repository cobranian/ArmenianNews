// Une image par fait dans un Short Culture (spec 2026-11-27 : une seule
// photo pendant ~50 s rendait la vidéo monotone). JS pur, comme timing.mjs,
// pour que node --test le lise sans compilation.

// L'image de chaque scène. Moins d'images que de faits : elles tournent —
// jamais deux fois la même de suite dès qu'il y en a deux.
export const slideImages = (nFacts, nImages) => Array.from({ length: nFacts }, (_, i) => i % Math.max(1, nImages))

// Une image plus haute que large, en `cover` dans la planche 920×540, perdait
// le haut (les têtes) : cadrée vers le haut. Le `focus` écrit dans un fait
// (Garni) l'emporte toujours.
export const slideFocus = (image, factFocus) =>
  factFocus ?? (image?.width && image?.height && image.width / image.height < 1 ? '50% 20%' : undefined)

// Le cadre de l'image (retour de Nareg sur l'essai Gorky, 27 nov. 2026 :
// planche 920×540 trop petite, images recadrées, bas de l'écran vide). Le
// cadre épouse l'image — entière, jamais coupée — et se centre dans une zone
// de 1000×740 sous le bandeau ; le texte commence sous la zone, à hauteur
// fixe d'une scène à l'autre. Le bas de l'écran reste à l'interface des Shorts.
export const FRAME_ZONE = { top: 220, left: 40, width: 1000, height: 740 }
export const TEXT_TOP = FRAME_ZONE.top + FRAME_ZONE.height + 100

export function frameBox(image) {
  const { top, left, width: W, height: H } = FRAME_ZONE
  const r = image?.width && image?.height ? image.width / image.height : 0
  if (!r) return { ...FRAME_ZONE }
  const width = r >= W / H ? W : Math.round(H * r)
  const height = r >= W / H ? Math.round(W / r) : H
  return { top: top + Math.round((H - height) / 2), left: left + Math.round((W - width) / 2), width, height }
}
