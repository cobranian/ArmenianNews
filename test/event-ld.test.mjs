import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { eventLd, startDateLd } from '../src/agendaEvents.js'
import { agendaJsonLd } from '../src/jsonld.js'

// Le nœud `Event` est composé UNE fois (src/agendaEvents.js) et lu des deux
// côtés : le plugin `agendaEventsJsonLd` (vite.config.js, accueil) et
// `agendaJsonLd` (src/jsonld.js, vue /agenda/). Ils l'écrivaient chacun : l'un
// avec `address`, l'autre sans ; l'un avec `eventAttendanceMode`, l'autre pas.
// Le Rich Results Test jugeait donc l'accueil et /agenda/ différemment sur les
// mêmes événements.

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8')

const ev = {
  title: 'Traditionnel Khorovats',
  url: 'https://armenopole.com/traditionnel-khorovats.html',
  location: 'Genève',
  date: '2026-08-30T12:30',
  image: 'https://armenopole.com/images/events/traditionnel-khorovats.jpg',
}

test('startDate : heure murale telle quelle, sans fuseau', () => {
  assert.equal(startDateLd('2026-08-30T12:30'), '2026-08-30T12:30')
})

test('startDate : 23:59 est « toute la journée » → date seule', () => {
  // Armenopole note 23:59 quand l'événement n'a pas d'heure (27 sur 155 le
  // 21 août 2026). Annoncer 23:59 à Google serait faux ; annoncer le jour
  // seul est exact, et c'est ce que schema.org accepte pour une date.
  assert.equal(startDateLd('2026-08-31T23:59'), '2026-08-31')
})

test('startDate : une vieille valeur en UTC n’est pas inventée en heure murale', () => {
  // agenda.json peut encore porter des `Z` (backfill d'un ancien snapshot) :
  // on ne sait pas retrouver l'heure murale, on passe la valeur telle quelle —
  // elle reste une date valide, simplement décalée — plutôt que de la tronquer
  // en un jour qui pourrait être faux.
  assert.equal(startDateLd('2026-08-30T12:30:00.000Z'), '2026-08-30T12:30:00.000Z')
})

test('eventLd : un seul nœud, avec lieu adressé et mode de présence', () => {
  const node = eventLd(ev)
  assert.deepEqual(node, {
    '@type': 'Event',
    name: 'Traditionnel Khorovats',
    startDate: '2026-08-30T12:30',
    url: 'https://armenopole.com/traditionnel-khorovats.html',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: 'Genève', address: 'Genève' },
    image: 'https://armenopole.com/images/events/traditionnel-khorovats.jpg',
  })
})

test('eventLd : sans lieu ni image, les clés sont absentes, pas vides', () => {
  const node = eventLd({ ...ev, location: '', image: null })
  assert.equal(node.location, undefined)
  assert.equal(node.image, undefined)
})

test('agendaJsonLd (vue /agenda/) passe par eventLd', () => {
  const maintenant = new Date(2026, 7, 21).getTime()
  const out = JSON.parse(agendaJsonLd('fr', [ev, { ...ev, url: 'x', date: '2026-08-31T23:59' }], maintenant))
  assert.deepEqual(out.itemListElement[0].item, eventLd(ev))
  assert.equal(out.itemListElement[1].item.startDate, '2026-08-31')
})

test('le plugin de vite.config.js passe par eventLd, et n’écrit plus son propre Event', () => {
  // Lu comme du texte : vite.config.js importe des plugins Vite qu'on ne veut
  // pas charger dans un test. C'est la même technique que pour les JSX.
  const src = lire('../vite.config.js')
  assert.match(src, /import \{[^}]*\beventLd\b[^}]*\} from '\.\/src\/agendaEvents\.js'/)
  assert.ok(!src.includes("'@type': 'Event'"), 'vite.config.js compose encore un Event à la main')
})
