// Le minutage d'un Short narré, en JS pur : node --test le lit sans
// compilation (test/timing.test.mjs), le bundler de Remotion aussi.
//
// Une scène dure le temps de sa phrase, plus un souffle avant (LEAD : la
// scène s'installe avant que la voix parte) et après (TAIL : la phrase n'est
// pas coupée par le fondu suivant, qui mange FADE = 12 images < TAIL).
// Bornes : 6 s au moins (le texte à l'écran doit se lire), 12 s au plus (un
// WAV anormalement long ne doit pas étirer la vidéo sans fin). La fin a un
// minimum de 5 s, comme la fin fixe d'avant.

export const LEAD = 0.3 // s
export const TAIL = 0.5 // s

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const frames = (seconds, fps, minSeconds) => clamp(Math.round((LEAD + seconds + TAIL) * fps), minSeconds * fps, 12 * fps)

/** @param {number} seconds @param {number} fps @returns {number} */
export const sceneFrames = (seconds, fps) => frames(seconds, fps, 6)

/** @param {number} seconds @param {number} fps @returns {number} */
export const outroFrames = (seconds, fps) => frames(seconds, fps, 5)

// La durée de chaque séquence : les faits, puis la fin (la dernière ligne).
const durations = (lines, fps) =>
  lines.map((l, i) => (i === lines.length - 1 ? outroFrames(l.seconds, fps) : sceneFrames(l.seconds, fps)))

/** Durée totale : somme des séquences, moins un fondu entre deux séquences. */
export const narratedDuration = (lines, fps, fade) =>
  durations(lines, fps).reduce((s, d) => s + d, 0) - (lines.length - 1) * fade

/**
 * Les images où la voix parle, [début, fin[ en images de la composition :
 * la musique baisse dessous. Une séquence commence FADE images avant la fin
 * de la précédente (le fondu les superpose) ; la voix part LEAD après son
 * début, et ne dépasse jamais la fin de sa séquence (plafond de 12 s).
 */
export const speechWindows = (lines, fps, fade) => {
  const d = durations(lines, fps)
  const out = []
  let start = 0
  for (let i = 0; i < lines.length; i++) {
    const from = start + Math.round(LEAD * fps)
    const to = Math.min(from + Math.round(lines[i].seconds * fps), start + d[i])
    out.push([from, to])
    start += d[i] - fade
  }
  return out
}
