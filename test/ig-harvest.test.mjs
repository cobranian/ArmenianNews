import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_COUNT,
  MAX_COUNT,
  MAX_PAGE,
  keepable,
  pageCount,
  pickImage,
  shortcodeOf,
  stopPaging,
  wantedFor,
} from '../scripts/lib/ig-harvest.mjs'

// Instagram liste ses formats du plus grand au plus petit. Le script prenait
// systematiquement candidates[0] — ~1080px, 229 Ko de moyenne mesures sur les
// 218 images du depot — pour des tuiles rendues autour de 300px.
const CANDIDATS = [
  { url: 'w1080', width: 1080 },
  { url: 'w750', width: 750 },
  { url: 'w640', width: 640 },
  { url: 'w320', width: 320 },
]

test('pickImage prend le plus petit format d au moins 640px', () => {
  assert.equal(pickImage(CANDIDATS), 'w640')
})

test('pickImage ignore l ordre du tableau', () => {
  assert.equal(pickImage([...CANDIDATS].reverse()), 'w640')
})

// Un post ne doit JAMAIS perdre son image sur une regle de taille : sans image
// la tuile retombe sur son motif armenien, ce qui se lit comme une panne.
test('pickImage retombe sur le plus grand si aucun n atteint 640px', () => {
  assert.equal(pickImage([{ url: 'w320', width: 320 }, { url: 'w150', width: 150 }]), 'w320')
})

test('pickImage rend null sans candidat exploitable', () => {
  assert.equal(pickImage([]), null)
  assert.equal(pickImage(undefined), null)
  assert.equal(pickImage([{ width: 1080 }]), null)
})

test('wantedFor vaut 9 par defaut', () => {
  assert.equal(wantedFor({}), DEFAULT_COUNT)
  assert.equal(wantedFor({ handle: 'a' }), 9)
})

test('wantedFor honore un entier', () => {
  assert.equal(wantedFor({ count: 24 }), 24)
})

test('wantedFor traduit all par le plafond dur', () => {
  assert.equal(wantedFor({ count: 'all' }), MAX_COUNT)
  assert.equal(MAX_COUNT, 500)
})

// Une valeur absurde ne doit pas se traduire par une recolte absurde.
test('wantedFor refuse une valeur invalide et retombe sur le defaut', () => {
  for (const v of [0, -3, 1.5, 'beaucoup', null]) {
    assert.equal(wantedFor({ count: v }), DEFAULT_COUNT, `count: ${JSON.stringify(v)}`)
  }
})

test('wantedFor plafonne un entier trop grand', () => {
  assert.equal(wantedFor({ count: 5000 }), MAX_COUNT)
})

// LE PIEGE QUE CE TEST GARDE. La requete demandait 12 posts en dur. Avec 15
// exclus parmi les plus recents, une page de 12 en laisse ZERO — et
// `if (!posts.length) throw` classerait le compte en echec reseau. La page doit
// demander ce qu on veut vraiment.
test('pageCount couvre le pire cas, tous les exclus en tete', () => {
  assert.equal(pageCount(9, 15), 24)
  assert.equal(pageCount(9, 0), 9)
})

test('pageCount reste sous le plafond de politesse de l endpoint', () => {
  assert.equal(pageCount(500, 15), MAX_PAGE)
  assert.equal(MAX_PAGE, 50)
})

test('shortcodeOf lit les trois formes d URL et ignore la query', () => {
  assert.equal(shortcodeOf('https://www.instagram.com/p/ABC123/'), 'ABC123')
  assert.equal(shortcodeOf('https://www.instagram.com/reel/ABC123/'), 'ABC123')
  assert.equal(shortcodeOf('https://www.instagram.com/tv/ABC123/'), 'ABC123')
  assert.equal(shortcodeOf('https://www.instagram.com/p/ABC123/?img_index=1'), 'ABC123')
  assert.equal(shortcodeOf('https://www.instagram.com/naregjewelry/'), null)
})

test('keepable retire les posts exclus et garde l ordre', () => {
  const items = [{ shortcode: 'a' }, { shortcode: 'b' }, { shortcode: 'c' }]
  assert.deepEqual(keepable(items, new Set(['b'])), [{ shortcode: 'a' }, { shortcode: 'c' }])
  assert.deepEqual(keepable(items, new Set()), items)
})

test('stopPaging s arrete quand on a ce qu on voulait', () => {
  assert.equal(stopPaging({ kept: 9, want: 9, freshRaw: 12, cursor: 'x' }), true)
})

test('stopPaging s arrete a la fin du catalogue', () => {
  assert.equal(stopPaging({ kept: 3, want: 9, freshRaw: 12, cursor: null }), true)
})

// Le curseur reboucle sur des posts deja vus : sans cette sortie, la boucle
// tournerait indefiniment.
test('stopPaging s arrete quand la page ne rend que du deja-vu', () => {
  assert.equal(stopPaging({ kept: 3, want: 9, freshRaw: 0, cursor: 'x' }), true)
})

// LE CAS QUE CE TEST EXISTE POUR ATTRAPER. Une page de posts NEUFS mais tous
// exclus ne garde rien — et c'est pourtant une vraie progression : les posts
// valides sont a la page suivante. Mesurer la progression sur ce qui est retenu
// tronquerait la recolte en silence, avec le symptome d un compte peu actif.
test('stopPaging poursuit sur une page entierement exclue', () => {
  assert.equal(stopPaging({ kept: 0, want: 9, freshRaw: 24, cursor: 'x' }), false)
})
