// Purge horaire des salles du mode ami — la partie PURE ; le réseau est dans
// scripts/salles-purge.mjs. Décidé par Nareg le 11 nov. 2026 : les salles
// s'effacent d'elles-mêmes (spec 2026-11-11-onglet-jeux-design.md,
// « Effacement des salles »).

// La même valeur que public/play/net/protocole.js (PEREMPTION_MS) et que les
// règles (database.rules.json, 86400000). Recopiée plutôt qu'importée : ce
// script tourne en CI, et protocole.js est une copie de lokolok que
// `npm run jeux:sync` peut réécrire. test/salles-purge.test.mjs compare les deux.
export const PEREMPTION_MS = 24 * 60 * 60 * 1000

export const JEUX = ['echecs', 'backgammon']

// Portées OAuth2 qu'exige l'API REST de la Realtime Database pour un jeton
// d'accès de compte de service.
export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/firebase.database',
]

export const BASE_PROD = 'https://armenie-info-default-rtdb.europe-west1.firebasedatabase.app'

const objet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Les codes à effacer : `creeLe` vieux de PLUS de 24 h (strict, comme
// estPerimee), ou absent / non numérique — une salle sans horodatage lisible
// est morte pour le client comme pour les règles. Une entrée qui n'est pas un
// objet n'est pas une salle : ignorée.
export function sallesPerimees(salles, maintenant) {
  if (!objet(salles)) return []
  return Object.entries(salles)
    .filter(([, s]) => objet(s) && (typeof s.creeLe !== 'number' || maintenant - s.creeLe > PEREMPTION_MS))
    .map(([code]) => code)
}

// Une lecture `shallow=true` rend `true` pour un enfant objet, et la valeur
// elle-même pour un enfant primitif. Seuls les objets hors du premier lot
// (lecture orderBy) restent à vérifier un par un.
export function codesAVerifier(shallow, dejaVus) {
  if (!objet(shallow)) return []
  const vus = new Set(dejaVus)
  return Object.entries(shallow).filter(([code, v]) => v === true && !vus.has(code)).map(([code]) => code)
}

// `cible` : { base, ns? } — `ns` pour l'émulateur (?ns=armenie-info-default-rtdb).
export function urlSalles(cible, jeu, requete = {}, sousChemin = '') {
  const base = cible.base.replace(/\/+$/, '')
  const chemin = `salles/${jeu}` + (sousChemin ? `/${sousChemin}` : '')
  const q = new URLSearchParams(requete)
  if (cible.ns) q.set('ns', cible.ns)
  const s = q.toString()
  return `${base}/${chemin}.json` + (s ? `?${s}` : '')
}
