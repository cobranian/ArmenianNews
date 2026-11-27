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
