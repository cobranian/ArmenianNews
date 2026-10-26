import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITES } from '../sites.config.js'
import { headFor } from '../scripts/lib/site-meta.mjs'

// Chaque vitrine renvoie à SES comptes : un .ch qui pointerait vers les
// comptes anglais (ou l'inverse) passerait tous les contrôles sans bruit.
test('chaque vitrine déclare ses propres comptes Facebook et Instagram', () => {
  const seen = new Set()
  for (const site of Object.values(SITES)) {
    assert.ok(site.social, `${site.id} : social absent`)
    assert.match(site.social.facebook, /^https:\/\/www\.facebook\.com\/\d+$/)
    assert.match(site.social.instagram, /^https:\/\/www\.instagram\.com\/[a-z0-9_.]+\/$/)
    for (const url of Object.values(site.social)) {
      assert.ok(!seen.has(url), `${url} partagé entre deux vitrines`)
      seen.add(url)
    }
  }
})

test('le JSON-LD Organization cite les comptes de sa vitrine, pas ceux du voisin', () => {
  for (const site of Object.values(SITES)) {
    const head = headFor({ siteId: site.id, lang: site.pages[0].lang })
    for (const url of Object.values(site.social)) assert.ok(head.includes(url), `${site.id} : ${url} absent`)
    for (const other of Object.values(SITES).filter((s) => s.id !== site.id)) {
      for (const url of Object.values(other.social)) assert.ok(!head.includes(url), `${site.id} cite ${url}`)
    }
  }
})

test('le pied de page rend les liens sociaux depuis sites.config.js', () => {
  const src = readFileSync(new URL('../src/components/Footer.jsx', import.meta.url), 'utf-8')
  assert.match(src, /SITES\[SITE_ID\]\?\.social/)
  assert.match(src, /aria-label=\{SOCIAL_NAMES\[platform\]\}/)
})
