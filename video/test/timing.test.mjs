// Garde : chaque scène d'un Short narré dure le temps de sa phrase, plus un
// souffle avant (LEAD) et après (TAIL) — jamais moins de 6 s (le texte à
// l'écran doit pouvoir se lire), jamais plus de 12 s (une voix anormalement
// longue, un WAV corrompu, ne doit pas étirer la vidéo sans fin).
import test from 'node:test'
import assert from 'node:assert/strict'
import { LEAD, MAX_TOTAL, TAIL, fitsReel, fitsScene, maxSpeechSeconds, narratedDuration, outroFrames, sceneFrames, speechWindows } from '../src/shorts/timing.mjs'

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

test('fitsScene : une phrase plus longue que 12 s − LEAD − TAIL ne tient pas (elle serait coupée)', () => {
  assert.equal(maxSpeechSeconds(FPS), 11.2)
  assert.equal(fitsScene(11.2, FPS), true)
  assert.equal(fitsScene(11.25, FPS), false)
  assert.equal(fitsScene(30, FPS), false)
  assert.equal(fitsScene(4, FPS), true)
  // Au plafond exact, la phrase entière tient dans sa séquence.
  assert.ok(Math.round((LEAD + maxSpeechSeconds(FPS)) * FPS) <= sceneFrames(maxSpeechSeconds(FPS), FPS))
})

test('fitsReel : un Short narré de plus de 89 s est refusé (Reels Facebook : 90 s)', () => {
  assert.equal(MAX_TOTAL, 89)
  assert.equal(fitsReel(lines, FPS, FADE), true) // ~51 s : un Short réel
  const long = (s) => Array.from({ length: 8 }, (_, i) => ({ file: `${i}.wav`, seconds: s }))
  // 8 séquences de 12 s, moins 7 fondus : 93,2 s — atteignable sous les plafonds de scène.
  assert.equal(narratedDuration(long(11.2), FPS, FADE), 8 * 360 - 7 * FADE)
  assert.equal(fitsReel(long(11.2), FPS, FADE), false)
  // À la limite : 7 scènes plafonnées + une fin de 7 s = 89 s pile (passe) ;
  // une image de fin en plus, non.
  const edge = (outro) => [...long(11.2).slice(0, 7), { file: '7.wav', seconds: outro }]
  assert.equal(narratedDuration(edge(7), FPS, FADE), 89 * FPS)
  assert.equal(fitsReel(edge(7), FPS, FADE), true)
  assert.equal(narratedDuration(edge(7.04), FPS, FADE), 89 * FPS + 1)
  assert.equal(fitsReel(edge(7.04), FPS, FADE), false)
})
