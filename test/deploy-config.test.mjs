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
  // Les lignes ont la forme `site|projet|chemin-du-credential`.
  const lignes = workflow
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[a-z0-9-]+\|[a-z0-9-]+\|\$RUNNER_TEMP\//.test(l))

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

test('chaque vitrine a un secret de déploiement distinct dans le workflow', () => {
  // Deux projets Firebase ⇒ deux comptes de service : celui de l'un n'a aucun
  // droit sur l'autre. Un seul secret pour les deux échouerait à l'exécution,
  // sur une erreur d'autorisation qui ne dirait pas laquelle des deux vitrines
  // a échoué ni pourquoi.
  const secrets = [...workflow.matchAll(/secrets\.(FIREBASE_SERVICE_ACCOUNT_[A-Z_]+)/g)].map(
    (m) => m[1],
  )
  const uniques = [...new Set(secrets)]
  assert.equal(
    uniques.length,
    Object.keys(SITES).length,
    `${uniques.length} secret(s) Firebase pour ${Object.keys(SITES).length} vitrine(s) : ${uniques}`,
  )

  // Et chacun doit être réellement vérifié avant le premier déploiement.
  for (const s of uniques) {
    assert.ok(
      workflow.includes('FIREBASE_SA_' + s.replace('FIREBASE_SERVICE_ACCOUNT_', '')),
      `${s} n'est pas relié à une variable FIREBASE_SA_* gardée`,
    )
  }
})
