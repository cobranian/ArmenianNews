import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { makeImages, PAGE_WIDTH } from '../scripts/lib/culture-image.mjs'

const src = (w, h) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#c86a3a' } }).withIccProfile('p3').jpeg().toBuffer()

test('carte : JPEG 1200×630, sans profil ICC ; page : WebP ≤ 1200', async () => {
  const out = await makeImages(await src(2400, 1600))
  const card = await sharp(out.jpg).metadata()
  assert.equal(card.format, 'jpeg')
  assert.equal(card.width, 1200)
  assert.equal(card.height, 630)
  assert.equal(card.icc, undefined)
  const page = await sharp(out.webp).metadata()
  assert.equal(page.format, 'webp')
  assert.equal(page.width, PAGE_WIDTH)
  assert.equal(out.width, PAGE_WIDTH)
  assert.equal(out.height, 800)
})

test('petite image : la page ne s’agrandit pas, la carte garde 1200×630', async () => {
  const out = await makeImages(await src(900, 700))
  assert.equal(out.width, 900)
  const card = await sharp(out.jpg).metadata()
  assert.equal(card.width, 1200)
  assert.equal(card.height, 630)
})
