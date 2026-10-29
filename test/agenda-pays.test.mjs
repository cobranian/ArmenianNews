// test/agenda-pays.test.mjs
//
// Les pages Agenda par pays (scripts/lib/agenda-pays.mjs). Ce qui est gardé :
//   - un slug valide et UNIQUE par langue pour chacun des pays de COUNTRIES —
//     deux pays au même slug écriraient la même page, en silence ;
//   - les deux seuils : une page dès un événement, indexable dès trois ;
//   - le sitemap ne liste que les indexables, avec un hreflang complet ;
//   - la page dit dans son balisage exactement ce qu'elle affiche ;
//   - les textes existent dans les six langues, sans nom de pays derrière une
//     préposition (voir l'en-tête de src/agendaPaysStrings.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_LANGS, agendaCountrySlug, agendaCountryUrl, agendaCountryPath, urlFor } from '../sites.config.js'
import { COUNTRIES } from '../src/worldPlace.js'
import { paysDeLAgenda, PAYS_INDEX_MIN } from '../src/agendaEvents.js'
import { AGENDA_PAYS_STRINGS } from '../src/agendaPaysStrings.js'
import { agendaPaysHtml, agendaDate } from '../scripts/lib/agenda-pays.mjs'
import { sitemapFor } from '../scripts/lib/sitemap.mjs'

const ev = (title, location, date = '2099-05-01T19:00', country = '') => ({
  title, location, date, country, url: `https://armenopole.com/${encodeURIComponent(title)}.html`,
})

test('chaque pays a un slug latin, unique dans chaque langue', () => {
  for (const l of ALL_LANGS) {
    const slugs = Object.keys(COUNTRIES).map((k) => agendaCountrySlug(l, k))
    for (const s of slugs) assert.match(s, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${l} : ${s}`)
    assert.equal(new Set(slugs).size, slugs.length, `slug en double en ${l}`)
  }
})

test('slugs : nom de la langue, trémas allemands translittérés, anglais pour hy/ru', () => {
  assert.equal(agendaCountryPath('fr', 'switzerland'), '/agenda/suisse/')
  assert.equal(agendaCountryPath('fr', 'usa'), '/agenda/etats-unis/')
  assert.equal(agendaCountryPath('de', 'austria'), '/de/veranstaltungen/oesterreich/')
  assert.equal(agendaCountryPath('it', 'unitedkingdom'), '/it/eventi/regno-unito/')
  assert.equal(agendaCountryUrl('en', 'switzerland'), 'https://armenianews.org/events/switzerland/')
  assert.equal(agendaCountryPath('hy', 'france'), '/hy/events/france/')
  assert.equal(agendaCountryPath('ru', 'uae'), '/ru/events/united-arab-emirates/')
  // La page vit SOUS la vue agenda, avec son slash final (voir VIEWS).
  for (const l of ALL_LANGS) assert.ok(agendaCountryUrl(l, 'france').startsWith(urlFor(l, 'agenda')))
})

test('paysDeLAgenda : regroupe par lieu réel, écarte les lieux sans pays connu', () => {
  const pays = paysDeLAgenda([
    ev('a', 'Genève'), ev('b', 'Suisse'), ev('c', 'Angleterre', undefined, 'greece'),
    ev('d', 'Atlantide'),
  ])
  assert.deepEqual([...pays.keys()].sort(), ['switzerland', 'unitedkingdom'])
  assert.equal(pays.get('switzerland').length, 2)
})

const pays = paysDeLAgenda([
  ev('Concert', 'Genève'), ev('Conférence', 'Vaud'), ev('Fête', 'Zurich'),
  ev('Seul', 'Bruxelles'),
])

test('une page indexable : canonical, hreflang des six langues, Event, liens croisés', () => {
  const html = agendaPaysHtml({ siteId: 'ch', lang: 'fr', key: 'switzerland', events: pays.get('switzerland'), pays, cssHref: '/assets/x.css' })
  assert.ok(html.includes('<html lang="fr">'))
  assert.ok(html.includes('<link rel="canonical" href="https://armenieinfo.ch/agenda/suisse/" />'))
  assert.ok(!html.includes('name="robots"'))
  const alts = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(alts, [...ALL_LANGS, 'x-default'])
  assert.ok(html.includes('hreflang="x-default" href="https://armenianews.org/events/switzerland/"'))
  assert.equal((html.match(/"@type":"Event"/g) || []).length, 3)
  assert.equal((html.match(/<li id="e-/g) || []).length, 3)
  assert.ok(html.includes('<h1 class="viewpage__title">Suisse : événements arméniens à venir</h1>'))
  // La Belgique n'a qu'un événement : pas de lien vers elle (elle est noindex).
  assert.ok(!html.includes('/agenda/belgique/'))
  assert.ok(html.includes('href="/agenda/"'))
})

test(`sous ${PAYS_INDEX_MIN} événements : la page existe mais en noindex`, () => {
  const html = agendaPaysHtml({ siteId: 'org', lang: 'en', key: 'belgium', events: pays.get('belgium'), pays, cssHref: '/assets/x.css' })
  assert.ok(html.includes('<meta name="robots" content="noindex, follow" />'))
  assert.ok(html.includes('href="/events/switzerland/"'), 'lien vers les pays indexables')
})

test('sitemap : seulement les pays indexables, dans les langues de la vitrine', () => {
  const ch = sitemapFor('ch', '2026-10-29T10:00:00Z', {}, [], pays)
  for (const p of ['/agenda/suisse/', '/de/veranstaltungen/schweiz/', '/it/eventi/svizzera/'])
    assert.ok(ch.includes(`<loc>https://armenieinfo.ch${p}</loc>`), p)
  assert.ok(!ch.includes('belgique'))
  assert.ok(!ch.includes('<loc>https://armenianews.org'))
  const org = sitemapFor('org', '2026-10-29T10:00:00Z', {}, [], pays)
  const bloc = org.split('<url>').find((b) => b.includes('<loc>https://armenianews.org/ru/events/switzerland/</loc>'))
  assert.ok(bloc.includes('hreflang="fr" href="https://armenieinfo.ch/agenda/suisse/"'))
  assert.equal((bloc.match(/xhtml:link/g) || []).length, ALL_LANGS.length + 1)
})

test('les textes existent dans les six langues, pays en tête', () => {
  for (const l of ALL_LANGS) {
    const s = AGENDA_PAYS_STRINGS[l]
    assert.ok(s, l)
    for (const k of ['intro', 'others', 'all']) assert.equal(typeof s[k], 'string', `${l}.${k}`)
    assert.ok(s.title('XX').startsWith('XX'), `${l}.title`)
    assert.ok(s.description('XX').startsWith('XX'), `${l}.description`)
    assert.ok(s.count(7).includes('7'), `${l}.count`)
  }
})

test('la date suit les formateurs de l’interface, arménien compris', () => {
  assert.equal(agendaDate('fr', '2026-11-03T19:00'), '3 novembre 2026')
  assert.match(agendaDate('hy', '2026-11-03T19:00'), /նոյեմբերի/)
})
