// Purge horaire des salles du mode ami (scripts/lib/salles-purge.mjs) : une
// salle de plus de 24 h, ou sans `creeLe` lisible, est effacée ; une salle
// plus jeune est gardée. Le seuil DOIT être celui du client
// (public/play/net/protocole.js) : un seuil plus court effacerait une partie
// encore jouable, un seuil plus long garderait des données que la
// confidentialité dit effacées.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PEREMPTION_MS as CLIENT } from '../public/play/net/protocole.js'
import { PEREMPTION_MS, JEUX, sallesPerimees, codesAVerifier, urlSalles, SCOPES } from '../scripts/lib/salles-purge.mjs'

const H = 60 * 60 * 1000
const M = 60 * 1000
const MAINTENANT = Date.UTC(2026, 10, 11, 12)

test('le seuil est celui de protocole.js (24 h)', () => {
  assert.equal(PEREMPTION_MS, CLIENT)
  assert.equal(PEREMPTION_MS, 86_400_000)
})

test('sallesPerimees : 23 h 59 gardée, 24 h 01 effacée, sans creeLe effacée, non-objet ignoré', () => {
  const salles = {
    JEUNE2: { creeLe: MAINTENANT - (23 * H + 59 * M) },
    VIEIL2: { creeLe: MAINTENANT - (24 * H + 1 * M) },
    SANSCR: { jeu: 'echecs' },
    TEXTE2: { creeLe: '2026-11-01' },
    PRIMIT: 'pas un objet',
    NOMBRE: 42,
    NULLE2: null,
  }
  assert.deepEqual(sallesPerimees(salles, MAINTENANT).sort(), ['SANSCR', 'TEXTE2', 'VIEIL2'])
})

test('sallesPerimees : pile 24 h est gardée (même règle stricte que estPerimee)', () => {
  assert.deepEqual(sallesPerimees({ PILE24: { creeLe: MAINTENANT - PEREMPTION_MS } }, MAINTENANT), [])
})

test('sallesPerimees : base vide ou absente', () => {
  assert.deepEqual(sallesPerimees(null, MAINTENANT), [])
  assert.deepEqual(sallesPerimees(undefined, MAINTENANT), [])
  assert.deepEqual(sallesPerimees({}, MAINTENANT), [])
})

test('codesAVerifier : seuls les objets (shallow = true) hors du premier lot', () => {
  const shallow = { AAAAAA: true, BBBBBB: true, CCCCCC: 'texte', DDDDDD: 5 }
  assert.deepEqual(codesAVerifier(shallow, ['AAAAAA']), ['BBBBBB'])
  assert.deepEqual(codesAVerifier(null, []), [])
})

test('urlSalles : chemin, requête et namespace d’émulateur', () => {
  const prod = 'https://armenie-info-default-rtdb.europe-west1.firebasedatabase.app'
  assert.equal(urlSalles({ base: prod }, 'echecs', { shallow: 'true' }), `${prod}/salles/echecs.json?shallow=true`)
  const u = new URL(urlSalles({ base: 'http://127.0.0.1:9000', ns: 'armenie-info-default-rtdb' }, 'backgammon', { orderBy: '"creeLe"', endAt: '5' }))
  assert.equal(u.pathname, '/salles/backgammon.json')
  assert.equal(u.searchParams.get('orderBy'), '"creeLe"')
  assert.equal(u.searchParams.get('endAt'), '5')
  assert.equal(u.searchParams.get('ns'), 'armenie-info-default-rtdb')
  assert.equal(urlSalles({ base: prod + '/' }, 'echecs', {}, 'K7KQ4N/creeLe'), `${prod}/salles/echecs/K7KQ4N/creeLe.json`)
})

test('les deux jeux, et les portées OAuth de la Realtime Database', () => {
  assert.deepEqual(JEUX, ['echecs', 'backgammon'])
  assert.deepEqual(SCOPES, [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/firebase.database',
  ])
})

test('database.rules.json indexe creeLe sous salles/$jeu', () => {
  const r = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'))
  assert.deepEqual(r.rules.salles.$jeu['.indexOn'], ['creeLe'])
})

// La purge passe AVANT le contrôle de santé, pour qu'un échec (rôle IAM
// retiré, clé révoquée) remonte dans l'issue [sources-down] au lieu de ne
// vivre qu'au log. continue-on-error : elle ne retient jamais le déploiement.
test('hourly.yml : purge en continue-on-error, avant la santé qui lit son résultat', () => {
  const y = readFileSync(new URL('../.github/workflows/hourly.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const p = y.indexOf('- name: Effacer les salles de jeu')
  const h = y.indexOf('- name: Contrôler la fraîcheur des sources')
  assert.ok(p > 0 && h > p, 'la purge précède la santé')
  const etape = y.slice(p, h)
  assert.match(etape, /id: purge\n/)
  assert.match(etape, /continue-on-error: true\n/)
  assert.match(etape, /FIREBASE_SERVICE_ACCOUNT: \$\{\{ secrets\.FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO \}\}/)
  assert.match(etape, /run: node scripts\/salles-purge\.mjs/)
  assert.doesNotMatch(etape, /echo[^\n]*FIREBASE_SERVICE_ACCOUNT/, 'le secret n’est jamais affiché')
  assert.match(y.slice(h), /PURGE_OUTCOME: \$\{\{ steps\.purge\.outcome \}\}/)
})

// Un secret mal formé : JSON.parse citerait un morceau de l'entrée dans son
// message (Node ≥ 20), donc un morceau de la clé privée au log public.
test('secret illisible : message générique, rien de l’entrée au log, code 1', () => {
  const script = fileURLToPath(new URL('../scripts/salles-purge.mjs', import.meta.url))
  for (const secret of ['{"private_key":"CLE-SECRETE-XYZ",', 'CLE-SECRETE-XYZ', '{"client_email":"CLE-SECRETE-XYZ"}']) {
    const env = { ...process.env, FIREBASE_SERVICE_ACCOUNT: secret, SALLES_BASE_URL: 'http://127.0.0.1:1' }
    delete env.SALLES_JETON
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8', env })
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stdout, /^✗ purge : secret du compte de service illisible$/m)
    assert.ok(!(r.stdout + r.stderr).includes('CLE-SECRETE-XYZ'), 'le secret a fuité')
  }
})
