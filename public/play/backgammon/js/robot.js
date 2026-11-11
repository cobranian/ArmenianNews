// Robot du backgammon : trois niveaux et décisions de videau. Module pur.
//
// facile : le tour de `moyen` dans 40 % des cas, un tour au hasard sinon.
// moyen  : le meilleur tour selon `evaluer` sur la position d'arrivée.
// fort   : les 8 meilleurs tours selon `evaluer`, puis l'espérance sur les
//          21 tirages adverses (l'adversaire jouant son meilleur tour).
//
// Les tours de `toursLegaux` sont dédoublonnés par position d'arrivée avant
// d'être évalués : un même résultat obtenu dans plusieurs ordres ne compte
// qu'une fois.

import { adversaire, toursLegaux, issue } from './rules.js';
import { peutDoubler } from './match.js';

export const NIVEAUX = ['facile', 'moyen', 'fort'];
export const BUDGET_MS = { fort: 1200, repli: 250 };
export const SEUILS = {
  facile: { double: 0.80, accepte: 0.33 },
  moyen: { double: 0.74, accepte: 0.29 },
  fort: { double: 0.71, accepte: 0.27 },
};

// Poids de l'évaluation, en « points de course » (1 = un pip d'avance).
//   course   : par pip d'avance ;
//   sortie   : par dame sortie (en plus des pips qu'elle a parcourus) ;
//   point    : par point fait (2 dames ou plus), jan   : bonus s'il est dans le jan,
//   point5 / pointBarre : bonus pour le point 5 et le point 7 ;
//   prime    : par point de la plus longue prime (à partir de 2) ;
//   barre    : par dame adverse sur la barre, ferme : en plus, par point fait du jan ;
//   blot / blotPip : risque des blots, × probabilité d'être touché (sur 36),
//                    blotPip étant multiplié par les pips perdus si on est frappé ;
//   blotAdverse : part du risque des blots adverses comptée (ils ne sont pas
//                 sous le feu tout de suite : c'est à l'adversaire de jouer) ;
//   arriere  : par dame restée dans le jan adverse (points 19–24 de ma vue) ou sur la barre.
export const POIDS = {
  moyen: {
    course: 1, sortie: 3, point: 2, jan: 2, point5: 3, pointBarre: 2, prime: 2,
    barre: 6, ferme: 2, blot: 8, blotPip: 0.5, blotAdverse: 0.3, arriere: 3,
  },
  fort: {
    course: 1, sortie: 3, point: 2, jan: 2.5, point5: 3, pointBarre: 2, prime: 3,
    barre: 6, ferme: 2.5, blot: 8, blotPip: 0.5, blotAdverse: 0.4, arriere: 8,
  },
};

const VICTOIRE = 1e6;
const PART_BON_TOUR = 0.82; // niveau facile : part des tours joués comme `moyen`
const K = 0.028; // pente de la logistique de `chances`, par point d'évaluation (étalonnée sur des manches simulées)
const K_COURSE = 1.0; // course pure : pente par écart de pips / racine du compte moyen (étalonné par simulation)
const BONUS_COURSE = 2.5; // course pure : avantage d'avoir le dé, en pips
const BONUS_TRAIT = 8; // avantage d'avoir le dé, en pips
const CANDIDATS = 8;

// Les 21 tirages, avec leur poids sur 36.
const TIRAGES = [];
for (let a = 1; a <= 6; a++) {
  for (let b = a; b <= 6; b++) TIRAGES.push({ des: a === b ? [a, a, a, a] : [a, b], poids: a === b ? 1 : 2 });
}

// ---------- Outils ----------

// Vue de `j` : moi[1..24] (24 = le plus loin), moi[25] = barre, moi[0] = sorties ;
// lui[q] = dames adverses sur le point q de ma vue, lui[0] = sa barre (il y entre
// en montant), lui[25] = ses sorties.
function vue(pos, j) {
  const moi = new Array(26).fill(0);
  const lui = new Array(26).fill(0);
  for (let i = 0; i < 24; i++) {
    const v = pos.points[i];
    if (v === 0) continue;
    const p = j === 'b' ? i + 1 : 24 - i;
    if ((v > 0) === (j === 'b')) moi[p] = Math.abs(v);
    else lui[p] = Math.abs(v);
  }
  const o = adversaire(j);
  moi[25] = pos.barre[j];
  moi[0] = pos.sortis[j];
  lui[0] = pos.barre[o];
  lui[25] = pos.sortis[o];
  return { moi, lui };
}

// Retourne les tableaux de vue : la même position vue par l'adversaire.
function retourner(moi, lui) {
  const m = new Array(26), l = new Array(26);
  for (let p = 0; p <= 25; p++) { m[p] = lui[25 - p]; l[p] = moi[25 - p]; }
  return { moi: m, lui: l };
}

// Applique un tour supposé légal (il vient de toursLegaux), sans vérification.
function appliquer(pos, j, tour) {
  const o = adversaire(j);
  const signe = j === 'b' ? 1 : -1;
  const points = pos.points.slice();
  const barre = { b: pos.barre.b, n: pos.barre.n };
  const sortis = { b: pos.sortis.b, n: pos.sortis.n };
  for (const pas of tour) {
    if (pas.depuis === 'barre') barre[j]--;
    else points[pas.depuis - 1] -= signe;
    if (pas.vers === 'sortie') {
      sortis[j]++;
    } else {
      const i = pas.vers - 1;
      if (points[i] === -signe) { points[i] = 0; barre[o]++; }
      points[i] += signe;
    }
  }
  return { points, barre, sortis };
}

const cleDe = (p) => `${p.points.join(',')}|${p.barre.b},${p.barre.n}|${p.sortis.b},${p.sortis.n}`;

// Tours distincts par position d'arrivée : [{ tour, arrivee }].
function resultats(pos, j, des) {
  const tours = toursLegaux(pos, j, des);
  const vus = new Set();
  const res = [];
  for (const tour of tours) {
    const arrivee = appliquer(pos, j, tour);
    const c = cleDe(arrivee);
    if (vus.has(c)) continue;
    vus.add(c);
    res.push({ tour, arrivee });
  }
  return res;
}

// Contact : une de mes dames est encore derrière une dame adverse.
function contact(moi, lui) {
  let monPlusLoin = 0;
  for (let p = 25; p >= 1; p--) if (moi[p] > 0) { monPlusLoin = p; break; }
  let sonPlusLoin = 25;
  for (let q = 0; q <= 24; q++) if (lui[q] > 0) { sonPlusLoin = q; break; }
  return monPlusLoin > sonPlusLoin;
}

// L'adversaire atteint-il la distance `d` depuis q avec ces dés ? Les points
// intermédiaires ne doivent pas être des points que je tiens.
function atteint(moi, q, d, d1, d2) {
  if (d1 === d2) {
    for (let k = 1; k <= 4; k++) {
      const c = q + k * d1;
      if (c === q + d) return true;
      if (c > q + d || c > 24 || moi[c] >= 2) return false;
    }
    return false;
  }
  if (d === d1 || d === d2) return true;
  if (d !== d1 + d2) return false;
  return moi[q + d1] < 2 || moi[q + d2] < 2;
}

// Risque de mes blots : espérance, sur les 36 tirages adverses, de
// blot + blotPip × (pips perdus par le blot touché le plus avancé).
function risqueBlots(moi, lui, w) {
  const blots = [];
  for (let p = 1; p <= 24; p++) if (moi[p] === 1) blots.push(p);
  if (blots.length === 0) return 0;
  const tireurs = [];
  for (let q = 0; q <= 23; q++) if (lui[q] > 0) tireurs.push(q);
  if (tireurs.length === 0) return 0;
  let total = 0;
  for (const { des, poids } of TIRAGES) {
    const d1 = des[0], d2 = des[1];
    let perte = -1;
    for (const b of blots) {
      for (const q of tireurs) {
        if (q >= b) break;
        // Avec une dame sur la barre, l'adversaire doit d'abord rentrer.
        if (lui[0] > 0 && q > 0 && d1 !== d2) continue;
        if (atteint(moi, q, b - q, d1, d2)) {
          if (25 - b > perte) perte = 25 - b;
          break;
        }
      }
    }
    if (perte >= 0) total += poids * (w.blot + w.blotPip * perte);
  }
  return total / 36;
}

// Valeur de la structure d'un camp (sans la course).
function structure(moi, lui, w) {
  let v = 0;
  let prime = 0, run = 0, jan = 0;
  for (let p = 1; p <= 24; p++) {
    if (moi[p] >= 2) {
      v += w.point;
      if (p <= 6) { v += w.jan; jan++; }
      if (p === 5) v += w.point5;
      if (p === 7) v += w.pointBarre;
      run++;
      if (run > prime) prime = run;
    } else {
      run = 0;
    }
  }
  if (prime >= 2) v += w.prime * prime;
  v += lui[0] * (w.barre + w.ferme * jan);
  let arriere = moi[25];
  for (let p = 19; p <= 24; p++) arriere += moi[p];
  v -= w.arriere * arriere;
  return v;
}

// Pips à parcourir : les miens (barre = 25), puis ceux de l'adversaire (sa barre = 25).
function mesPips(moi) {
  let t = 0;
  for (let p = 1; p <= 25; p++) t += moi[p] * p;
  return t;
}

function sesPips(lui) {
  let t = 0;
  for (let q = 0; q <= 24; q++) t += lui[q] * (25 - q);
  return t;
}

// Évaluation depuis les tableaux de vue de j (l'adversaire va jouer).
function evaluerVue(moi, lui, w) {
  let v = w.course * (sesPips(lui) - mesPips(moi)) + w.sortie * (moi[0] - lui[25]);
  if (contact(moi, lui)) {
    const r = retourner(moi, lui);
    v += structure(moi, lui, w) - structure(r.moi, r.lui, w);
    v -= risqueBlots(moi, lui, w);
    v += w.blotAdverse * risqueBlots(r.moi, r.lui, w);
  }
  return v;
}

/**
 * Évaluation de la position pour `j`, l'adversaire étant sur le point de
 * jouer (c'est la position d'arrivée d'un tour de j). Plus grand = meilleur.
 */
export function evaluer(pos, j, poids) {
  const fin = issue(pos);
  if (fin) return fin.gagnant === j ? VICTOIRE : -VICTOIRE;
  const { moi, lui } = vue(pos, j);
  return evaluerVue(moi, lui, poids);
}

/** Chances estimées que `j` gagne la manche, `j` étant sur le point de lancer. */
export function chances(pos, j) {
  const fin = issue(pos);
  if (fin) return fin.gagnant === j ? 1 - 1e-6 : 1e-6;
  const { moi, lui } = vue(pos, j);
  if (!contact(moi, lui)) {
    // Course pure : l'écart de pips compte d'autant plus qu'il en reste peu.
    const mes = mesPips(moi), ses = sesPips(lui);
    const c = 1 / (1 + Math.exp(-K_COURSE * (ses - mes + BONUS_COURSE) / Math.sqrt(Math.max(1, (mes + ses) / 2))));
    return Math.min(1 - 1e-6, Math.max(1e-6, c));
  }
  // evaluer(pos, adversaire) suppose que j va jouer : c'est notre cas.
  const e = -evaluer(pos, adversaire(j), POIDS.fort) + BONUS_TRAIT * POIDS.fort.course;
  const c = 1 / (1 + Math.exp(-K * e));
  return Math.min(1 - 1e-6, Math.max(1e-6, c));
}

// ---------- Choix du tour ----------

const exigerNiveau = (niveau) => {
  if (!NIVEAUX.includes(niveau)) throw new Error(`Niveau inconnu : ${niveau}`);
};

const auHasard = (liste, rng) => liste[Math.min(liste.length - 1, Math.floor(rng() * liste.length))];

// Facile : le tour de `moyen` dans PART_BON_TOUR des cas, un tour au hasard sinon.
function facile(j, res, rng) {
  if (rng() < PART_BON_TOUR) return moyen(j, res, rng);
  return auHasard(res, rng).tour;
}

function moyen(j, res, rng) {
  let meilleurs = [], max = -Infinity;
  for (const r of res) {
    const v = evaluer(r.arrivee, j, POIDS.moyen);
    if (v > max) { max = v; meilleurs = [r]; } else if (v === max) meilleurs.push(r);
  }
  return auHasard(meilleurs, rng).tour;
}

// Meilleure réponse de `o` avec ces dés : valeur max de evaluer(…, o).
function meilleureReponse(pos, o, des, w) {
  let max = -Infinity;
  for (const r of resultats(pos, o, des)) {
    const v = evaluer(r.arrivee, o, w);
    if (v > max) max = v;
  }
  return max;
}

function fort(pos, j, res, maintenant, budgetMs) {
  const debut = maintenant();
  const w = POIDS.fort;
  const o = adversaire(j);
  const classes = res
    .map((r) => ({ ...r, v: evaluer(r.arrivee, j, w) }))
    .sort((a, b) => b.v - a.v);
  if (classes[0].v >= VICTOIRE) return classes[0].tour;
  // Course sans contact : la recherche n'apporte presque rien, on garde le classement.
  const { moi, lui } = vue(pos, j);
  if (!contact(moi, lui)) return classes[0].tour;
  const candidats = classes.slice(0, CANDIDATS);
  let meilleur = candidats[0].tour, max = -Infinity;
  for (const c of candidats) {
    let esperance = 0;
    for (const { des, poids } of TIRAGES) esperance -= poids * meilleureReponse(c.arrivee, o, des, w);
    if (esperance > max) { max = esperance; meilleur = c.tour; }
    if (maintenant() - debut > budgetMs) break;
  }
  return meilleur;
}

/**
 * Tour choisi par le robot `j` avec les dés `des`. Rend `[]` quand rien
 * n'est jouable. Lève sur un niveau inconnu.
 */
export function choisirTour(pos, j, des, niveau, opts = {}) {
  // `??` : un `null` venu du worker vaut l'absence, pas « aucun budget ».
  const rng = opts.rng ?? Math.random;
  const maintenant = opts.maintenant ?? (() => performance.now());
  const budgetMs = opts.budgetMs ?? BUDGET_MS.fort;
  exigerNiveau(niveau);
  const res = resultats(pos, j, des);
  if (res.length === 1) return res[0].tour;
  if (niveau === 'facile') return facile(j, res, rng);
  if (niveau === 'moyen') return moyen(j, res, rng);
  return fort(pos, j, res, maintenant, budgetMs);
}

// ---------- Videau ----------

/** Le robot, au trait en phase `lancer`, veut-il doubler ? */
export function veutDoubler(partie, niveau) {
  exigerNiveau(niveau);
  if (!peutDoubler(partie)) return false;
  return chances(partie.position, partie.trait) >= SEUILS[niveau].double;
}

/** Le robot (adversaire du doubleur `partie.trait`) accepte-t-il le double ? */
export function accepteDouble(partie, niveau) {
  exigerNiveau(niveau);
  return 1 - chances(partie.position, partie.trait) >= SEUILS[niveau].accepte;
}
