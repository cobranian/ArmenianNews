import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITES, pathFor, primaryLang } from '../sites.config.js'
import { notFoundHtml } from '../scripts/lib/not-found.mjs'

// La page 404 est ce que Firebase sert, avec un VRAI statut 404, à toute URL
// qui ne correspond à aucun fichier — depuis le retrait du rewrite `**` →
// index.html (voir firebase.json). Avant, l'accueil répondait 200 à
// n'importe quoi : un « soft 404 » pour Google, et un doublon de l'accueil par
// URL fantaisiste. Ces tests gardent les trois propriétés qui rendent la page
// utile sans la rendre indexable.

for (const site of Object.values(SITES)) {
  const html = notFoundHtml(site.id)
  const lang = primaryLang(site.id)

  test(`404 ${site.id} : langue du domaine, noindex, marque`, () => {
    assert.ok(html.startsWith('<!doctype html>'), 'document complet')
    assert.ok(html.includes(`<html lang="${lang}">`), `<html lang="${lang}">`)
    assert.match(html, /<meta name="robots" content="noindex[^"]*">/)
    assert.ok(html.includes(site.brand), 'porte la marque de la vitrine')
    assert.ok(html.includes('<meta name="viewport"'), 'viewport')
    // Pas de canonical : une page d'erreur ne se déclare pas comme une URL —
    // elle est servie à des milliers d'adresses différentes.
    assert.ok(!html.includes('rel="canonical"'), 'aucun canonical')
  })

  test(`404 ${site.id} : mène aux trois vues de chaque langue du site`, () => {
    for (const page of site.pages) {
      for (const view of ['home', 'radio', 'agenda']) {
        const href = pathFor(page.lang, view)
        assert.ok(html.includes(`href="${href}"`), `lien vers ${href}`)
      }
    }
  })

  test(`404 ${site.id} : aucune URL du voisin`, () => {
    for (const other of Object.values(SITES)) {
      if (other.id === site.id) continue
      assert.ok(!html.includes(other.host), `ne cite pas ${other.host}`)
    }
  })
}

test('les quatre langues ont leurs chaînes, sans repli silencieux', () => {
  // La page du .org affiche une ligne par langue servie : un libellé manquant
  // retomberait sur le français sans rien dire, et le lecteur russe verrait
  // « Retour à l\'accueil ». On vérifie que chaque langue écrit la sienne.
  const org = notFoundHtml('org')
  assert.ok(org.includes('Page not found'), 'titre anglais')
  assert.ok(org.includes('Էջը չի գտնվել') || org.includes('Գլխավոր'), 'chaînes arméniennes')
  assert.ok(org.includes('Главная') || org.includes('главную'), 'chaînes russes')
  assert.ok(!org.includes('Page introuvable'), 'pas de français sur le .org')
})

test('firebase.json ne réécrit plus tout vers index.html', () => {
  // Le catch-all transformait chaque URL inconnue en accueil servi en 200.
  // Sans lui, Firebase sert 404.html avec un statut 404 et redirige toujours
  // /radio → /radio/ (c'est le comportement de répertoire, pas le rewrite).
  const firebase = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf-8'))
  for (const h of firebase.hosting) {
    const catchAll = (h.rewrites ?? []).filter((r) => r.source === '**')
    assert.equal(catchAll.length, 0, `${h.site} réécrit encore ** → ${catchAll[0]?.destination}`)
  }
})

test('firebase.json redirige les slugs jumeaux vers la vue du domaine', () => {
  // « events » existe en en/hy/ru, « agenda » en fr : un lecteur qui tape le
  // slug de l'autre langue sur le mauvais domaine doit arriver à la vue, pas
  // sur une 404. Et /fr/ n'existe nulle part (le français vit à la racine du
  // .ch) : sur le .org il renvoie au .ch.
  const firebase = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf-8'))
  const byId = Object.fromEntries(
    firebase.hosting.map((h) => [Object.values(SITES).find((s) => s.firebaseSite === h.site).id, h]),
  )
  // En `regex`, pas en `source` : le glob `/events{,/**}` de la documentation
  // ne matchait ni /events ni /events/ dans l'émulateur (vérifié le 21 août
  // 2026 — les deux répondaient 404). Une regex RE2 est sans ambiguïté, et
  // c'est elle que ce test reproduit sur les mêmes chemins.
  const redir = (siteId) =>
    Object.fromEntries((byId[siteId].redirects ?? []).map((r) => [r.regex, r]))
  const matches = (re, paths) => paths.every((p) => new RegExp(re).test(p))

  const ch = redir('ch')
  const chRe = Object.keys(ch).find((re) => matches(re, ['/events', '/events/']))
  assert.ok(chRe, 'le .ch redirige /events et /events/')
  assert.equal(ch[chRe].destination, '/agenda/')
  assert.equal(ch[chRe].type, 301)
  assert.ok(!matches(chRe, ['/eventsx']), 'la regex est ancrée')

  const org = redir('org')
  const orgRe = Object.keys(org).find((re) => matches(re, ['/agenda', '/agenda/']))
  assert.ok(orgRe, 'le .org redirige /agenda et /agenda/')
  assert.equal(org[orgRe].destination, '/events/')
  assert.equal(org[orgRe].type, 301)
  const frRe = Object.keys(org).find((re) => matches(re, ['/fr', '/fr/']))
  assert.ok(frRe, 'le .org redirige /fr et /fr/')
  assert.equal(org[frRe].destination, SITES.ch.host + '/')
  assert.equal(org[frRe].type, 301)
  assert.ok(!matches(frRe, ['/fruits/']), 'la regex est ancrée')
})
