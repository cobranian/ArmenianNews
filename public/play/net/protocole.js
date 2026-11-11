// Protocole des salles multijoueur — fonctions PURES, sans réseau ni DOM,
// partagées entre les jeux (via salle.js) et les tests Node du portail.
// Spec : docs/superpowers/specs/2026-09-20-lokolok-multijoueur-design.md.

// Alphabet sans ambiguïté : pas de O/0 ni de I/1, pour qu'un code se dicte
// au téléphone sans erreur. 32 caractères × 6 positions ≈ 10^9 combinaisons.
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 6;
export const PEREMPTION_MS = 24 * 60 * 60 * 1000;

export function genererCode(rng = Math.random) {
  let code = '';
  for (let i = 0; i < LONGUEUR_CODE; i++) {
    code += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  }
  return code;
}

export function codeValide(code) {
  return typeof code === 'string'
    && code.length === LONGUEUR_CODE
    && [...code].every((c) => ALPHABET.includes(c));
}

// `search` : location.search (« ?room=K7KQ4N&x=y »). La casse est tolérée à la
// saisie ; un code invalide rend null (le jeu démarre alors son menu normal).
export function codeDepuisUrl(search) {
  const code = (new URLSearchParams(search).get('room') || '').trim().toUpperCase();
  return codeValide(code) ? code : null;
}

export function urlSalle(origine, jeu, code) {
  return origine + '/play/' + jeu + '/?room=' + code;
}

// Une salle sans horodatage lisible est traitée comme morte : on peut
// l'écraser. Même règle côté serveur (database.rules.json).
export function estPerimee(creeLe, maintenant) {
  return typeof creeLe !== 'number' || (maintenant - creeLe) > PEREMPTION_MS;
}
