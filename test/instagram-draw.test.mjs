import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawGroup } from '../scripts/sources/instagram.mjs'

// Un compte synthetique : `n` posts, shortcodes prefixes par le handle.
const compte = (handle, n, prefixe = handle) => ({
  handle,
  name: handle,
  group: 'createurs',
  posts: Array.from({ length: n }, (_, i) => ({
    url: `https://www.instagram.com/p/${prefixe}${i}/`,
    date: '2026-08-01T00:00:00.000Z',
  })),
})

// LE MODE DE PANNE QUE CE FICHIER EXISTE POUR ATTRAPER. Un melange a plat de
// la reserve du brin donne les tuiles a proportion des posts : le catalogue
// Simonian prendrait ~16 tuiles sur 18 et les trois autres comptes ~1 chacun.
// Rien ne tomberait — le brin serait juste devenu le mur d'un seul compte.
test('un gros catalogue ne chasse pas ses voisins du brin', () => {
  const posts = drawGroup(
    [compte('simonian_jewels', 200), compte('a', 9), compte('b', 9), compte('c', 9)],
    18,
    new Set(),
  )
  assert.equal(posts.length, 18)
  const par = {}
  for (const p of posts) par[p.handle] = (par[p.handle] || 0) + 1
  assert.equal(par.simonian_jewels, 5, 'le gros compte doit avoir 5 tuiles, pas 16')
  for (const h of ['a', 'b', 'c']) {
    assert.ok(par[h] >= 4, `@${h} n a que ${par[h]} tuiles — il est chasse du brin`)
  }
})

test('un brin plus petit que la limite rend tout ce qu il a, sans boucler', () => {
  const posts = drawGroup([compte('a', 3), compte('b', 2)], 18, new Set())
  assert.equal(posts.length, 5)
})

// Un post COLLAB vit sur les deux grilles sous le MEME shortcode : le carrousel
// l afficherait a cote de lui-meme. C est le role d origine de `seen`.
test('un post partage par deux comptes ne sort qu une fois', () => {
  const posts = drawGroup([compte('a', 4, 'X'), compte('b', 4, 'X')], 18, new Set())
  const codes = posts.map((p) => p.url)
  assert.equal(new Set(codes).size, codes.length, 'un shortcode sort deux fois')
  assert.equal(posts.length, 4)
})

// `seen` est partage entre les groupes par selectInstagram : ce qu un brin a
// deja servi ne doit pas ressortir dans le suivant.
test('seen est respecte et mute', () => {
  const seen = new Set(['a0'])
  const posts = drawGroup([compte('a', 3)], 18, seen)
  assert.equal(posts.length, 2)
  assert.ok(seen.has('a1') && seen.has('a2'), 'drawGroup doit alimenter seen')
})

test('chaque post porte son compte, son nom et son groupe', () => {
  const [p] = drawGroup([compte('a', 1)], 18, new Set())
  assert.deepEqual(
    { handle: p.handle, name: p.name, group: p.group, date: p.date },
    { handle: 'a', name: 'a', group: 'createurs', date: '2026-08-01T00:00:00.000Z' },
  )
})

test('un compte sans group tombe dans institutions', () => {
  const acc = compte('a', 1)
  delete acc.group
  const [p] = drawGroup([acc], 18, new Set())
  assert.equal(p.group, 'institutions')
})
