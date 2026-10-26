import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { SHARE_NETWORKS, SHARE_ICONS, SHARE_NAMES, SHARE_STRINGS, shareHref } from '../src/share.js'
import { ALL_LANGS } from '../sites.config.js'

test('chaque réseau a son nom et son icône ; Instagram seul n’a pas d’adresse', () => {
  for (const n of SHARE_NETWORKS) {
    assert.ok(SHARE_NAMES[n], n)
    assert.match(SHARE_ICONS[n], /^M[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]+$/, n)
    const href = shareHref(n, { url: 'https://armenieinfo.ch/culture/x/', title: 'Titre & co' })
    if (n === 'instagram') assert.equal(href, null)
    else assert.match(href, /^https:\/\//)
  }
})

test('les paramètres sont encodés (titre et URL)', () => {
  const href = shareHref('whatsapp', { url: 'https://a.b/c/?d=1', title: 'É & co' })
  assert.equal(href, 'https://wa.me/?text=%C3%89%20%26%20co%20https%3A%2F%2Fa.b%2Fc%2F%3Fd%3D1')
})

// Une langue sans textes afficherait « undefined » sous chaque article.
test('les textes de partage existent dans les six langues', () => {
  for (const l of ALL_LANGS) {
    const s = SHARE_STRINGS[l]
    assert.ok(s?.share && s.copied && s.on('X').includes('X'), l)
  }
})

test('le script du bouton Instagram est servi depuis public/', () => {
  assert.ok(existsSync(new URL('../public/share.js', import.meta.url)))
})
