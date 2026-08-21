import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALL_LANGS } from '../sites.config.js'

// Maillage interne (audit SEO du 21 août 2026). L'accueil portait 264 liens
// sortants pour DEUX liens vers ses propres pages piliers, la nav n'était faite
// que d'ancres, et /radio/ ne liait jamais /agenda/ (ni l'inverse). Ces tests
// lisent les composants COMME DU TEXTE (Node ne sait pas importer du JSX) et
// gardent les trois endroits qui relient désormais les pages entre elles.

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8')
const i18n = lire('../src/i18n.jsx')

test('le pied de page lie les trois pages du site, dans la langue de la page', () => {
  const src = lire('../src/components/Footer.jsx')
  assert.match(src, /pathFor\(lang, 'home'\)/)
  assert.match(src, /pathFor\(lang, 'radio'\)/)
  assert.match(src, /pathFor\(lang, 'agenda'\)/)
  assert.match(src, /className="footer__pages"/)
  // Les ancres portent le <title> des vues, pas un libellé maison.
  assert.match(src, /VIEW_SEO\.radio\[lang\]\.title/)
  assert.match(src, /VIEW_SEO\.agenda\[lang\]\.title/)
})

test('hors de l’accueil, la nav mène aux pages piliers et non aux ancres', () => {
  const src = lire('../src/components/Nav.jsx')
  assert.match(src, /view === 'home' \? '#direct' : pathFor\(lang, 'radio'\)/)
  assert.match(src, /view === 'home' \? '#agenda' : pathFor\(lang, 'agenda'\)/)
})

test('radio ⇄ agenda : chaque page pilier lie l’autre', () => {
  const radio = lire('../src/components/RadioPage.jsx')
  const agenda = lire('../src/components/AgendaPage.jsx')
  assert.match(radio, /pathFor\(lang, 'agenda'\)/)
  assert.match(radio, /VIEW_SEO\.agenda\[lang\]\.title/)
  assert.match(agenda, /pathFor\(lang, 'radio'\)/)
  assert.match(agenda, /VIEW_SEO\.radio\[lang\]\.title/)
})

test('les trois chaînes du maillage existent dans les quatre langues', () => {
  // `t()` retombe sur le français en silence : une clé oubliée dans un bloc
  // afficherait « Pages du site » sur la page russe.
  for (const key of ['footer.pages', 'footer.home', 'viewpage.also']) {
    const n = (i18n.match(new RegExp(`'${key.replace('.', '\\.')}': '`, 'g')) || []).length
    assert.equal(n, ALL_LANGS.length, `${key} : ${n} déclaration(s), attendu ${ALL_LANGS.length}`)
  }
})

test('les cartes d’actualité n’annoncent pas trois fois le même lien', () => {
  const src = lire('../src/components/NewsBrowser.jsx')
  // Le lien-image est retiré de l'arbre d'accessibilité et du parcours
  // clavier ; le « Lire la suite » porte la cible en aria-label.
  assert.match(src, /className=\{`card__media[\s\S]{0,200}aria-hidden="true"[\s\S]{0,40}tabIndex=\{-1\}/)
  assert.match(src, /className="card__more"[\s\S]{0,200}aria-label=\{item\.title \? `\$\{t\('news\.readmore'\)\}/)
})

test('les cartes de l’agenda de l’accueil sont des h3 sous le h2 de section', () => {
  assert.match(lire('../src/components/Agenda.jsx'), /<h3 className="agenda-card__title">/)
  assert.doesNotMatch(lire('../src/components/Agenda.jsx'), /<h4/)
})
