import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITES, socialFor } from '../sites.config.js'
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
    assert.match(site.social.linkedin, /^https:\/\/www\.linkedin\.com\/company\/[a-z0-9-]+\/$/)
    // Facultatif : le .org n'a pas encore de chaîne.
    if (site.social.youtube) assert.match(site.social.youtube, /^https:\/\/www\.youtube\.com\/@[a-z0-9-]+$/)
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
  assert.match(src, /socialFor\(SITE_ID, lang\)/)
  assert.match(src, /aria-label=\{NAMES\[platform\]\}/)
  assert.match(read('Footer.jsx'), /<SocialLinks className="footer__social"/)
  // Essayés dans la barre du haut le 26 oct. 2026, retirés le soir même à la
  // demande de l'éditeur : ils ne vivent qu'au pied de page.
  assert.doesNotMatch(read('Nav.jsx'), /SocialLinks/)
})

// Un compte d'une langue sous la mauvaise langue (ou la mauvaise vitrine)
// enverrait un lecteur allemand vers une Page italienne, sans le moindre signe.
test('comptes par langue : langue de la vitrine, URL valides, aucun doublon', () => {
  const seen = new Set(Object.values(SITES).flatMap((s) => Object.values(s.social)))
  for (const site of Object.values(SITES)) {
    const langs = site.pages.map((p) => p.lang)
    for (const [lang, accounts] of Object.entries(site.socialByLang ?? {})) {
      assert.ok(langs.includes(lang), `${site.id}/${lang} : langue hors de la vitrine`)
      assert.notEqual(lang, langs[0], `${site.id}/${lang} : la langue de tête utilise \`social\``)
      for (const [platform, url] of Object.entries(accounts)) {
        assert.ok(platform in site.social, `${site.id}/${lang} : ${platform} inconnu`)
        assert.ok(!seen.has(url), `${url} en double`)
        seen.add(url)
      }
      if (accounts.facebook) assert.match(accounts.facebook, /^https:\/\/www\.facebook\.com\/\d+$/)
      if (accounts.instagram) assert.match(accounts.instagram, /^https:\/\/www\.instagram\.com\/[a-z0-9_.]+\/$/)
      if (accounts.telegram) assert.match(accounts.telegram, /^https:\/\/t\.me\/[a-z0-9_]+$/)
      if (accounts.bluesky) assert.match(accounts.bluesky, /^https:\/\/bsky\.app\/profile\/[a-z0-9.-]+$/)
    }
  }
})

test('socialFor : la langue remplace la vitrine plateforme par plateforme, le reste suit', () => {
  const es = socialFor('org', 'es')
  assert.equal(es.telegram, 'https://t.me/armenianews_es')
  assert.equal(es.linkedin, SITES.org.social.linkedin)
  assert.deepEqual(Object.keys(es), Object.keys(SITES.org.social))
  assert.deepEqual(socialFor('org', 'en'), SITES.org.social)
  assert.equal(socialFor('ch', 'de').facebook, 'https://www.facebook.com/61596218245485')
  assert.equal(socialFor('org', 'ru').instagram, 'https://www.instagram.com/armenianews_ru/')
  assert.equal(socialFor('ch', 'it').bluesky, 'https://bsky.app/profile/it.armenieinfo.ch')
})

test('le JSON-LD d’une page de langue déclare aussi les comptes de cette langue', () => {
  const head = headFor({ siteId: 'ch', lang: 'de' })
  for (const url of Object.values(socialFor('ch', 'de'))) assert.ok(head.includes(url), url)
  for (const url of Object.values(SITES.ch.social)) assert.ok(head.includes(url), url)
  assert.ok(!headFor({ siteId: 'ch', lang: 'it' }).includes(SITES.ch.socialByLang.de.facebook), 'it cite la Page allemande')
})
