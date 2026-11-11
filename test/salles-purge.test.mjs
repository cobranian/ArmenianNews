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
  assert.match(etape, /FIREBASE_SERVICE_ACCOUNT: \$\{\{ secrets\.FIREBASE_SERVICE_ACCOUNT_PURGE \}\}/)
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

// purger() contre une fausse base (fetch injecté) : même un serveur qui
// rendrait à tort une jeune dans le lot trié (réponse mal formée, endAt mal
// lu) ne la fait jamais effacer — sallesPerimees refiltre. Un lot sans
// périmée ne coûte aucun PATCH, et le PATCH vise exactement salles/<jeu>.json.
function fausseBase(lots) {
  const appels = []
  const f = async (url, init = {}) => {
    const u = new URL(url)
    const methode = init.method ?? 'GET'
    appels.push({ methode, chemin: u.pathname, requete: u.searchParams, corps: init.body ? JSON.parse(init.body) : undefined })
    const jeu = u.pathname.match(/^\/salles\/(\w+)\.json$/)?.[1]
    const corps = methode === 'GET' ? (lots[jeu] ?? null) : {}
    return new Response(JSON.stringify(corps), { status: 200 })
  }
  return { appels, f }
}

test('purger : une jeune rendue à tort par la base n’est jamais dans le PATCH', async () => {
  const { purger } = await import('../scripts/salles-purge.mjs')
  const lots = {
    echecs: {
      VIEIL1: { creeLe: MAINTENANT - 30 * H },
      SANSCR: { jeu: 'echecs' },
      JEUNE1: { creeLe: MAINTENANT - (23 * H + 59 * M) }, // 23 h 59 : hors de endAt, rendue à tort
      JEUNE2: { creeLe: MAINTENANT - H },
    },
    backgammon: { VIEIL2: { creeLe: MAINTENANT - 25 * H } },
  }
  const { appels, f } = fausseBase(lots)
  const n = await purger({ base: 'https://exemple.test', jeton: 'x', maintenant: MAINTENANT, journal: () => {}, fetch: f })
  assert.equal(n, 3)
  const gets = appels.filter((a) => a.methode === 'GET')
  assert.equal(gets.length, 2, 'un GET trié par jeu, ni shallow ni lecture salle par salle')
  for (const g of gets) {
    assert.equal(g.requete.get('orderBy'), '"creeLe"')
    assert.equal(g.requete.get('endAt'), String(MAINTENANT - PEREMPTION_MS))
    assert.equal(g.requete.get('limitToFirst'), '500')
    assert.equal(g.requete.get('startAt'), null)
  }
  const patchs = appels.filter((a) => a.methode === 'PATCH')
  assert.deepEqual(patchs.map((p) => p.chemin), ['/salles/echecs.json', '/salles/backgammon.json'])
  assert.deepEqual(patchs[0].corps, { VIEIL1: null, SANSCR: null })
  assert.deepEqual(patchs[1].corps, { VIEIL2: null })
  for (const p of patchs) assert.ok(!('JEUNE1' in p.corps) && !('JEUNE2' in p.corps))
})

test('purger : rien à effacer, aucun PATCH', async () => {
  const { purger } = await import('../scripts/salles-purge.mjs')
  for (const lots of [{}, { echecs: { JEUNE1: { creeLe: MAINTENANT - H } }, backgammon: {} }]) {
    const { appels, f } = fausseBase(lots)
    assert.equal(await purger({ base: 'https://exemple.test', jeton: 'x', maintenant: MAINTENANT, journal: () => {}, fetch: f }), 0)
    assert.deepEqual(appels.filter((a) => a.methode !== 'GET'), [])
  }
})

test('purger : lot plein = plafond atteint, signalé au log', async () => {
  const { purger } = await import('../scripts/salles-purge.mjs')
  const { f } = fausseBase({ echecs: { A: { creeLe: 1 }, B: { creeLe: 2 } }, backgammon: {} })
  const journal = []
  assert.equal(await purger({ base: 'https://exemple.test', jeton: 'x', maintenant: MAINTENANT, journal: (l) => journal.push(l), fetch: f, plafond: 2 }), 2)
  assert.ok(journal.some((l) => /purge\/echecs : plafond de 2 salles atteint/.test(l)), journal.join('\n'))
})
