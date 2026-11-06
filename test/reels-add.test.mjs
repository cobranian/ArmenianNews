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

// --force : un Short re-rendu à musique inchangée a le même manifeste, mais
// son MP4 doit repartir dans la release (--clobber).
import { toUpload } from '../scripts/lib/reels-add.mjs'

test('toUpload : sans --force, seul ce que le manifeste change repart', () => {
  const found = [duduk, { slug: 'komitas', lang: 'fr', asset: 'fr-komitas.mp4', music: '♪ y' }]
  const { reels, added } = addReels({ duduk: { fr: { asset: 'fr-duduk.mp4', music: '♪ x' } } }, found)
  assert.deepEqual(toUpload(found, added, false).map((f) => f.slug), ['komitas'])
  assert.deepEqual(toUpload(found, added, true).map((f) => f.slug), ['duduk', 'komitas'])
  assert.ok(reels.duduk.fr)
})

// Une faute de frappe à la main dans le manifeste arrêterait toute la
// publication : on le lit tel qu'il est dans le dépôt.
import { readFileSync } from 'node:fs'

test('src/data/reels.json : asset = <lang>-<slug>.mp4 et musique non vide', () => {
  const reels = JSON.parse(readFileSync(new URL('../src/data/reels.json', import.meta.url), 'utf8'))
  for (const [slug, langs] of Object.entries(reels))
    for (const [lang, e] of Object.entries(langs)) {
      assert.equal(e.asset, `${lang}-${slug}.mp4`, `${slug}/${lang}`)
      assert.ok(typeof e.music === 'string' && e.music.trim(), `${slug}/${lang} : musique`)
    }
})
