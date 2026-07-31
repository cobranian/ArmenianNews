import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AGENDA_LD_ATTR, AGENDA_LD_VALUE } from '../scripts/lib/agenda-ld.mjs'
import { agendaGuardChecks } from '../scripts/lib/agenda-guard.mjs'

// Fixtures minimales : un fragment de <head> avec le graphe du PLUGIN
// (marqué), et un fragment avec le graphe du COMPOSANT (un Event non marqué,
// exactement ce que produit agendaJsonLd côté AgendaPage.jsx).
const PLUGIN_GRAPH = `<script type="application/ld+json" ${AGENDA_LD_ATTR}="${AGENDA_LD_VALUE}">{"@graph":[{"@type":"Event","name":"Concert"}]}</script>`
const COMPONENT_GRAPH = `<script type="application/ld+json">{"itemListElement":[{"item":{"@type":"Event","name":"Concert"}}]}</script>`
const NO_GRAPH = '<title>rien ici</title>'

const ok = (checks) => checks.every(([, v]) => v === true)
const failed = (checks) => checks.filter(([, v]) => !v).map(([n]) => n)

test('accueil : le graphe du plugin est attendu si l’agenda en a', () => {
  assert.ok(
    ok(agendaGuardChecks('home', PLUGIN_GRAPH, { agendaAttendu: true, agendaAVenir: true })),
    'doit passer avec le graphe du plugin present',
  )
  assert.deepEqual(
    failed(agendaGuardChecks('home', NO_GRAPH, { agendaAttendu: true, agendaAVenir: true })),
    ['le graphe du plugin (data-ld="agenda") est là', 'des Event sont présents si l’agenda en a'],
  )
})

test('accueil : un agenda vide n’exige ni graphe ni Event (etat degrade legitime)', () => {
  assert.ok(ok(agendaGuardChecks('home', NO_GRAPH, { agendaAttendu: false, agendaAVenir: false })))
})

test('agenda : le graphe du composant est attendu, celui du plugin doit etre absent', () => {
  assert.ok(
    ok(agendaGuardChecks('agenda', COMPONENT_GRAPH, { agendaAttendu: true, agendaAVenir: true })),
    'un Event pose par le composant doit passer',
  )
})

test('agenda : le graphe du PLUGIN recopie a tort echoue meme s’il contient un Event valide', () => {
  const checks = agendaGuardChecks('agenda', PLUGIN_GRAPH, { agendaAttendu: true, agendaAVenir: true })
  assert.deepEqual(failed(checks), ['le graphe du plugin est absent'])
})

test('agenda : sans evenement a venir, l’absence d’Event est legitime', () => {
  assert.ok(ok(agendaGuardChecks('agenda', NO_GRAPH, { agendaAttendu: true, agendaAVenir: false })))
})

test('agenda : un evenement a venir existe mais aucun Event n’est balise -> echec', () => {
  const checks = agendaGuardChecks('agenda', NO_GRAPH, { agendaAttendu: true, agendaAVenir: true })
  assert.deepEqual(failed(checks), ['des Event sont présents si l’agenda en a'])
})

test('radio : ni le graphe du plugin ni aucun Event ne doivent survivre', () => {
  assert.ok(ok(agendaGuardChecks('radio', NO_GRAPH, { agendaAttendu: true, agendaAVenir: true })))
  const avecPlugin = agendaGuardChecks('radio', PLUGIN_GRAPH, { agendaAttendu: true, agendaAVenir: true })
  assert.deepEqual(failed(avecPlugin), ['le graphe du plugin est absent', 'aucun Event sur /radio'])
})
