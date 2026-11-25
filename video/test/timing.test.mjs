// Garde : chaque scène d'un Short narré dure le temps de sa phrase, plus un
// souffle avant (LEAD) et après (TAIL) — jamais moins de 6 s (le texte à
// l'écran doit pouvoir se lire), jamais plus de 12 s (une voix anormalement
// longue, un WAV corrompu, ne doit pas étirer la vidéo sans fin).
import test from 'node:test'
import assert from 'node:assert/strict'
import { LEAD, TAIL, narratedDuration, outroFrames, sceneFrames, speechWindows } from '../src/shorts/timing.mjs'

const FPS = 30
const FADE = 12

test('sceneFrames : minimum, valeur calée sur la voix, plafond', () => {
  assert.equal(sceneFrames(4, FPS), 180)
  assert.equal(sceneFrames(7, FPS), 234)
  assert.equal(sceneFrames(30, FPS), 360)
})

test('outroFrames : minimum de 5 s, plafond de 12 s', () => {
  assert.equal(outroFrames(2, FPS), 150)
  assert.equal(outroFrames(5.39, FPS), Math.round((LEAD + 5.39 + TAIL) * FPS))
  assert.equal(outroFrames(30, FPS), 360)
})

const lines = [6.4, 5.95, 6.64, 6.45, 5.59, 4.48, 6.74, 5.39].map((seconds, i) => ({ file: `${i}.wav`, seconds }))

test('narratedDuration : somme des scènes et de la fin, moins les fondus', () => {
  const scenes = lines.slice(0, 7).reduce((s, l) => s + sceneFrames(l.seconds, FPS), 0)
  assert.equal(narratedDuration(lines, FPS, FADE), scenes + outroFrames(lines[7].seconds, FPS) - 7 * FADE)
})

test('speechWindows : 8 fenêtres croissantes, sans chevauchement, dans la vidéo', () => {
  const w = speechWindows(lines, FPS, FADE)
  assert.equal(w.length, 8)
  for (const [from, to] of w) assert.ok(from < to)
  for (let i = 1; i < w.length; i++) assert.ok(w[i][0] > w[i - 1][1], `fenêtre ${i} chevauche la précédente`)
  assert.equal(w[0][0], Math.round(LEAD * FPS))
  assert.ok(w[7][1] <= narratedDuration(lines, FPS, FADE))
})

test('speechWindows : la voix de la scène i part à LEAD après le début de sa séquence', () => {
  const w = speechWindows(lines, FPS, FADE)
  // La séquence 1 commence à sceneFrames(0) - FADE (le fondu chevauche).
  const start1 = sceneFrames(lines[0].seconds, FPS) - FADE
  assert.equal(w[1][0], start1 + Math.round(LEAD * FPS))
  assert.equal(w[1][1], start1 + Math.round(LEAD * FPS) + Math.round(lines[1].seconds * FPS))
})
