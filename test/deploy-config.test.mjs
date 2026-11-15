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
  // Les lignes ont la forme `site|projet|variable de sa clé`.
  const lignes = workflow
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[a-z0-9-]+\|[a-z0-9-]+\|[A-Z_]+$/.test(l))

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

// L'étape de déploiement seule, de son nom à l'étape suivante.
const etapeDeploiement = (() => {
  const w = workflow.replace(/\r\n/g, '\n')
  const d = w.indexOf('- name: Deploy to Firebase Hosting')
  assert.ok(d > 0, 'étape de déploiement introuvable')
  const f = w.indexOf('\n      - name:', d + 1)
  return w.slice(d, f > 0 ? f : undefined)
})()

test('une clé par vitrine : chaque site se déploie avec SA clé, jamais celle du voisin', () => {
  // Cloisonnement du 11 nov. 2026 : une clé unique portait Hosting Admin sur
  // les deux projets ET Realtime Database Admin. Une fuite livrait tout.
  // Chaque vitrine a désormais son secret, Hosting Admin sur son seul projet.
  const lignes = etapeDeploiement
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[a-z0-9-]+\|[a-z0-9-]+\|[A-Z_]+$/.test(l))
    .map((l) => l.split('|'))
  const vars = lignes.map((l) => l[2])
  assert.equal(new Set(vars).size, lignes.length, 'deux vitrines partagent la même clé')
  for (const v of vars) {
    assert.match(
      etapeDeploiement,
      new RegExp(`\\b${v}: \\$\\{\\{ secrets\\.FIREBASE_SERVICE_ACCOUNT_[A-Z]+ \\}\\}`),
      `${v} n'est alimentée par aucun secret`,
    )
  }
  const secrets = [...etapeDeploiement.matchAll(/secrets\.(FIREBASE_SERVICE_ACCOUNT_[A-Z_]+)/g)].map((m) => m[1])
  assert.equal(new Set(secrets).size, lignes.length, 'un secret par vitrine, pas plus, pas moins')
  // firebase-tools ne doit voir aucune des clés en variable d'environnement.
  assert.match(etapeDeploiement, new RegExp(`env ${vars.map((v) => `-u ${v}`).join(' ')} npx`))
})

test('la clé de la purge ne sert qu’à la purge, et l’ancienne clé commune a disparu', () => {
  // « Realtime Database Admin » contourne les règles de toute la base : sa clé
  // ne doit jamais atteindre le déploiement, ni une clé de déploiement la purge.
  assert.doesNotMatch(workflow, /FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO/, 'l’ancienne clé commune est encore référencée')
  assert.doesNotMatch(etapeDeploiement, /FIREBASE_SERVICE_ACCOUNT_PURGE/)
  const usages = [...workflow.matchAll(/secrets\.FIREBASE_SERVICE_ACCOUNT_PURGE/g)]
  assert.equal(usages.length, 1, 'la clé de purge sert ailleurs que dans la purge')
})

test('le credential de déploiement est vérifié avant la première commande', () => {
  // Tout secret Firebase de l'étape est contrôlé non vide avant que la
  // première commande de déploiement ne parte, faute de quoi l'échec arrive
  // plus tard sous forme d'erreur d'authentification opaque.
  const gardes = [...etapeDeploiement.matchAll(/if \[ -z "\$\{?!?([A-Z_]+)\}?" \]/g)].map((m) => m[1])
  const enGarde = [...etapeDeploiement.matchAll(/([A-Z_]+): \$\{\{ secrets\.FIREBASE_SERVICE_ACCOUNT/g)].map(
    (m) => m[1],
  )
  assert.ok(enGarde.length >= 1, 'aucun secret Firebase dans l’étape de déploiement')
  for (const v of enGarde) {
    assert.ok(
      gardes.includes(v),
      `${v} porte un secret Firebase mais n'est pas contrôlé non vide avant le déploiement`,
    )
  }
})
