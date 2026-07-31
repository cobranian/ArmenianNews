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

// Les deux stades du HTML de /agenda/ : ce que `npm run build` écrit (racine
// React vide, ce que `npm run check` voit en CI) et ce que `npm run prerender`
// en fait (racine remplie, ce que voit le poste local). Le balisage Event du
// composant vit DANS la racine — il n'existe donc qu'au second stade.
const AVANT_PRERENDU = `${NO_GRAPH}<div id="root"></div>`
const prerendu = (dedans) => `${NO_GRAPH}<div id="root"><main>${dedans}</main></div>`

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
    ok(
      agendaGuardChecks('agenda', prerendu(COMPONENT_GRAPH), {
        agendaAttendu: true,
        agendaAVenir: true,
      }),
    ),
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

// Le defaut qui a bloque un deploiement : en CI, `check` passe AVANT
// `prerender`, donc /agenda/ n'a encore que sa racine vide et pas un seul Event.
// Exiger le balisage a ce stade fait echouer quatre pages saines.
test('agenda, avant prerendu : la racine vide differe l’exigence d’Event', () => {
  assert.ok(
    ok(agendaGuardChecks('agenda', AVANT_PRERENDU, { agendaAttendu: true, agendaAVenir: true })),
    'le stade « bati, pas encore cuit » doit passer',
  )
})

// La preuve que le report ci-dessus n'a pas rendu la garde inatteignable : une
// fois la page cuite, l'absence d'Event redevient un echec. Sans ce test, une
// condition mal ecrite desarmerait le controle en silence.
test('agenda, prerendu mais sans aucun Event -> echec (la garde peut toujours echouer)', () => {
  const checks = agendaGuardChecks('agenda', prerendu('<h1>Agenda</h1>'), {
    agendaAttendu: true,
    agendaAVenir: true,
  })
  assert.deepEqual(failed(checks), ['des Event sont présents si l’agenda en a'])
})

// L'exigence d'Event est differee avant prerendu ; l'interdiction du graphe du
// PLUGIN, elle, vaut aux deux stades — c'est elle qui porte la protection
// d'origine, et ce defaut-la nait au build.
test('agenda, avant prerendu : le graphe du plugin reste interdit', () => {
  const checks = agendaGuardChecks('agenda', `${PLUGIN_GRAPH}<div id="root"></div>`, {
    agendaAttendu: true,
    agendaAVenir: true,
  })
  assert.deepEqual(failed(checks), ['le graphe du plugin est absent'])
})

// Le sens du test de stade : seule la racine vide EXACTE vaut « pas encore
// prerendue ». Un HTML dont le conteneur aurait change de forme est traite
// comme cuit, donc soumis a l'exigence — la garde se resserre, jamais l'inverse.
test('agenda : un HTML sans racine reconnaissable est tenu pour prerendu', () => {
  const checks = agendaGuardChecks('agenda', NO_GRAPH, { agendaAttendu: true, agendaAVenir: true })
  assert.deepEqual(failed(checks), ['des Event sont présents si l’agenda en a'])
})

// Une vue ajoutee a VIEWS sans decision dans la garde heritait de la branche de
// l ACCUEIL : elle aurait reclame un graphe d agenda sur une page qui n en veut
// pas, avec un message parlant de balisage et non de la vue oubliee.
test('une vue inconnue echoue en nommant SA cause', () => {
  const checks = agendaGuardChecks('boutique', PLUGIN_GRAPH, {
    agendaAttendu: true,
    agendaAVenir: true,
  })
  assert.equal(checks.length, 1)
  assert.equal(checks[0][1], false)
  assert.match(checks[0][0], /boutique/)
})

test('radio : ni le graphe du plugin ni aucun Event ne doivent survivre', () => {
  assert.ok(ok(agendaGuardChecks('radio', NO_GRAPH, { agendaAttendu: true, agendaAVenir: true })))
  const avecPlugin = agendaGuardChecks('radio', PLUGIN_GRAPH, { agendaAttendu: true, agendaAVenir: true })
  assert.deepEqual(failed(avecPlugin), ['le graphe du plugin est absent', 'aucun Event sur /radio'])
  // Le defaut d'origine (le @graph du plugin recopie sur /radio/) nait au
  // build : il doit tomber des le stade CI, racine encore vide.
  const enCi = agendaGuardChecks('radio', `${PLUGIN_GRAPH}<div id="root"></div>`, {
    agendaAttendu: true,
    agendaAVenir: true,
  })
  assert.deepEqual(failed(enCi), ['le graphe du plugin est absent', 'aucun Event sur /radio'])
})
