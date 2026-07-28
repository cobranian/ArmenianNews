import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITES } from '../sites.config.js'

// La correspondance site → projet → dossier publié vit à TROIS endroits, et
// rien ne les tenait d'accord :
//
//   sites.config.js        firebaseSite / firebaseProject  (documentaire)
//   firebase.json          hosting[].site / hosting[].public
//   hourly.yml             les lignes du here-doc de la boucle de déploiement
//
// Une divergence ne casse rien au build ni aux tests : elle se manifeste au
// déploiement, en publiant une vitrine dans le mauvais site — ou en échouant
// sur une erreur d'autorisation, puisque le credential suit le projet. Ces
// tests font des trois tables une seule affirmation vérifiable.
//
// Ils lisent firebase.json et hourly.yml comme des DONNÉES, sans les importer :
// ce sont des fichiers de configuration, pas des modules.

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8')
const firebase = JSON.parse(lire('../firebase.json'))
const workflow = lire('../.github/workflows/hourly.yml')

test('firebase.json publie exactement les vitrines de sites.config.js', () => {
  const attendu = Object.values(SITES)
    .map((s) => `${s.firebaseSite} → dist/${s.id}`)
    .sort()
  const reel = firebase.hosting.map((h) => `${h.site} → ${h.public}`).sort()
  assert.deepEqual(reel, attendu)
})

test('firebase.json désigne ses entrées par `site`, jamais par `target`', () => {
  // Les cibles se déclarent par projet dans .firebaserc ; avec deux projets il
  // faudrait deux tables cohérentes. Un nom de site est unique mondialement.
  for (const h of firebase.hosting) {
    assert.ok(h.site, `entrée sans site : ${JSON.stringify(h.public)}`)
    assert.equal(h.target, undefined, `entrée ${h.site} porte encore un target`)
  }
})

test('.firebaserc ne déclare plus de cibles hosting', () => {
  const rc = JSON.parse(lire('../.firebaserc'))
  assert.equal(rc.projects.default, 'armenie-info')
  assert.equal(rc.targets, undefined, '.firebaserc a retrouvé un bloc targets')
})

test('le here-doc de déploiement couvre chaque vitrine, avec son projet', () => {
  // Les lignes ont la forme `site|projet`.
  const lignes = workflow
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[a-z0-9-]+\|[a-z0-9-]+$/.test(l))

  assert.equal(
    lignes.length,
    Object.keys(SITES).length,
    `le here-doc a ${lignes.length} ligne(s) pour ${Object.keys(SITES).length} vitrine(s)`,
  )

  const reel = lignes.map((l) => l.split('|').slice(0, 2).join(' @ ')).sort()
  const attendu = Object.values(SITES)
    .map((s) => `${s.firebaseSite} @ ${s.firebaseProject}`)
    .sort()
  assert.deepEqual(reel, attendu)
})

test('le credential de déploiement est vérifié avant la première commande', () => {
  // UN SEUL secret dessert les DEUX projets : le compte de service appartient
  // à `armenie-info` et s'est vu accorder Firebase Hosting Admin sur
  // `armenia-news-b146e` aussi. Sans cette autorisation croisée, un compte de
  // service n'a de droits que sur son propre projet, et le déploiement du .org
  // échouerait sur une erreur d'autorisation.
  //
  // Ce test ne vérifie donc PAS un secret par vitrine — ce serait figer un
  // choix qui a changé. Il vérifie l'invariant qui, lui, tient dans les deux
  // modèles : tout secret Firebase utilisé est contrôlé non vide avant que la
  // première commande de déploiement ne parte, faute de quoi l'échec arrive
  // plus tard sous forme d'erreur d'authentification opaque.
  const secrets = [
    ...new Set(
      [...workflow.matchAll(/secrets\.(FIREBASE_SERVICE_ACCOUNT_[A-Z_]+)/g)].map((m) => m[1]),
    ),
  ]
  assert.ok(secrets.length >= 1, 'aucun secret Firebase référencé par le workflow')

  const gardes = [...workflow.matchAll(/if \[ -z "\$\{?!?([A-Z_]+)\}?" \]/g)].map((m) => m[1])
  const enGarde = [...workflow.matchAll(/([A-Z_]+): \$\{\{ secrets\.FIREBASE_SERVICE_ACCOUNT/g)].map(
    (m) => m[1],
  )
  for (const v of enGarde) {
    assert.ok(
      gardes.includes(v),
      `${v} porte un secret Firebase mais n'est pas contrôlé non vide avant le déploiement`,
    )
  }
})
