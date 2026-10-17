import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mirrorImages, mirrorName, pruneMirror } from '../scripts/lib/mirror-images.mjs'

const quiet = { warn() {} }
const encode = async (buf) => Buffer.concat([Buffer.from('webp:'), buf])
const tmp = () => mkdtempSync(join(tmpdir(), 'mirror-'))

test('nom stable, propre a chaque URL', () => {
  assert.equal(mirrorName('https://x/a.png'), mirrorName('https://x/a.png'))
  assert.notEqual(mirrorName('https://x/a.png'), mirrorName('https://x/b.png'))
  assert.match(mirrorName('https://x/a.png'), /^[0-9a-f]{16}\.webp$/)
})

test('recopie, reecrit l URL, ne retelecharge pas un fichier present', async () => {
  const dir = tmp()
  let calls = 0
  const fetchImg = async () => (calls++, Buffer.from('img'))
  const arts = [{ url: 'u1', image: 'https://cc/a.png' }, { url: 'u2', image: 'https://cc/a.png' }]
  const r = await mirrorImages(arts, { dir, prefix: '/cc/', encode, fetchImg, log: quiet })
  assert.equal(calls, 1)
  assert.deepEqual(r, { copied: 1, failed: 0 })
  assert.equal(arts[0].image, `/cc/${mirrorName('https://cc/a.png')}`)
  assert.equal(arts[1].image, arts[0].image)
})

// Le defi Cloudflare : l URL distante ne s affiche chez personne, donc null
// (la carte prend son motif), jamais l URL d origine.
test('un echec met image a null, une image deja locale reste', async () => {
  const dir = tmp()
  const fetchImg = async () => { throw new Error('HTTP 403') }
  const arts = [{ image: 'https://cc/b.png' }, { image: '/cc/deja.webp' }, { image: null }]
  const r = await mirrorImages(arts, { dir, prefix: '/cc/', encode, fetchImg, log: quiet })
  assert.deepEqual(r, { copied: 0, failed: 1 })
  assert.deepEqual(arts.map((a) => a.image), [null, '/cc/deja.webp', null])
})

test('le menage garde les fichiers references, retire les autres', () => {
  const dir = tmp()
  for (const f of ['garde.webp', 'vieux.webp']) writeFileSync(join(dir, f), 'x')
  const n = pruneMirror([{ image: '/cc/garde.webp' }, { image: 'https://ailleurs/z.png' }, {}], { dir, prefix: '/cc/' })
  assert.equal(n, 1)
  assert.deepEqual(readdirSync(dir), ['garde.webp'])
  assert.equal(pruneMirror([], { dir: join(dir, 'absent'), prefix: '/cc/' }), 0)
  assert.ok(existsSync(join(dir, 'garde.webp')))
})
