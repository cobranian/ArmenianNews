// Les deux barres de navigation — Nav.jsx (accueil, vues) et la coquille des
// pages statiques (brève, Culture, agenda par pays) — affichent la MÊME liste,
// dans le MÊME ordre, tirée de src/navLinks.js. Elles avaient divergé : sur
// une page Culture manquaient Actualités, Jeux et Réseaux (12 nov. 2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { navLinks } from '../src/navLinks.js'
import { pageShell } from '../scripts/lib/static-shell.mjs'
import { SITES, ALL_LANGS, langPath, pathFor, briefPath, culturePath } from '../sites.config.js'
import { BRIEF_STRINGS } from '../src/briefStrings.js'

test('ordre voulu : En direct, Brève, Actualités, Agenda, Culture, Réseaux, Jeux', () => {
  const l = navLinks('fr', { home: '/' })
  assert.deepEqual(
    l.map(([, label]) => label),
    ['En direct', 'Brève', 'Actualités', 'Agenda', 'Culture', 'Réseaux', 'Jeux'],
  )
  assert.deepEqual(
    l.map(([href]) => href),
    [pathFor('fr', 'radio'), briefPath('fr'), '/#actualites', pathFor('fr', 'agenda'), culturePath('fr'), '/#reseaux', pathFor('fr', 'games')],
  )
})

test('sur l’accueil, En direct et Agenda sont des ancres', () => {
  const l = navLinks('fr', { onHome: true })
  assert.equal(l[0][0], '#direct')
  assert.equal(l[2][0], '#actualites')
  assert.equal(l[3][0], '#agenda')
})

test('chaque page statique porte la liste entière, dans l’ordre, pour chaque langue', () => {
  for (const site of Object.values(SITES)) {
    for (const { lang } of site.pages) {
      const html = pageShell({ siteId: site.id, lang, head: '', cssHref: '/x.css', body: '' })
      const bloc = html.match(/<nav class="brief-nav__links">([\s\S]*?)<\/nav>/)[1]
      const hrefs = [...bloc.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
      assert.deepEqual(hrefs, navLinks(lang, { home: langPath(site.id, lang) }).map(([h]) => h), `${site.id}/${lang}`)
    }
  }
})

test('Nav.jsx ne garde aucune liste de liens à lui', () => {
  const src = readFileSync(new URL('../src/components/Nav.jsx', import.meta.url), 'utf-8')
  assert.match(src, /navLinks\(lang,/)
  assert.doesNotMatch(src, /t\('nav\.(radio|news|agenda|games|social)'\)/)
})

test('tous les libellés existent dans chaque langue', () => {
  for (const lang of ALL_LANGS) {
    for (const [, label] of navLinks(lang, { home: '/' })) assert.ok(label?.trim(), `${lang} : ${label}`)
  }
  assert.ok(BRIEF_STRINGS.fr.games)
})
