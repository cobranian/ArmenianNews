// Match de backgammon : manches, videau, règle de Crawford. Module pur.
//
// Partie = { longueur: 1|3|5, videauActif, score: {b, n}, crawford, manche,
//            cube: {valeur, proprietaire}, position, trait, phase, des,
//            resultat }.
// Aucune fonction ne modifie son entrée : chacune rend une nouvelle Partie.

import {
  adversaire, positionInitiale, desDuLancer, toursLegaux, appliquerTour, issue,
} from './rules.js';

const copie = (p) => ({
  ...p,
  score: { ...p.score },
  cube: { ...p.cube },
  position: {
    points: p.position.points.slice(),
    barre: { ...p.position.barre },
    sortis: { ...p.position.sortis },
  },
  des: p.des ? p.des.slice() : null,
  resultat: p.resultat ? { ...p.resultat } : null,
});

const exigerPhase = (p, phase) => {
  if (p.phase !== phase) throw new Error(`Phase « ${p.phase} » : « ${phase} » attendue`);
};

const exigerDe = (d) => {
  if (!Number.isInteger(d) || d < 1 || d > 6) throw new Error(`Dé invalide : ${d}`);
};

export function nouveauMatch({ longueur, videau }) {
  if (![1, 3, 5].includes(longueur)) throw new Error(`Longueur invalide : ${longueur}`);
  return {
    longueur,
    videauActif: longueur > 1 && Boolean(videau),
    score: { b: 0, n: 0 },
    crawford: 'avant',
    manche: 1,
    cube: { valeur: 1, proprietaire: null },
    position: positionInitiale(),
    trait: null,
    phase: 'ouverture',
    des: null,
    resultat: null,
  };
}

export function ouverture(p, deBlanc, deNoir) {
  exigerPhase(p, 'ouverture');
  exigerDe(deBlanc);
  exigerDe(deNoir);
  if (deBlanc === deNoir) return p;
  const q = copie(p);
  q.trait = deBlanc > deNoir ? 'b' : 'n';
  q.des = [deBlanc, deNoir];
  q.phase = 'deplacer';
  return q;
}

export function lancer(p, d1, d2) {
  exigerPhase(p, 'lancer');
  exigerDe(d1);
  exigerDe(d2);
  const q = copie(p);
  q.des = desDuLancer(d1, d2);
  q.phase = 'deplacer';
  return q;
}

const memePas = (a, b) => a.depuis === b.depuis && a.vers === b.vers && a.de === b.de;

// Termine la manche : `gagnant` marque `points`, fin de match si la longueur est atteinte.
function finir(q, gagnant, type, refus, abandon = false) {
  const points = type * q.cube.valeur;
  q.resultat = { gagnant, type, points, refus };
  if (abandon) q.resultat.abandon = true;
  q.score[gagnant] += points;
  q.des = null;
  q.trait = gagnant;
  q.phase = q.score[gagnant] >= q.longueur ? 'fin-match' : 'fin-manche';
  return q;
}

export function jouerTour(p, tour) {
  exigerPhase(p, 'deplacer');
  if (!Array.isArray(tour)) throw new Error('Tour invalide');
  const legal = toursLegaux(p.position, p.trait, p.des).some(
    (t) => t.length === tour.length && t.every((pas, i) => tour[i] && memePas(pas, tour[i])),
  );
  if (!legal) throw new Error('Tour illégal ou incomplet');
  const q = copie(p);
  q.position = appliquerTour(p.position, p.trait, tour);
  const fin = issue(q.position);
  if (fin) return finir(q, fin.gagnant, fin.type, false);
  q.trait = adversaire(p.trait);
  q.des = null;
  q.phase = 'lancer';
  return q;
}

export function peutDoubler(p) {
  return p.phase === 'lancer'
    && p.videauActif === true
    && (p.trait === 'b' || p.trait === 'n')
    && p.crawford !== 'pendant'
    && (p.cube.proprietaire === null || p.cube.proprietaire === p.trait)
    && p.cube.valeur < 64
    && p.score[p.trait] + p.cube.valeur < p.longueur;
}

export function doubler(p) {
  if (!peutDoubler(p)) throw new Error('Doubler impossible');
  const q = copie(p);
  q.phase = 'double';
  return q;
}

export function accepter(p) {
  exigerPhase(p, 'double');
  const q = copie(p);
  q.cube = { valeur: p.cube.valeur * 2, proprietaire: adversaire(p.trait) };
  q.phase = 'lancer';
  return q;
}

export function refuser(p) {
  exigerPhase(p, 'double');
  return finir(copie(p), p.trait, 1, true);
}

export function mancheSuivante(p) {
  exigerPhase(p, 'fin-manche');
  const q = copie(p);
  const enJeu = (j) => p.score[j] === p.longueur - 1;
  if (p.longueur > 1) {
    if (p.crawford === 'avant' && enJeu('b') !== enJeu('n')) q.crawford = 'pendant';
    else if (p.crawford === 'pendant') q.crawford = 'apres';
  }
  q.position = positionInitiale();
  q.cube = { valeur: 1, proprietaire: null };
  q.trait = null;
  q.des = null;
  q.resultat = null;
  q.phase = 'ouverture';
  q.manche = p.manche + 1;
  return q;
}

// Le joueur qui devait agir ne joue plus : `gagnant` (son adversaire) remporte
// la manche à la valeur du videau, sans gammon. Mode ami seulement.
export function abandon(p, gagnant) {
  if (!['ouverture', 'lancer', 'deplacer', 'double'].includes(p.phase)) throw new Error('Rien à abandonner');
  if (gagnant !== 'b' && gagnant !== 'n') throw new Error('Gagnant invalide');
  return finir(copie(p), gagnant, 1, false, true);
}
