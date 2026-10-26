import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { eventAnchor } from '../src/agendaEvents.js'

const read = (f) => readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf-8')

test('eventAnchor : stable, propre à chaque URL, utilisable comme id', () => {
  const a = eventAnchor({ url: 'https://armenopole.com/ara-malikian' })
  assert.equal(a, eventAnchor({ url: 'https://armenopole.com/ara-malikian', title: 'autre' }))
  assert.notEqual(a, eventAnchor({ url: 'https://armenopole.com/autre' }))
  assert.match(a, /^e-[0-9a-z]+$/)
})

// Les boutons de partage de l'agenda doivent amener sur CE site (demande de
// l'éditeur, 26 oct. 2026), donc viser l'ancre que /agenda/ pose réellement.
test('le partage d’un événement vise /agenda/#ancre, pas armenopole', () => {
  const agenda = read('Agenda.jsx')
  assert.match(agenda, /share: ev\.url \? \{ url: `\$\{urlFor\(lang, 'agenda'\)\}#\$\{eventAnchor\(ev\)\}`/)
  assert.doesNotMatch(agenda, /share: ev\.url \? \{ url: ev\.url/)
  assert.match(read('AgendaPage.jsx'), /<li key=\{ev\.url\} id=\{eventAnchor\(ev\)\}>/)
})
