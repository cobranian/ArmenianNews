import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hashId } from '../src/hashId.js'

// Une ancre indécodable (`#%`) ne doit jamais lever : decodeURIComponent,
// appelé nu dans un useEffect, faisait démonter toute la racine React — page
// blanche. hashId est le seul chemin : les trois lecteurs de l'ancre passent
// par lui, et aucun fichier de src/ ne décode plus location.hash à la main.

test('hashId : décode une ancre ordinaire', () => {
  assert.equal(hashId('#instagram'), 'instagram')
  assert.equal(hashId('#instagram-cr%C3%A9ation'), 'instagram-création')
  assert.equal(hashId('newsletter-email'), 'newsletter-email')
})

test('hashId : vide pour une ancre absente', () => {
  assert.equal(hashId(''), '')
  assert.equal(hashId('#'), '')
  assert.equal(hashId(undefined), '')
  assert.equal(hashId(null), '')
})

test('hashId : vide, sans lever, pour une séquence invalide', () => {
  for (const h of ['#%', '#%E9', '#%zz', '#abc%', '#%C3']) {
    assert.doesNotThrow(() => hashId(h), h)
    assert.equal(hashId(h), '', h)
  }
})

test('les trois lecteurs de l\'ancre passent par hashId', () => {
  for (const f of ['src/App.jsx', 'src/components/SocialSection.jsx', 'src/components/Social.jsx']) {
    const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8')
    assert.ok(src.includes('hashId(window.location.hash)'), f)
    assert.ok(!/decodeURIComponent\([^)]*location\.hash/.test(src), f + ' : décodage nu')
  }
})
