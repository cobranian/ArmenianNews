// Échecs, mode ami — la pendule. Pur : l'heure est toujours passée en
// argument (`maintenant`, `debut`, `ecoule`), jamais lue ici. Testé par
// test.pendule.js.

import { materielInsuffisant } from './partie.js';

// Temps par joueur, en secondes, sans incrément. 0 : sans pendule.
export const CADENCES = [0, 60, 180, 300, 600, 1800];
export const NOM_CADENCE = {
  0: 'Sans pendule',
  60: 'Bullet 1 min',
  180: 'Blitz 3 min',
  300: 'Blitz 5 min',
  600: 'Rapide 10 min',
  1800: 'Rapide 30 min',
};
// Salles v3 (heure serveur) : chaque coup rend jusqu'à 300 ms, la latence de
// son écriture (un coup qui a pris moins ne gagne rien).
export const CREDIT_MS = 300;

const deux = (n) => String(n).padStart(2, '0');

// mm:ss ; sous 10 s, mm:ss,d (dixièmes, arrondis vers le bas).
export function formatTemps(ms) {
  const t = Math.max(0, Math.floor(ms));
  if (t < 10000) {
    const d = Math.floor(t / 100);
    return `00:${deux(Math.floor(d / 10))},${d % 10}`;
  }
  const s = Math.floor(t / 1000);
  return `${deux(Math.floor(s / 60))}:${deux(s % 60)}`;
}

// Le temps qu'affiche une pendule : `reste` au début du tour, moins le temps
// écoulé depuis `debut` si elle tourne. Peut être négatif (drapeau tombé).
export const restant = ({ reste, tourne, debut, maintenant }) => (tourne ? reste - (maintenant - debut) : reste);

// À chaque tic, la pendule au trait. La mienne (`reste`, à l'heure serveur
// estimée) passée sous -`marge` : je publie ma défaite (`drapeau`). En v3, la
// marge est le crédit : c'est la limite du serveur, et les 300 dernières ms
// affichées à 0 restent jouables.
// Celle de l'ami, en v3 : `ecoule` est une borne BASSE du temps écoulé à
// l'heure serveur depuis le début de son tour (horloge locale lancée à la
// réception de l'heure de ce début, qui lui est forcément postérieure) ; au-delà
// de son temps au début du tour (`resteTour`) plus le crédit, une réclamation
// écrite maintenant sera datée après sa limite : 'reclamer'. En v2 (pas
// d'`ecoule`), à 0 depuis plus de 10 s : il ne répond plus (`muet`, bandeau).
export const SILENCE_MS = 10000;
export function verdictPendule({ trait, moi, reste, ecoule = null, resteTour = null, marge = 0 }) {
  if (trait === moi) return reste <= -marge ? 'drapeau' : null;
  if (ecoule !== null) return ecoule > resteTour + CREDIT_MS ? 'reclamer' : null;
  return reste < -SILENCE_MS ? 'muet' : null;
}

// Le camp a-t-il de quoi mater ? Ses pièces seules, avec les deux rois, passées
// à la règle du matériel insuffisant de partie.js.
export function peutMater(pos, camp) {
  const blanc = camp === 'w';
  const cases = pos.cases.map((l) => {
    if (!l || l.toUpperCase() === 'K') return l;
    return (l === l.toUpperCase()) === blanc ? l : '';
  });
  return !materielInsuffisant({ ...pos, cases });
}

// Le choix de l'hôte, gardé pour la prochaine salle.
export function lireCadence(texte) {
  const c = CADENCES.find((x) => String(x) === texte);
  return c === undefined ? 0 : c;
}
