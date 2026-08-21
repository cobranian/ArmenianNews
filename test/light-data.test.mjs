import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { accountsOnly, newsForLangs } from '../scripts/lib/light-data.mjs'

// Les deux allègements que le plugin `lightData()` (vite.config.js) applique au
// build : le pool Instagram sans ses posts, news.json sans les langues que la
// vitrine ne sert pas. Mesuré le 21 août 2026 : 1,45 Mo de bundle brut dont
// ~1,1 Mo de JSON que la page n'utilisait pas.

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8')

test('accountsOnly : les comptes gardent tout sauf leurs posts', () => {
  const pool = {
    exclude: ['abc'],
    accounts: [
      { handle: 'a', name: 'A', url: 'https://instagram.com/a', group: 'terre', count: 60, posts: [{ url: 'x', date: 'y' }] },
      { handle: 'b', name: 'B', url: 'https://instagram.com/b', posts: [] },
    ],
  }
  assert.deepEqual(accountsOnly(pool), {
    accounts: [
      { handle: 'a', name: 'A', url: 'https://instagram.com/a', group: 'terre', count: 60 },
      { handle: 'b', name: 'B', url: 'https://instagram.com/b' },
    ],
  })
})

const TAB = { fr: ['armenpress', 'courrier'], en: ['armenpress', 'armenianweekly'], hy: ['armenpress'], ru: ['armenpress'] }
const NEWS = {
  generatedAt: '2026-08-21T21:00:00.000Z',
  armenpress: { fr: [1], en: [2], hy: [3], ru: [4] },
  courrier: [5],
  armenianweekly: [6],
  asbarez: { en: [7], hy: [8] },
}

test('newsForLangs : le .ch ne garde que le français', () => {
  assert.deepEqual(newsForLangs(NEWS, ['fr'], TAB), {
    generatedAt: '2026-08-21T21:00:00.000Z',
    armenpress: { fr: [1] },
    courrier: [5],
  })
})

test('newsForLangs : le .org garde en/hy/ru, jamais le français', () => {
  assert.deepEqual(newsForLangs(NEWS, ['en', 'hy', 'ru'], TAB), {
    generatedAt: '2026-08-21T21:00:00.000Z',
    armenpress: { en: [2], hy: [3], ru: [4] },
    armenianweekly: [6],
    asbarez: { en: [7], hy: [8] },
  })
})

test('newsForLangs : une source sans langue servie disparaît, les autres sont intactes', () => {
  const out = newsForLangs(NEWS, ['ru'], TAB)
  assert.equal(out.asbarez, undefined)
  assert.equal(out.courrier, undefined)
  assert.deepEqual(out.armenpress, { ru: [4] })
  // La source d'origine n'est pas mutée.
  assert.deepEqual(Object.keys(NEWS.armenpress), ['fr', 'en', 'hy', 'ru'])
})

test('le plugin lightData est branché dans vite.config.js sur les deux fichiers', () => {
  // Lu comme du texte (vite.config.js importe des plugins Vite). Le jour où
  // l'un des deux imports cesse d'être intercepté, le bundle regrossit d'un
  // demi-mégaoctet sans qu'aucun contrôle ne tombe : c'est ce test qui le dit.
  const src = lire('../vite.config.js')
  assert.match(src, /lightData\(\)/)
  assert.match(src, /newsForLangs\(/)
  assert.match(src, /accountsOnly\(/)
  assert.match(src, /plugins:\s*\[[^\]]*lightData\(\)/)
})
