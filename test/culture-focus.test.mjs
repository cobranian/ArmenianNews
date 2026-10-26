import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { focusY, objectPosition, PORTRAIT_FOCUS_Y } from '../scripts/lib/culture-focus.mjs'
import { makeImages } from '../scripts/lib/culture-image.mjs'
import { teaserFor } from '../scripts/lib/culture-links.mjs'

test('focusY : explicite, sinon le haut pour une image haute, sinon centre', () => {
  assert.equal(focusY({ width: 1200, height: 1397, focusY: 0.05 }), 0.05)
  assert.equal(focusY({ width: 1200, height: 2133 }), PORTRAIT_FOCUS_Y)
  assert.equal(focusY({ width: 1200, height: 800 }), null)
  assert.equal(focusY({ width: 1200, height: 800, focusY: 2 }), null, 'hors de [0, 1] : ignoré')
  assert.equal(focusY(null), null)
  assert.equal(objectPosition(0.15), '50% 15%')
  assert.equal(objectPosition(null), null)
})

// Une image haute : bande ROUGE en haut (la « tête »), VERTE en bas (le
// « socle »). Rognée au centre ou par 'attention', la carte perdait le rouge.
async function portrait() {
  const red = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#ff0000' } }).png().toBuffer()
  return sharp({ create: { width: 600, height: 1200, channels: 3, background: '#00ff00' } })
    .composite([{ input: red, top: 0, left: 0 }])
    .png()
    .toBuffer()
}

test('makeImages : la carte d’une image haute garde le haut', async () => {
  const { jpg } = await makeImages(await portrait())
  const { data, info } = await sharp(jpg).raw().toBuffer({ resolveWithObject: true })
  assert.deepEqual([info.width, info.height], [1200, 630])
  const px = (y) => [...data.subarray((y * info.width + 600) * 3, (y * info.width + 600) * 3 + 3)]
  const top = px(5)
  assert.ok(top[0] > 200 && top[1] < 60, `haut de la carte : ${top}`)
})

test('le carrousel reçoit le cadrage de chaque article', () => {
  const article = (slug, image) => ({ slug, date: '2026-10-26', image, langs: { fr: { title: 't', description: 'd' } } })
  const out = teaserFor([article('a', { width: 1200, height: 1397, focusY: 0.05 }), article('b', { width: 1200, height: 800 })], ['fr'])
  assert.equal(out.fr[0].focus, 0.05)
  assert.equal(out.fr[1].focus, null)
})
