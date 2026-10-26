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
// Puis (même soir) : le lien doit ouvrir le CARROUSEL de l'accueil, visionneuse
// ouverte sur l'événement — pas la liste /agenda/.
test('le partage d’un événement vise l’accueil /#ancre, qui ouvre la visionneuse', () => {
  const agenda = read('Agenda.jsx')
  assert.match(agenda, /share: ev\.url \? \{ url: `\$\{urlFor\(lang, 'home'\)\}#\$\{eventAnchor\(ev\)\}`/)
  // L'arrivée : l'ancre est lue AU MONTAGE (hydratation), puis pays + visionneuse.
  assert.match(agenda, /\/\^#\(e-\[0-9a-z\]\+\)\$\/\.exec\(location\.hash\)/)
  assert.match(agenda, /setBox\(\{ index, fromLink: true \}\)/)
  assert.doesNotMatch(agenda, /share: ev\.url \? \{ url: ev\.url/)
  assert.match(read('AgendaPage.jsx'), /<li key=\{ev\.url\} id=\{eventAnchor\(ev\)\}>/)
})
