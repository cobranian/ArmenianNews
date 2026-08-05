import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {
  TARGET_QUALITY,
  TARGET_WIDTH,
  encode,
  targetWidth,
} from '../scripts/lib/image.mjs'

test('les constantes portent la cible retenue', () => {
  assert.equal(TARGET_WIDTH, 800)
  assert.equal(TARGET_QUALITY, 78)
})

test('targetWidth n agrandit jamais', () => {
  assert.equal(targetWidth(500), 500)
  assert.equal(targetWidth(500, 800), 500)
  assert.equal(targetWidth(799), 799)
})

test('targetWidth plafonne au maximum demande', () => {
  assert.equal(targetWidth(1080), 800)
  assert.equal(targetWidth(1440, 640), 640)
})

// Une largeur illisible retombe sur le maximum plutot que sur zero : sharp
// traite width: 0 comme une erreur, et une image absente se lirait comme une
// panne reseau alors que c est un en-tete qu on n a pas su lire.
test('targetWidth retombe sur le maximum si la largeur est illisible', () => {
  assert.equal(targetWidth(undefined), 800)
  assert.equal(targetWidth(0), 800)
  assert.equal(targetWidth(NaN), 800)
  assert.equal(targetWidth(-10), 800)
})

// Image de synthese : ce test ne lit aucun fichier du depot et ne touche pas au
// reseau, comme ig-harvest.test.mjs.
const carre = (w, h) =>
  sharp({
    create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .jpeg()
    .toBuffer()

test('encode rend du WebP', async () => {
  const out = await encode(await carre(1200, 1500))
  assert.equal((await sharp(out).metadata()).format, 'webp')
})

test('encode reduit une image trop large et garde le rapport', async () => {
  const meta = await sharp(await encode(await carre(1200, 1500))).metadata()
  assert.equal(meta.width, 800)
  assert.equal(meta.height, 1000)
})

test('encode laisse une image deja petite a sa taille', async () => {
  const meta = await sharp(await encode(await carre(500, 620))).metadata()
  assert.equal(meta.width, 500)
  assert.equal(meta.height, 620)
})

test('encode accepte une largeur cible differente', async () => {
  const meta = await sharp(await encode(await carre(1200, 1200), { width: 640 })).metadata()
  assert.equal(meta.width, 640)
})

// Le script de migration doit pouvoir tourner une seconde fois sur son propre
// resultat : ecrit pour les seuls JPEG, il ne ferait rien apres la migration.
test('encode accepte du WebP en entree', async () => {
  const webp = await encode(await carre(1200, 1200))
  const meta = await sharp(await encode(webp, { width: 640 })).metadata()
  assert.equal(meta.format, 'webp')
  assert.equal(meta.width, 640)
})
