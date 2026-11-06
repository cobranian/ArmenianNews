// Le manifeste des Reels (src/data/reels.json) : `addReels` est pur et
// idempotent — relancer `npm run reels:add` n'ajoute rien — et refuse un
// `asset` qui ne serait pas `<lang>-<slug>.mp4`, le nom du fichier dans la
// release `reels-1` (un autre nom servirait un 404 à Facebook et Instagram).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addReels, assetName } from '../scripts/lib/reels-add.mjs'

const duduk = { slug: 'duduk', lang: 'fr', asset: 'fr-duduk.mp4', music: '♪ x' }

test('addReels : ajoute une entrée, puis rien la seconde fois', () => {
  const first = addReels({}, [duduk])
  assert.deepEqual(first.added, ['duduk/fr'])
  assert.deepEqual(first.reels, { duduk: { fr: { asset: 'fr-duduk.mp4', music: '♪ x' } } })
  const again = addReels(first.reels, [duduk])
  assert.deepEqual(again.added, [])
  assert.deepEqual(again.reels, first.reels)
})

test('addReels : ne mute pas l’entrée, ordre des clés stable', () => {
  const before = { komitas: { ru: { asset: 'ru-komitas.mp4', music: '♪ y' } } }
  const copy = structuredClone(before)
  const { reels } = addReels(before, [{ ...duduk, lang: 'hy', asset: 'hy-duduk.mp4' }, duduk])
  assert.deepEqual(before, copy)
  assert.deepEqual(Object.keys(reels), ['duduk', 'komitas'])
  assert.deepEqual(Object.keys(reels.duduk), ['fr', 'hy'])
})

test('addReels : une musique changée remplace l’entrée', () => {
  const { reels } = addReels({}, [duduk])
  const r = addReels(reels, [{ ...duduk, music: '♪ z' }])
  assert.deepEqual(r.added, ['duduk/fr'])
  assert.equal(r.reels.duduk.fr.music, '♪ z')
})

test('addReels : un asset mal nommé lève une erreur', () => {
  assert.throws(() => addReels({}, [{ ...duduk, asset: 'duduk.mp4' }]), /fr-duduk\.mp4/)
  assert.throws(() => addReels({}, [{ ...duduk, music: '' }]), /musique/)
  assert.equal(assetName('fr', 'duduk'), 'fr-duduk.mp4')
})
