// Garde : une image par fait dans un Short (spec 2026-11-27). Moins d'images
// que de faits : elles tournent, jamais deux fois la même de suite ; une
// seule : le Short d'avant, inchangé. Une image en portrait est cadrée vers
// le haut (une planche 920×540 en `cover` centré coupait les têtes).
import test from 'node:test'
import assert from 'node:assert/strict'
import { slideImages, slideFocus } from '../src/shorts/slides.mjs'

test('slideImages : 7 images pour 7 faits, une chacun', () => {
  assert.deepEqual(slideImages(7, 7), [0, 1, 2, 3, 4, 5, 6])
})

test('slideImages : 3 images tournent, 1 image reste seule', () => {
  assert.deepEqual(slideImages(7, 3), [0, 1, 2, 0, 1, 2, 0])
  assert.deepEqual(slideImages(7, 1), [0, 0, 0, 0, 0, 0, 0])
})

test('slideImages : jamais deux fois la même image de suite (2 à 7 images)', () => {
  for (let n = 2; n <= 7; n++) {
    const s = slideImages(7, n)
    for (let i = 1; i < s.length; i++) assert.notEqual(s[i], s[i - 1], `${n} images, scène ${i}`)
  }
})

test('slideFocus : portrait cadré en haut, paysage inchangé, focus du fait prioritaire', () => {
  assert.equal(slideFocus({ width: 1024, height: 1227 }, undefined), '50% 20%')
  assert.equal(slideFocus({ width: 1200, height: 630 }, undefined), undefined)
  assert.equal(slideFocus({}, undefined), undefined)
  assert.equal(slideFocus({ width: 1024, height: 1227 }, '30% 60%'), '30% 60%')
})

// Retour de Nareg sur l'essai Gorky (27 nov.) : cadre trop petit, image
// recadrée, bas de l'écran vide. Le cadre épouse désormais l'image, entière,
// centrée dans une zone de 1000×740 ; le texte descend sous la zone.
import { frameBox, FRAME_ZONE, TEXT_TOP } from '../src/shorts/slides.mjs'

test('frameBox : paysage → toute la largeur, centré verticalement', () => {
  const b = frameBox({ width: 1200, height: 630 })
  assert.equal(b.width, FRAME_ZONE.width)
  assert.equal(b.height, Math.round(1000 / (1200 / 630)))
  assert.equal(b.left, FRAME_ZONE.left)
  assert.equal(b.top, FRAME_ZONE.top + Math.round((FRAME_ZONE.height - b.height) / 2))
})

test('frameBox : portrait → toute la hauteur, centré horizontalement, jamais coupé', () => {
  const b = frameBox({ width: 1024, height: 1227 })
  assert.equal(b.height, FRAME_ZONE.height)
  assert.equal(b.width, Math.round(740 * (1024 / 1227)))
  assert.equal(b.left, FRAME_ZONE.left + Math.round((FRAME_ZONE.width - b.width) / 2))
  assert.equal(b.top, FRAME_ZONE.top)
})

test('frameBox : taille inconnue → la zone entière ; le texte commence sous la zone', () => {
  assert.deepEqual(frameBox({}), { ...FRAME_ZONE })
  assert.ok(TEXT_TOP > FRAME_ZONE.top + FRAME_ZONE.height)
  // Centré dans l'image 1080 de large.
  assert.equal(FRAME_ZONE.left * 2 + FRAME_ZONE.width, 1080)
})
