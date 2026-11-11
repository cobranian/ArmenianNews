import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { ALL_LANGS, ALL_VIEWS, VIEWS, SITES, urlFor, viewFromPath } from '../sites.config.js'
import { VIEW_SEO } from '../src/seo.js'
import { headFor } from '../scripts/lib/site-meta.mjs'
import { agendaGuardChecks } from '../scripts/lib/agenda-guard.mjs'
import { notFoundHtml } from '../scripts/lib/not-found.mjs'
import { BLOC_LANGS, clesDe, valeur } from './helpers/i18n-blocks.mjs'

// La vue « games » (onglet Jeux). Même câblage que `about` : on garde ici ce
// qu'aucun autre contrôle ne verrait en silence — le texte dans toutes les
// langues, la garde de l'agenda, la route, les liens entrants et les redirections.

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8')

test('games est une vue : slugs latins, traduits là où le mot change', () => {
  assert.ok(ALL_VIEWS.includes('games'))
  assert.deepEqual(VIEWS.games.slugs, {
    fr: 'jeux/',
    de: 'spiele/',
    it: 'giochi/',
    en: 'games/',
    es: 'juegos/',
    hy: 'games/',
    ru: 'games/',
  })
  assert.equal(urlFor('fr', 'games'), 'https://armenieinfo.ch/jeux/')
  assert.equal(urlFor('hy', 'games'), 'https://armenianews.org/hy/games/')
  assert.equal(viewFromPath('ch', '/de/spiele'), 'games')
  assert.equal(viewFromPath('org', '/es/juegos/'), 'games')
})

test('VIEW_SEO.games existe dans chaque langue, description de 160 caractères au plus', () => {
  for (const l of BLOC_LANGS) {
    assert.ok(VIEW_SEO.games[l]?.title && VIEW_SEO.games[l]?.description, `games ${l}`)
    assert.ok(VIEW_SEO.games[l].description.length <= 160, `${l} : description trop longue`)
  }
})

test('le <head> d’une page games porte son canonical et ses 7 hreflang', () => {
  for (const site of Object.values(SITES)) {
    for (const page of site.pages) {
      const head = headFor({ siteId: site.id, lang: page.lang, view: 'games' })
      assert.ok(head.includes(`rel="canonical" href="${urlFor(page.lang, 'games')}"`))
      for (const l of ALL_LANGS) assert.ok(head.includes(`hreflang="${l}" href="${urlFor(l, 'games')}"`))
    }
  }
})

test('la garde de l’agenda classe games comme une vue sans Event', () => {
  const ok = (checks) => checks.every(([, v]) => v)
  assert.ok(ok(agendaGuardChecks('games', '<html><head></head><body></body></html>', { agendaAttendu: true, agendaAVenir: true })))
  assert.ok(!ok(agendaGuardChecks('games', '{"@type":"Event"}', { agendaAttendu: true, agendaAVenir: true })))
})

test('nav.games existe dans chaque bloc de langue', () => {
  const n = (lire('../src/i18n.jsx').match(/'nav\.games':/g) || []).length
  assert.equal(n, BLOC_LANGS.length)
})

test('App route la vue ; Nav, pied de page et 404 la lient', () => {
  assert.match(lire('../src/App.jsx'), /view === 'games' \? \(\s*<GamesPage \/>/)
  assert.match(lire('../src/components/Footer.jsx'), /pathFor\(lang, 'games'\)/)
  assert.match(lire('../src/components/Nav.jsx'), /pathFor\(lang, 'games'\)/)
  for (const site of Object.values(SITES)) {
    const html = notFoundHtml(site.id)
    for (const page of site.pages) {
      assert.ok(html.includes(`href="${urlFor(page.lang, 'games').replace(site.host, '')}"`), `404 ${site.id} → games ${page.lang}`)
    }
  }
})

test('firebase.json redirige les slugs jumeaux vers la vue du domaine', () => {
  const [ch, org] = JSON.parse(lire('../firebase.json')).hosting
  const va = (bloc, regex, destination) =>
    assert.ok(bloc.redirects.some((r) => r.regex === regex && r.destination === destination && r.type === 301), `${regex} → ${destination}`)
  va(ch, '^/games/?$', '/jeux/')
  va(ch, '^/de/games/?$', '/de/spiele/')
  va(ch, '^/it/games/?$', '/it/giochi/')
  va(org, '^/jeux/?$', '/games/')
  va(org, '^/es/(?:games|jeux)/?$', '/es/juegos/')
})

test('GamesPage lit GAMES, lie chaque jeu dans la langue de la page, compte le clic', () => {
  const src = lire('../src/components/GamesPage.jsx')
  assert.match(src, /import \{[^}]*\bGAMES\b[^}]*\} from '\.\.\/games\.js'/)
  assert.ok(src.includes('?lang=${lang}'), 'le lien « Jouer » porte ?lang=${lang}')
  assert.ok(src.includes("'jeu_ouvert'"), 'le clic envoie jeu_ouvert à GA')
  // Les jeux sont servis à part, hors du bundle : rien n'en est importé.
  assert.doesNotMatch(src, /from\s+['"][^'"]*public\/play/)
  assert.doesNotMatch(src, /import\(\s*['"][^'"]*public\/play/)
})

test('chaque jeu a sa vignette 640×400 dans chaque langue, et GamesPage la prend dans la langue de la page', async () => {
  const { GAMES } = await import('../src/games.js')
  assert.ok(lire('../src/components/GamesPage.jsx').includes('/play/vignettes/${lang}/${g.id}.png'))
  for (const l of BLOC_LANGS) {
    for (const g of GAMES) {
      const p = `../public/play/vignettes/${l}/${g.id}.png`
      assert.ok(existsSync(new URL(p, import.meta.url)), `${l}/${g.id}.png absent`)
      const b = readFileSync(new URL(p, import.meta.url))
      assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [640, 400], `${l}/${g.id}.png`)
    }
  }
})

test('games.play et games.rules existent dans chaque bloc de langue', () => {
  const i18n = lire('../src/i18n.jsx')
  for (const cle of ['games.play', 'games.rules']) {
    const n = (i18n.match(new RegExp(`'${cle.replace('.', '\\.')}':`, 'g')) || []).length
    assert.equal(n, BLOC_LANGS.length, cle)
  }
})

// La politique de confidentialité doit dire ce que font les jeux : le mode ami
// passe par Firebase (Google), et Nareg a décidé de le NOMMER. Une langue sans
// la section retomberait en silence sur le français (t() replie sur fr).
test('la confidentialité a sa section Jeux, qui nomme Firebase, dans chaque langue', () => {
  for (const l of BLOC_LANGS) {
    for (const cle of ['privacy.games.title', 'privacy.games.body']) {
      assert.ok(clesDe(l).has(cle), `${l} : ${cle}`)
    }
    assert.match(valeur(l, 'privacy.games.body') ?? '', /Firebase/, `${l} : Firebase non nommé`)
    assert.match(valeur(l, 'privacy.games.body') ?? '', /europe-west1/, `${l} : région non dite`)
  }
  const footer = lire('../src/components/Footer.jsx')
  const stockage = footer.indexOf("t('privacy.storage.body')")
  const jeux = footer.indexOf("t('privacy.games.body')")
  assert.ok(stockage > 0 && jeux > stockage, 'la section Jeux suit « Conservé sur votre appareil »')
})
