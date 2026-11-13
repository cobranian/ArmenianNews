// Les calculs du zoom de la visionneuse (src/zoomMath.js) : bornes de
// l'échelle, bornes du déplacement, et le point sous les doigts qui reste
// fixe quand on pince. Le geste lui-même (ZoomView.jsx) ne fait qu'appeler
// ces fonctions : si elles sont justes, l'image ne peut ni sortir de
// l'écran ni « sauter » sous le pouce.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MIN_SCALE,
  MAX_SCALE,
  DOUBLE_TAP_SCALE,
  clampScale,
  clampPan,
  zoomAt,
  toggleZoom,
} from '../src/zoomMath.js'

const box = { vw: 400, vh: 800, iw: 400, ih: 560 }

test('les constantes de la spec', () => {
  assert.equal(MIN_SCALE, 1)
  assert.equal(MAX_SCALE, 4)
  assert.equal(DOUBLE_TAP_SCALE, 2.5)
})

test("clampScale borne l'échelle entre 1 et 4", () => {
  assert.equal(clampScale(0.5), 1)
  assert.equal(clampScale(5), 4)
  assert.equal(clampScale(2), 2)
})

test("clampPan retient l'image dans l'écran", () => {
  assert.deepEqual(clampPan({ x: 500, y: -500, scale: 2 }, box), { x: 200, y: -160, scale: 2 })
  assert.deepEqual(clampPan({ x: 50, y: 30, scale: 1 }, box), { x: 0, y: 0, scale: 1 })
})

test('clampPan sur une image paysage', () => {
  const paysage = { vw: 400, vh: 800, iw: 400, ih: 250 }
  assert.equal(clampPan({ x: 0, y: 300, scale: 4 }, paysage).y, 100)
})

test('zoomAt garde fixe le point sous les doigts', () => {
  assert.deepEqual(zoomAt({ x: 0, y: 0, scale: 1 }, 2, 100, 0, box), { x: -100, y: 0, scale: 2 })
  assert.equal(zoomAt({ x: 0, y: 0, scale: 1 }, 9, 0, 0, box).scale, 4)
})

test('toggleZoom bascule entre 1 et 2,5', () => {
  assert.deepEqual(toggleZoom({ x: -100, y: 0, scale: 2 }, 0, 0, box), { x: 0, y: 0, scale: 1 })
  assert.deepEqual(toggleZoom({ x: 0, y: 0, scale: 1 }, 0, 0, box), { x: 0, y: 0, scale: 2.5 })
})
