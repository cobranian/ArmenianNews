// La partie : positions successives, fins de partie, annulation, sauvegarde.
// Tout est immuable : chaque fonction renvoie une nouvelle partie.

import { FEN_INITIALE, depuisFEN, coupsLegaux, jouer, enEchec, versUCI, depuisUCI } from './rules.js';
import { san } from './san.js';

const NIVEAUX = ['facile', 'intermediaire', 'moyen', 'fort'];
const MAX_COUPS = 2000;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const autre = (camp) => (camp === 'w' ? 'b' : 'w');

// ---------- Position ----------

// Identité d'une position pour la répétition : pièces, trait, roques, et la case
// en passant seulement si une prise en passant légale existe.
export function clePosition(pos) {
  let ep = '-';
  if (pos.ep !== null) {
    const possible = coupsLegaux(pos).some((c) =>
      c.vers === pos.ep && pos.cases[c.de].toUpperCase() === 'P' && (c.de & 7) !== (c.vers & 7)
      && pos.cases[c.vers] === '');
    if (possible) ep = 'abcdefgh'[pos.ep & 7] + ((pos.ep >> 3) + 1);
  }
  return `${pos.cases.map((c) => c || '.').join('')} ${pos.trait} ${pos.roques || '-'} ${ep}`;
}

const couleurCase = (i) => ((i & 7) + (i >> 3)) & 1;

// Seuls cas : rois seuls, un seul cavalier, ou des fous tous sur la même couleur de case.
export function materielInsuffisant(pos) {
  const pieces = [];
  pos.cases.forEach((c, i) => { if (c !== '' && c.toUpperCase() !== 'K') pieces.push({ c, i }); });
  if (pieces.length === 0) return true;
  if (pieces.length === 1 && pieces[0].c.toUpperCase() === 'N') return true;
  return pieces.every((x) => x.c.toUpperCase() === 'B')
    && pieces.every((x) => couleurCase(x.i) === couleurCase(pieces[0].i));
}

// ---------- Déroulé ----------

export function nouvellePartie({ humain }) {
  return { humain, positions: [depuisFEN(FEN_INITIALE)], coups: [], sans: [], abandon: null };
}

export const positionCourante = (p) => p.positions[p.positions.length - 1];

export function etatFin(p) {
  // Mode ami : une issue hors de l'échiquier (abandon, temps, nulle par accord),
  // calculée par remote.finDe et posée sur la partie affichée.
  if (p.issue) return p.issue;
  if (p.abandon) return { type: 'abandon', gagnant: autre(p.abandon) };
  const pos = positionCourante(p);
  if (coupsLegaux(pos).length === 0) {
    return enEchec(pos) ? { type: 'mat', gagnant: autre(pos.trait) } : { type: 'pat', gagnant: null };
  }
  if (materielInsuffisant(pos)) return { type: 'materiel', gagnant: null };
  // Une position antérieure au dernier coup irréversible (prise ou coup de pion) ne
  // peut pas revenir : on ne compare qu'aux demi + 1 dernières positions.
  const cle = clePosition(pos);
  const recentes = p.positions.slice(-(pos.demi + 1));
  if (recentes.filter((q) => clePosition(q) === cle).length >= 3) return { type: 'repetition', gagnant: null };
  if (pos.demi >= 100) return { type: 'cinquante', gagnant: null };
  return null;
}

// Ajoute le coup à la partie EN PLACE ; réservé à une partie qu'on vient de copier
// ou de créer (jouerCoup, lirePartie).
function ajouterCoup(p, coup) {
  if (etatFin(p)) throw new Error('Partie terminée');
  const pos = positionCourante(p);
  const suivante = jouer(pos, coup); // lève si illégal
  p.positions.push(suivante);
  p.coups.push(versUCI(coup));
  p.sans.push(san(pos, coup));
  return p;
}

export const jouerCoup = (p, coup) =>
  ajouterCoup({ ...p, positions: p.positions.slice(), coups: p.coups.slice(), sans: p.sans.slice() }, coup);

export function abandonner(p) {
  if (etatFin(p)) throw new Error('Partie terminée');
  return { ...p, positions: p.positions.slice(), coups: p.coups.slice(), sans: p.sans.slice(), abandon: p.humain };
}

// ---------- Annulation ----------

// Nombre de coups à retirer (0 si impossible) : le dernier coup de l'humain,
// ou celui du robot avec le coup de l'humain qui le précède.
function aRetirer(p) {
  const n = p.coups.length;
  if (p.abandon || n === 0) return 0;
  if (p.positions[n - 1].trait === p.humain) return 1;
  return n >= 2 ? 2 : 0;
}

export const peutAnnuler = (p) => aRetirer(p) > 0;

export function annuler(p) {
  const k = aRetirer(p);
  if (k === 0) throw new Error('Rien à annuler');
  const n = p.coups.length - k;
  return {
    ...p,
    positions: p.positions.slice(0, n + 1),
    coups: p.coups.slice(0, n),
    sans: p.sans.slice(0, n),
  };
}

// ---------- Sauvegarde ----------

export const ecrirePartie = ({ niveau, partie }) =>
  JSON.stringify({ v: 1, niveau, humain: partie.humain, coups: partie.coups, abandon: partie.abandon });

// Le texte vient de localStorage : tout est revérifié en rejouant la partie.
export function lirePartie(texte) {
  try {
    let brut;
    try { brut = JSON.parse(texte); } catch { return null; }
    if (brut === null || typeof brut !== 'object' || Array.isArray(brut)) return null;
    if (brut.v !== 1 || !NIVEAUX.includes(brut.niveau) || !['w', 'b'].includes(brut.humain)) return null;
    const { coups } = brut;
    if (!Array.isArray(coups) || coups.length > MAX_COUPS) return null;
    if (!coups.every((c) => typeof c === 'string' && UCI.test(c))) return null;
    if (brut.abandon !== null && brut.abandon !== brut.humain) return null;

    // La partie est neuve et locale : on la remplit en place (pas de copie à chaque
    // coup). ajouterCoup lève si la partie est déjà finie, ce qui la fait jeter.
    const partie = nouvellePartie({ humain: brut.humain });
    for (const s of coups) {
      const coup = depuisUCI(positionCourante(partie), s);
      if (!coup) return null;
      ajouterCoup(partie, coup);
    }
    if (brut.abandon !== null) {
      if (etatFin(partie)) return null;
      return { niveau: brut.niveau, partie: abandonner(partie) };
    }
    return { niveau: brut.niveau, partie };
  } catch {
    return null;
  }
}
