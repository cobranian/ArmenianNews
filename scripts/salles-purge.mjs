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

async function appel(methode, url, jeton, corps) {
  const res = await fetch(url, {
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

// cible : { base, ns? } ; rend le nombre de salles effacées.
export async function purger({ base = BASE_PROD, ns, jeton, maintenant = Date.now(), journal = console.log } = {}) {
  const cible = { base, ns }
  let total = 0
  for (const jeu of JEUX) {
    // 1. Les salles dont creeLe ≤ maintenant − 24 h (index creeLe, règles).
    let lot = {}
    try {
      lot = await appel('GET', urlSalles(cible, jeu, { orderBy: '"creeLe"', endAt: String(maintenant - PEREMPTION_MS) }), jeton) ?? {}
    } catch (e) {
      // Règles sans `.indexOn` (pas encore déployées) : la base refuse le
      // tri. Tout passe alors par la lecture salle par salle — plus lent,
      // même résultat.
      if (e.statut !== 400 || !/index/i.test(e.texte ?? '')) throw e
      journal(`· purge/${jeu} : index creeLe absent des règles en ligne — lecture salle par salle`)
    }
    const aEffacer = new Set(sallesPerimees(lot, maintenant))

    // 2. Ce que le tri ne garantit pas (creeLe absent ou non numérique) : la
    // liste des codes, puis creeLe seul, pour les codes absents du premier lot.
    const shallow = await appel('GET', urlSalles(cible, jeu, { shallow: 'true' }), jeton)
    for (const code of codesAVerifier(shallow, Object.keys(lot ?? {}))) {
      const creeLe = await appel('GET', urlSalles(cible, jeu, {}, `${code}/creeLe`), jeton)
      for (const c of sallesPerimees({ [code]: { creeLe: creeLe ?? undefined } }, maintenant)) aEffacer.add(c)
    }

    // 3. Un PATCH à null par paquet de 200 codes.
    const codes = [...aEffacer]
    for (let i = 0; i < codes.length; i += 200) {
      const corps = Object.fromEntries(codes.slice(i, i + 200).map((c) => [c, null]))
      await appel('PATCH', urlSalles(cible, jeu), jeton, corps)
    }
    if (codes.length) journal(`· purge/${jeu} : ${codes.length} salle(s) effacée(s)`)
    total += codes.length
  }
  return total
}

async function main() {
  let jeton = process.env.SALLES_JETON
  if (!jeton) {
    const sa = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
    if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT absent')
    jeton = await jetonOAuth(sa)
  }
  const n = await purger({ base: process.env.SALLES_BASE_URL || BASE_PROD, ns: process.env.SALLES_NS || undefined, jeton })
  console.log(`purge : ${n} salle(s) effacée(s)`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.log(`✗ purge : ${e.message}`)
    process.exitCode = 1
  })
}
