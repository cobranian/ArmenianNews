import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALL_LANGS, ALL_VIEWS, VIEWS, SITES, urlFor, viewFromPath } from '../sites.config.js'
import { VIEW_SEO } from '../src/seo.js'
import { headFor } from '../scripts/lib/site-meta.mjs'
import { agendaGuardChecks } from '../scripts/lib/agenda-guard.mjs'
import { notFoundHtml } from '../scripts/lib/not-found.mjs'

// La vue « about » (audit SEO du 21 août 2026). Une vue de plus touche sept
// endroits ; ces tests gardent ceux qu'aucun autre contrôle ne couvrirait en
// silence : le texte dans les quatre langues (t() retombe sur le français sans
// rien dire), la garde de l'agenda (une vue inconnue la fait échouer, mais une
// vue mal classée laisserait passer des Event), et la route du composant.

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8')
const i18n = lire('../src/i18n.jsx')

test('about est une vue à part entière : slugs latins, traduits en français', () => {
  assert.ok(ALL_VIEWS.includes('about'))
  assert.deepEqual(VIEWS.about.slugs, { fr: 'a-propos/', en: 'about/', hy: 'about/', ru: 'about/' })
  assert.equal(urlFor('fr', 'about'), 'https://armenieinfo.ch/a-propos/')
  assert.equal(urlFor('hy', 'about'), 'https://armenianews.org/hy/about/')
  assert.equal(viewFromPath('ch', '/a-propos/'), 'about')
  assert.equal(viewFromPath('org', '/ru/about'), 'about')
})

test('VIEW_SEO.about existe dans les quatre langues, sans nombre écrit en toutes lettres', () => {
  for (const l of ALL_LANGS) {
    assert.ok(VIEW_SEO.about[l]?.title && VIEW_SEO.about[l]?.description, `about ${l}`)
    assert.ok(VIEW_SEO.about[l].description.length <= 160, `${l} : description trop longue`)
  }
  // Les comptes (radios, rédactions) sont gardés ailleurs ; en écrire un ici
  // vieillirait en silence.
  assert.doesNotMatch(VIEW_SEO.about.fr.description, /quinze|douze|onze|sept/i)
  assert.doesNotMatch(VIEW_SEO.about.en.description, /fifteen|twelve|eleven|seven/i)
})

test('le <head> d’une page about se génère pour chaque langue, avec ses hreflang', () => {
  for (const site of Object.values(SITES)) {
    for (const page of site.pages) {
      const head = headFor({ siteId: site.id, lang: page.lang, view: 'about' })
      assert.ok(head.includes(`rel="canonical" href="${urlFor(page.lang, 'about')}"`))
      for (const l of ALL_LANGS) assert.ok(head.includes(`hreflang="${l}" href="${urlFor(l, 'about')}"`))
    }
  }
})

test('la garde de l’agenda classe about comme une vue sans Event', () => {
  const ok = (checks) => checks.every(([, v]) => v)
  assert.ok(ok(agendaGuardChecks('about', '<html><head></head><body></body></html>', { agendaAttendu: true, agendaAVenir: true })))
  assert.ok(!ok(agendaGuardChecks('about', '{"@type":"Event"}', { agendaAttendu: true, agendaAVenir: true })))
})

test('les chaînes de la page existent dans les quatre langues', () => {
  const keys = [
    'about.h1', 'about.intro', 'about.what.title', 'about.what.body', 'about.what.news',
    'about.what.radio', 'about.what.agenda', 'about.what.social', 'about.what.sites',
    'about.rules.title', 'about.rules.links', 'about.rules.hourly', 'about.rules.noads',
    'about.rules.facts', 'about.sources.title', 'about.sources.body', 'about.sources.langs',
    'about.sources.other', 'about.contact.title', 'about.contact.body',
  ]
  for (const key of keys) {
    const n = (i18n.match(new RegExp(`'${key.replace(/\./g, '\\.')}':`, 'g')) || []).length
    assert.equal(n, ALL_LANGS.length, `${key} : ${n} déclaration(s)`)
  }
  // Le nombre de stations entre par {n} dans les quatre versions.
  assert.equal((i18n.match(/'about\.what\.radio': '\{n\}/g) || []).length, ALL_LANGS.length)
})

test('App route la vue, le pied de page et la 404 la lient', () => {
  assert.match(lire('../src/App.jsx'), /view === 'about' \? \(\s*<AboutPage \/>/)
  assert.match(lire('../src/components/Footer.jsx'), /pathFor\(lang, 'about'\)/)
  for (const site of Object.values(SITES)) {
    const html = notFoundHtml(site.id)
    for (const page of site.pages) {
      assert.ok(html.includes(`href="${urlFor(page.lang, 'about').replace(site.host, '')}"`), `404 ${site.id} → about ${page.lang}`)
    }
  }
})

test('AboutPage liste toutes les rédactions de TAB_ORDER, avec une page d’accueil chacune', () => {
  const src = lire('../src/components/AboutPage.jsx')
  const tabs = lire('../src/newsSources.js')
  const ids = [...new Set([...tabs.matchAll(/^\s+'([a-z]+)',?$/gm)].map((m) => m[1]))]
  assert.ok(ids.length >= 10, `TAB_ORDER lu comme texte : ${ids.length} ids`)
  for (const id of ids) {
    assert.match(src, new RegExp(`^\\s+${id}: 'https://`, 'm'), `HOMES.${id} manque dans AboutPage.jsx`)
  }
})
