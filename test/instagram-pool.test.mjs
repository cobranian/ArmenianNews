import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { shortcodeOf, wantedFor, MAX_COUNT } from '../scripts/lib/ig-harvest.mjs'

const pool = JSON.parse(
  await readFile(new URL('../src/data/instagram.json', import.meta.url), 'utf-8'),
)
const exclus = new Set(pool.exclude || [])
const tousLesPosts = pool.accounts.flatMap((a) =>
  (a.posts || []).map((p) => ({ handle: a.handle, code: shortcodeOf(p.url), url: p.url })),
)

test('la liste d exclusion est presente et bien formee', () => {
  assert.ok(Array.isArray(pool.exclude), 'pool.exclude doit etre un tableau')
  assert.equal(pool.exclude.length, exclus.size, 'la liste porte un doublon')
  for (const code of pool.exclude) {
    assert.match(code, /^[\w-]+$/, `shortcode invalide : ${JSON.stringify(code)}`)
  }
})

// LE MODE DE PANNE QUE CE FICHIER EXISTE POUR ATTRAPER. Le site ne relit jamais
// `exclude` — ni selectInstagram, ni Social.jsx — parce qu un filtre ecrit a
// deux endroits finit par diverger. C est donc le SEUL endroit d ou l exclusion
// peut etre verifiee. Une regression de ig-scrape, une edition a la main, ou un
// post exclu qui revient par une autre grille (COLLAB) passeraient sinon
// inapercus : ils produiraient un pool valide, un build vert, et une tuile que
// personne ne voulait.
test('aucun post exclu n est entre dans le pool', () => {
  for (const p of tousLesPosts) {
    assert.ok(!exclus.has(p.code), `@${p.handle} sert ${p.code}, qui est exclu`)
  }
})

test('aucune image d un post exclu ne traine dans src/data/ig', async () => {
  const fichiers = await readdir(new URL('../src/data/ig/', import.meta.url))
  for (const f of fichiers.filter((x) => x.endsWith('.jpg'))) {
    const code = f.replace(/\.jpg$/, '')
    assert.ok(!exclus.has(code), `${f} appartient a un post exclu — poids mort dans le bundle`)
  }
})

test('chaque post porte une URL dont on sait tirer un shortcode', () => {
  for (const p of tousLesPosts) {
    assert.ok(p.code, `URL illisible : ${p.url} (@${p.handle})`)
  }
})

test('les reglages count sont bien formes', () => {
  for (const acc of pool.accounts) {
    if (!('count' in acc)) continue
    assert.ok(
      acc.count === 'all' || (Number.isInteger(acc.count) && acc.count > 0),
      `@${acc.handle} porte count: ${JSON.stringify(acc.count)} — attendu un entier positif ou 'all'`,
    )
    assert.ok(wantedFor(acc) <= MAX_COUNT)
  }
})

test('les quatre comptes du brin createurs sont la', () => {
  const brin = pool.accounts.filter((a) => a.group === 'createurs').map((a) => a.handle).sort()
  assert.deepEqual(brin, [
    'armenian_women_artists',
    'armeniancreators',
    'naregjewelry',
    'simonian_jewels',
  ])
})

test('simonian_jewels recolte tout son catalogue', () => {
  const acc = pool.accounts.find((a) => a.handle === 'simonian_jewels')
  assert.equal(acc.count, 'all')
})

test('maisonlumiere_geneva est dans Ateliers', () => {
  const acc = pool.accounts.find((a) => a.handle === 'maisonlumiere_geneva')
  assert.equal(acc.group, 'creation')
})

test('chaque compte porte handle, name et url', () => {
  for (const acc of pool.accounts) {
    for (const champ of ['handle', 'name', 'url']) {
      assert.ok(acc[champ], `un compte n a pas de ${champ} : ${JSON.stringify(acc.handle)}`)
    }
    // Un identifiant Instagram ne peut pas contenir de tiret : un handle mal
    // saisi renvoie un 404 et fait echouer le compte, sans autre signe.
    assert.match(acc.handle, /^[\w.]+$/, `handle invalide : ${acc.handle}`)
  }
})
