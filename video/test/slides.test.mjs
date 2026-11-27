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
