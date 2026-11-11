// Sauvegarde de la partie contre le robot : lecture avec validation complète.
// Le texte vient de localStorage, donc de n'importe qui : rien n'est cru sur parole.

import { issue } from './rules.js';
import { peutDoubler } from './match.js';

// Même liste que robot.js (dupliquée pour que ce module reste autonome).
const NIVEAUX = ['facile', 'moyen', 'fort'];
const PHASES = ['ouverture', 'lancer', 'double', 'deplacer', 'fin-manche', 'fin-match'];
const CRAWFORD = ['avant', 'pendant', 'apres'];
const JOUEURS = ['b', 'n'];

const objet = (v) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};
const entier = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const zero = (n) => (n === 0 ? 0 : n); // évite -0

function lirePosition(pos) {
  if (!objet(pos) || !Array.isArray(pos.points) || pos.points.length !== 24) return null;
  if (!objet(pos.barre) || !objet(pos.sortis)) return null;
  const barre = {};
  const sortis = {};
  for (const j of JOUEURS) {
    if (!entier(pos.barre[j], 0, 15) || !entier(pos.sortis[j], 0, 15)) return null;
    barre[j] = pos.barre[j];
    sortis[j] = pos.sortis[j];
  }
  const points = [];
  const total = { b: barre.b + sortis.b, n: barre.n + sortis.n };
  for (const v of pos.points) {
    if (!entier(v, -15, 15)) return null;
    points.push(zero(v));
    if (v > 0) total.b += v;
    else total.n -= v;
  }
  if (total.b !== 15 || total.n !== 15) return null;
  return { points, barre, sortis };
}

function lireDes(des) {
  if (!Array.isArray(des) || !des.every((d) => entier(d, 1, 6))) return null;
  if (des.length === 2 && des[0] !== des[1]) return des.slice();
  if (des.length === 4 && des.every((d) => d === des[0])) return des.slice();
  return null;
}

export function partieCoherente(brut) {
  if (!objet(brut)) return null;
  const { longueur, phase, crawford } = brut;
  if (![1, 3, 5].includes(longueur)) return null;
  if (!PHASES.includes(phase) || !CRAWFORD.includes(crawford)) return null;
  if (typeof brut.videauActif !== 'boolean' || (longueur === 1 && brut.videauActif)) return null;
  if (longueur === 1 && crawford !== 'avant') return null;
  if (!entier(brut.manche, 1, 100000)) return null;

  // Score : sous la longueur, sauf en fin de match.
  if (!objet(brut.score)) return null;
  const finMatch = phase === 'fin-match';
  const max = finMatch ? longueur + 192 : longueur - 1;
  if (!entier(brut.score.b, 0, max) || !entier(brut.score.n, 0, max)) return null;
  const score = { b: brut.score.b, n: brut.score.n };
  if (finMatch && score.b < longueur && score.n < longueur) return null;

  // Videau.
  if (!objet(brut.cube)) return null;
  const { valeur, proprietaire } = brut.cube;
  if (![1, 2, 4, 8, 16, 32, 64].includes(valeur)) return null;
  if (proprietaire !== null && !JOUEURS.includes(proprietaire)) return null;
  const cube = { valeur, proprietaire };

  // Trait et dés.
  const trait = brut.trait;
  if (trait !== null && !JOUEURS.includes(trait)) return null;
  if (phase !== 'ouverture' && trait === null) return null;
  if (phase === 'double' && proprietaire !== null && proprietaire !== trait) return null;
  let des = null;
  if (phase === 'deplacer') {
    des = lireDes(brut.des);
    if (!des) return null;
  } else if (brut.des !== null) {
    return null;
  }

  const position = lirePosition(brut.position);
  if (!position) return null;
  const fini = issue(position);
  if (fini && (phase === 'lancer' || phase === 'deplacer' || phase === 'double')) return null;

  // Résultat.
  let resultat = null;
  if (phase === 'fin-manche' || phase === 'fin-match') {
    const r = brut.resultat;
    if (!objet(r) || !JOUEURS.includes(r.gagnant) || !entier(r.type, 1, 3)) return null;
    if (typeof r.refus !== 'boolean' || r.points !== r.type * valeur) return null;
    if (r.refus ? r.type !== 1 : !fini || fini.gagnant !== r.gagnant || fini.type !== r.type) return null;
    resultat = { gagnant: r.gagnant, type: r.type, points: r.points, refus: r.refus };
  } else if (brut.resultat !== null) {
    return null;
  }

  const partie = {
    longueur,
    videauActif: brut.videauActif,
    score,
    crawford,
    manche: brut.manche,
    cube,
    position,
    trait,
    phase,
    des,
    resultat,
  };
  // Un double n'est en cours que si le doubleur pouvait doubler avant de lancer.
  if (phase === 'double' && !peutDoubler({ ...partie, phase: 'lancer' })) return null;
  // La manche Crawford : exactement un joueur à un point du match (hors fin de manche).
  if (crawford === 'pendant' && !(phase === 'fin-manche' || finMatch)) {
    const enJeu = (j) => score[j] === longueur - 1;
    if (enJeu('b') === enJeu('n')) return null;
  }
  return partie;
}

export function lirePartie(texte) {
  let brut;
  try {
    brut = JSON.parse(texte);
  } catch {
    return null;
  }
  if (!objet(brut) || !NIVEAUX.includes(brut.niveau)) return null;
  const partie = partieCoherente(brut.partie);
  return partie ? { niveau: brut.niveau, partie } : null;
}

export function ecrirePartie({ niveau, partie }) {
  return JSON.stringify({ niveau, partie });
}
