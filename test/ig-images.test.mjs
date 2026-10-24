// Le bundle n'embarque que les images Instagram du TIRAGE (instagram-feed.json),
// pas tout le pool : 3 734 fichiers, ~238 Mo par vitrine pour 90 tuiles
// affichées (25 octobre 2026). Sans réseau.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { IG_EXT, feedImageFiles, igImagesModule } from '../scripts/lib/ig-images.mjs'

const feed = {
  posts: [
    { url: 'https://www.instagram.com/p/AAA/' },
    { url: 'https://www.instagram.com/reel/BBB/?igsh=x' },
    { url: 'https://www.instagram.com/p/MANQUE/' },
  ],
}

test('feedImageFiles : seulement les fichiers des posts tirés, jpg ou webp', () => {
  const files = ['AAA.webp', 'BBB.jpg', 'CCC.webp', 'AAA.txt', 'ZZZ.jpg']
  assert.deepEqual(feedImageFiles(feed, files).sort(), ['AAA.webp', 'BBB.jpg'])
})

test('feedImageFiles : un tirage vide ou absent n’embarque rien', () => {
  assert.deepEqual(feedImageFiles({}, ['AAA.webp']), [])
  assert.deepEqual(feedImageFiles(null, ['AAA.webp']), [])
})

test('igImagesModule : un import ?url par fichier, exporté par shortcode', () => {
  const src = igImagesModule(['AAA.webp', 'BBB.jpg'], '/abs/src/data/ig')
  assert.match(src, /import i0 from "\/abs\/src\/data\/ig\/AAA\.webp\?url"/)
  assert.match(src, /import i1 from "\/abs\/src\/data\/ig\/BBB\.jpg\?url"/)
  assert.match(src, /export default \{"AAA":i0,"BBB":i1\}/)
  assert.equal(igImagesModule([], '/x').trim(), 'export default {}')
})

// jpg ET webp, définitivement (voir Social.jsx) : un .jpg survivant à une
// conversion incomplète doit encore s'afficher.
test('IG_EXT accepte jpg et webp', () => {
  assert.ok(IG_EXT.test('a.jpg') && IG_EXT.test('a.webp') && !IG_EXT.test('a.png'))
})

test('Social.jsx lit les images du tirage, plus le glob du pool entier', async () => {
  const src = await readFile(new URL('../src/components/Social.jsx', import.meta.url), 'utf-8')
  assert.doesNotMatch(src, /glob\(['"]\.\.\/data\/ig\//, 'le glob du pool entier est revenu')
  assert.match(src, /from 'virtual:ig-images'/)
  const vite = await readFile(new URL('../vite.config.js', import.meta.url), 'utf-8')
  assert.match(vite, /igFeedImages\(\)/, 'le plugin n’est plus branché dans vite.config.js')
})
