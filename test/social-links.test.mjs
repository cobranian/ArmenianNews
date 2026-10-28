import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITES } from '../sites.config.js'
import { headFor } from '../scripts/lib/site-meta.mjs'

// Chaque vitrine renvoie à SES comptes : un .ch qui pointerait vers les
// comptes anglais (ou l'inverse) passerait tous les contrôles sans bruit.
test('chaque vitrine déclare ses propres comptes', () => {
  const seen = new Set()
  for (const site of Object.values(SITES)) {
    assert.ok(site.social, `${site.id} : social absent`)
    assert.match(site.social.facebook, /^https:\/\/www\.facebook\.com\/\d+$/)
    assert.match(site.social.instagram, /^https:\/\/www\.instagram\.com\/[a-z0-9_.]+\/$/)
    assert.match(site.social.bluesky, /^https:\/\/bsky\.app\/profile\/[a-z0-9.-]+$/)
    assert.match(site.social.telegram, /^https:\/\/t\.me\/[a-z0-9_]+$/)
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

// Une plateforme ajoutée à sites.config.js sans icône rendrait un rond vide,
// et sans nom un lien sans libellé pour les lecteurs d'écran — sans bruit.
test('toute plateforme déclarée a une icône et un nom dans SocialLinks', () => {
  const src = readFileSync(new URL('../src/components/SocialLinks.jsx', import.meta.url), 'utf-8')
  const platforms = new Set(Object.values(SITES).flatMap((s) => Object.keys(s.social)))
  for (const p of platforms) {
    assert.match(src, new RegExp(`^  ${p}: \\(`, 'm'), `icône ${p} absente`)
    assert.match(src, new RegExp(`${p}: '[A-Z]`), `nom ${p} absent`)
  }
})

test('le pied de page rend les comptes depuis sites.config.js, la barre du haut non', () => {
  const read = (f) => readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf-8')
  const src = read('SocialLinks.jsx')
  assert.match(src, /SITES\[SITE_ID\]\?\.social/)
  assert.match(src, /aria-label=\{NAMES\[platform\]\}/)
  assert.match(read('Footer.jsx'), /<SocialLinks className="footer__social"/)
  // Essayés dans la barre du haut le 26 oct. 2026, retirés le soir même à la
  // demande de l'éditeur : ils ne vivent qu'au pied de page.
  assert.doesNotMatch(read('Nav.jsx'), /SocialLinks/)
})
