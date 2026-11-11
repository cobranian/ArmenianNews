// Purge horaire des salles du mode ami : efface de la Realtime Database
// `armenie-info-default-rtdb` les salles de plus de 24 h, et celles sans
// `creeLe` lisible. La partie pure est dans scripts/lib/salles-purge.mjs.
//
//   node scripts/salles-purge.mjs        (hourly.yml, étape « Effacer les salles de jeu »)
//
// Identité : le compte de service de la CI (secret
// FIREBASE_SERVICE_ACCOUNT_ARMENIE_INFO, passé en FIREBASE_SERVICE_ACCOUNT),
// qui doit porter le rôle « Firebase Realtime Database Admin » sur
// `armenie-info`. Sans ce rôle, la base répond 401/403 : le seul signe est
// « ✗ purge » au log, et la ligne « effacement des salles » de l'issue
// [sources-down]. Code de sortie 1 en cas d'échec — l'étape est en
// continue-on-error, le déploiement n'est jamais retenu.
//
// Contre l'émulateur (essai à la main, test/regles/purge.test.js) :
//   SALLES_BASE_URL=http://127.0.0.1:9000 SALLES_NS=armenie-info-default-rtdb \
//   SALLES_JETON=owner node scripts/salles-purge.mjs
// SALLES_JETON remplace l'échange OAuth2 (« owner » = administrateur de
// l'émulateur). Le jeton ne part que dans l'en-tête Authorization, jamais
// dans une URL ni au log.
import { pathToFileURL } from 'node:url'
import { parseServiceAccount, jwtAssertion, TOKEN_URL } from './lib/gsc.mjs'
import { JEUX, SCOPES, BASE_PROD, PEREMPTION_MS, sallesPerimees, codesAVerifier, urlSalles } from './lib/salles-purge.mjs'

const DELAI = 30_000

async function jetonOAuth(sa) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtAssertion(sa, undefined, SCOPES.join(' ')),
    }),
    signal: AbortSignal.timeout(DELAI),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) throw new Error(`jeton refusé : HTTP ${res.status} ${body.error ?? ''} ${body.error_description ?? ''}`.trim())
  return body.access_token
}


// Repli sans index : au plus PLAFOND salles relues une par une, par jeu et
// par passage ; le reste attend le passage suivant.
export const PLAFOND = 500

function melanger(t) {
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]]
  }
  return t
}

const sansIndex = (e) => e.statut === 400 && /index/i.test(e.texte ?? '')

// cible : { base, ns? } ; rend le nombre de salles effacées.
//
// Deux lectures triées par creeLe couvrent TOUTES les salles, parce que
// l'ordre de la Realtime Database est total : null (creeLe absent), false,
// true, nombres, chaînes, objets. `endAt=<limite>` rend null → nombres ≤
// limite (les vieilles et celles sans creeLe) ; `startAt=<limite+1>` rend
// nombres > limite → chaînes → objets (les jeunes, et celles à creeLe non
// numérique). Une jeune n'est donc jamais relue à part. La lecture shallow
// ne sert plus que de filet : un code absent des deux lots (salle écrite
// entre les lectures) est relu seul.
export async function purger({
  base = BASE_PROD, ns, jeton, maintenant = Date.now(), journal = console.log,
  fetch: f = globalThis.fetch, plafond = PLAFOND,
} = {}) {
  const appel = async (methode, url, corps) => {
    const res = await f(url, {
      method: methode,
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(DELAI),
    })
    const texte = await res.text()
    if (!res.ok) {
      const e = new Error(`${methode} ${new URL(url).pathname} : HTTP ${res.status} ${texte.slice(0, 200)}`)
      e.statut = res.status
      e.texte = texte
      throw e
    }
    return texte ? JSON.parse(texte) : null
  }
  const cible = { base, ns }
  const limite = maintenant - PEREMPTION_MS
  let total = 0
  for (const jeu of JEUX) {
    // 1. Les deux lots triés (index creeLe des règles).
    let lot = {}
    let indexe = true
    try {
      const vieux = await appel('GET', urlSalles(cible, jeu, { orderBy: '"creeLe"', endAt: String(limite) }))
      const jeunes = await appel('GET', urlSalles(cible, jeu, { orderBy: '"creeLe"', startAt: String(limite + 1) }))
      lot = { ...(jeunes ?? {}), ...(vieux ?? {}) }
    } catch (e) {
      // Règles sans `.indexOn` (pas encore déployées) : la base refuse le tri.
      if (!sansIndex(e)) throw e
      indexe = false
      journal(`· purge/${jeu} : index creeLe absent des règles en ligne — lecture salle par salle`)
    }
    const aEffacer = new Set(sallesPerimees(lot, maintenant))

    // 2. Le filet (ou, sans index, tout) : la liste des codes, puis creeLe
    // seul pour les codes absents des lots — tirés au hasard et plafonnés,
    // pour que des jeunes relues à chaque passage ne bloquent pas le reste.
    const shallow = await appel('GET', urlSalles(cible, jeu, { shallow: 'true' }))
    const aVerifier = melanger(codesAVerifier(shallow, Object.keys(lot)))
    if (aVerifier.length > plafond) {
      journal(`· purge/${jeu} : ${aVerifier.length} salles à relire, ${aVerifier.length - plafond} restantes au passage suivant`)
    }
    if (indexe && aVerifier.length) journal(`· purge/${jeu} : ${aVerifier.length} salle(s) hors des lots triés, relue(s) une par une`)
    for (const code of aVerifier.slice(0, plafond)) {
      const creeLe = await appel('GET', urlSalles(cible, jeu, {}, `${code}/creeLe`))
      // creeLe vide : salle sans horodatage, ou enfant primitif (que le
      // shallow du parent rend aussi `true`, mesuré sur l'émulateur) —
      // le shallow de l'enfant tranche : un objet rend {clé: true}.
      const salle = creeLe === null ? await appel('GET', urlSalles(cible, jeu, { shallow: 'true' }, code)) : { creeLe }
      for (const c of sallesPerimees({ [code]: salle }, maintenant)) aEffacer.add(c)
    }

    // 3. Un PATCH à null par paquet de 200 codes.
    const codes = [...aEffacer]
    for (let i = 0; i < codes.length; i += 200) {
      const corps = Object.fromEntries(codes.slice(i, i + 200).map((c) => [c, null]))
      await appel('PATCH', urlSalles(cible, jeu), corps)
    }
    if (codes.length) journal(`· purge/${jeu} : ${codes.length} salle(s) effacée(s)`)
    total += codes.length
  }
  return total
}

// Le secret est une clé privée : un JSON.parse en échec citerait un morceau
// de l'entrée dans son message. Message générique, rien de l'entrée.
function compteDeService(brut) {
  let sa
  try {
    sa = parseServiceAccount(brut)
  } catch {
    throw new Error('secret du compte de service illisible')
  }
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT absent')
  return sa
}

async function main() {
  let jeton = process.env.SALLES_JETON
  if (!jeton) jeton = await jetonOAuth(compteDeService(process.env.FIREBASE_SERVICE_ACCOUNT))
  const n = await purger({ base: process.env.SALLES_BASE_URL || BASE_PROD, ns: process.env.SALLES_NS || undefined, jeton })
  console.log(`purge : ${n} salle(s) effacée(s)`)
}


if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.log(`✗ purge : ${e.message}`)
    process.exitCode = 1
  })
}
