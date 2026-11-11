// Robot d'échecs : négamax alpha-bêta en approfondissement itératif, recherche
// de calme, table de transposition (Zobrist), coups « killer », extension d'échec.
// Module pur : tourne à l'identique dans Node, dans un worker et sur le fil principal.
//
// Le moteur s'appuie sur `Plateau` (rules.js) et tient à côté son propre hachage
// de Zobrist, mis à jour à chaque coup à partir de la pile du plateau.

import { FEN_INITIALE, depuisFEN, Plateau, versUCI } from './rules.js';

export const NIVEAUX = ['facile', 'intermediaire', 'moyen', 'fort'];
export const BUDGET_MS = { facile: 150, intermediaire: 250, moyen: 500, fort: 2000, repli: 300 };

const REGLAGES = {
  // Facile : gros bruit, et de temps en temps (`distrait`) un coup pris au hasard parmi
  // ceux que la profondeur 1 juge à moins de 2 × bruit du meilleur (jamais une dame
  // donnée pour rien, mais parfois une pièce mineure, ou une prise manquée).
  facile: { budgetMs: BUDGET_MS.facile, profondeurMax: 3, bruit: 150, distrait: 0.06 },
  // Intermédiaire : à mi-chemin (en Elo) de facile et de moyen. Profondeur 4 au plus,
  // bruit et distractions réduits (un coup distrait reste à moins de 120 cp du meilleur
  // selon la profondeur 1 : il ne lâche pas de pièce).
  intermediaire: { budgetMs: BUDGET_MS.intermediaire, profondeurMax: 4, bruit: 60, distrait: 0.03 },
  moyen: { budgetMs: BUDGET_MS.moyen, profondeurMax: 64, bruit: 25 },
  fort: { budgetMs: BUDGET_MS.fort, profondeurMax: 64, bruit: 30 },
};
const MARGE_PREMIER = 30;    // premier coup : tirage parmi les coups à moins de 30 cp du meilleur
const PLY_MAX = 128;

const MAT = 100000;
const INF = 1000000;
const EST_MAT = MAT - 1000;  // au-delà, le score annonce un mat

// Codes de rules.js : type 1..6 = P N B R Q K, noir = type + 8.
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, NOIR = 8;
const VALEUR = [0, 100, 320, 330, 500, 900, 0];

// ---------- Évaluation ----------
// Tables de la « Simplified Evaluation Function » (Tomasz Michniewski), écrites
// du point de vue des blancs, rangée 8 en haut.

const TABLES = {
  [P]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0],
  [N]: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50],
  [B]: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20],
  [R]: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0],
  [Q]: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20],
};
const ROI_MILIEU = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20];
const ROI_FINALE = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50];

// PST[code][case] = matériel + table, du point de vue du propriétaire (a1 = 0).
// Une pièce blanche en (rangée r, colonne f) lit la table à (7 − r) × 8 + f ;
// une noire, en miroir, à r × 8 + f.
const PST = [];
for (let code = 0; code < 16; code++) {
  const type = code & 7, table = TABLES[type];
  PST.push(Int16Array.from({ length: 64 }, (_, i) => {
    if (!table) return 0;
    const t = code & NOIR ? i : (7 - (i >> 3)) * 8 + (i & 7);
    return VALEUR[type] + table[t];
  }));
}
const indexRoi = (i, noir) => (noir ? i : (7 - (i >> 3)) * 8 + (i & 7));

// Score en centipions du point de vue du camp au trait.
export function evaluer(plateau) {
  const b = plateau.b;
  let score = 0; // blancs − noirs
  let dW = 0, dB = 0, tW = 0, tB = 0, mW = 0, mB = 0, fW = 0, fB = 0;
  for (let i = 0; i < 64; i++) {
    const x = b[i];
    if (x === 0) continue;
    const type = x & 7;
    if (type === K) continue;
    if (x & NOIR) {
      score -= PST[x][i];
      if (type === Q) dB++; else if (type === R) tB++; else if (type === N) mB++; else if (type === B) { mB++; fB++; }
    } else {
      score += PST[x][i];
      if (type === Q) dW++; else if (type === R) tW++; else if (type === N) mW++; else if (type === B) { mW++; fW++; }
    }
  }
  // Finale : plus de dames, ou un camp qui a sa dame n'a plus avec elle que des pièces mineures.
  const finale = (dW === 0 || tW === 0) && (dB === 0 || tB === 0);
  const tableRoi = finale ? ROI_FINALE : ROI_MILIEU;
  score += tableRoi[indexRoi(plateau.roi[0], false)] - tableRoi[indexRoi(plateau.roi[1], true)];
  if (fW >= 2) score += 10;
  if (fB >= 2) score -= 10;
  return plateau.trait === 0 ? score : 0 - score;
}

// ---------- Zobrist (deux mots de 32 bits) ----------

function graineFixe(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return t ^ (t >>> 14);
  };
}
const alea = graineFixe(0x5eed);
const remplir = (n) => Int32Array.from({ length: n }, alea);
const ZP1 = remplir(16 * 64), ZP2 = remplir(16 * 64);   // [code × 64 + case]
const ZR1 = remplir(16), ZR2 = remplir(16);             // droits de roque
const ZE1 = remplir(8), ZE2 = remplir(8);               // colonne en passant
const ZT1 = alea(), ZT2 = alea();                       // trait aux noirs
ZR1[0] = 0; ZR2[0] = 0;

// Hachage « de base » (pièces, roques, trait), sans l'en passant.
function hacherBase(p) {
  let h1 = 0, h2 = 0;
  for (let i = 0; i < 64; i++) {
    const x = p.b[i];
    if (x) { h1 ^= ZP1[x * 64 + i]; h2 ^= ZP2[x * 64 + i]; }
  }
  h1 ^= ZR1[p.roques]; h2 ^= ZR2[p.roques];
  if (p.trait) { h1 ^= ZT1; h2 ^= ZT2; }
  return [h1, h2];
}

// La case en passant ne compte que si une prise en passant LÉGALE existe (pion
// cloué exclu), comme `clePosition` dans partie.js. Rend la colonne, ou -1.
function colonneEp(p) {
  const ep = p.ep;
  if (ep < 0) return -1;
  const pion = P | p.trait, f = ep & 7, base = p.trait ? ep + 8 : ep - 8;
  for (const de of [f > 0 ? base - 1 : -1, f < 7 ? base + 1 : -1]) {
    if (de >= 0 && p.b[de] === pion && p.faire({ de, vers: ep, promo: null })) { p.defaire(); return f; }
  }
  return -1;
}

// ---------- Recherche ----------

// Coups encodés en entier : de | vers << 6 | promo << 12.
const PROMOS = [null, 'q', 'r', 'b', 'n'];
const encoder = (c) => c.de | (c.vers << 6) | (PROMOS.indexOf(c.promo) << 12);

const TT_BITS = 18, TT_TAILLE = 1 << TT_BITS, TT_MASQUE = TT_TAILLE - 1;
const EXACT = 1, BORNE_BASSE = 2, BORNE_HAUTE = 3;
const ttCle = new Int32Array(TT_TAILLE);
const ttScore = new Int32Array(TT_TAILLE);
const ttCoup = new Int32Array(TT_TAILLE);
const ttProf = new Int8Array(TT_TAILLE);
const ttType = new Int8Array(TT_TAILLE);   // 0 = vide

class Recherche {
  constructor(p, historique, budgetMs, maintenant) {
    this.p = p;
    [this.h1, this.h2] = hacherBase(p); // hachage de base courant
    this.pileH = [];
    // Clés (complètes) des positions de la partie, puis de la ligne cherchée.
    this.cles1 = historique.map((c) => c[0]);
    this.cles2 = historique.map((c) => c[1]);
    this.budgetMs = budgetMs;
    this.maintenant = maintenant;
    this.debut = maintenant();
    this.noeuds = 0;
    this.stop = false;
    this.chrono = false;               // la profondeur 1 n'est jamais interrompue
    this.killers = new Int32Array(PLY_MAX * 2).fill(-1);
    ttType.fill(0);
  }


  // Joue le coup sur le plateau et met à jour le hachage ; false si illégal.
  faire(coup) {
    const p = this.p;
    const roquesAvant = p.roques;
    if (!p.faire(coup)) return false;
    const u = p.pile[p.pile.length - 1];
    const arrive = p.b[u.vers];
    let h1 = this.h1 ^ ZP1[u.x * 64 + u.de] ^ ZP1[arrive * 64 + u.vers] ^ ZR1[roquesAvant] ^ ZR1[p.roques] ^ ZT1;
    let h2 = this.h2 ^ ZP2[u.x * 64 + u.de] ^ ZP2[arrive * 64 + u.vers] ^ ZR2[roquesAvant] ^ ZR2[p.roques] ^ ZT2;
    if (u.prise) { h1 ^= ZP1[u.prise * 64 + u.casePrise]; h2 ^= ZP2[u.prise * 64 + u.casePrise]; }
    if ((u.x & 7) === K && Math.abs(u.vers - u.de) === 2) {
      const tour = R | (u.x & NOIR);
      const [de, vers] = u.vers > u.de ? [u.de + 3, u.de + 1] : [u.de - 4, u.de - 1];
      h1 ^= ZP1[tour * 64 + de] ^ ZP1[tour * 64 + vers];
      h2 ^= ZP2[tour * 64 + de] ^ ZP2[tour * 64 + vers];
    }
    this.pileH.push(this.h1, this.h2);
    this.h1 = h1; this.h2 = h2;
    const f = colonneEp(p);
    this.cles1.push(f < 0 ? h1 : h1 ^ ZE1[f]); this.cles2.push(f < 0 ? h2 : h2 ^ ZE2[f]);
    return true;
  }

  defaire() {
    this.p.defaire();
    this.h2 = this.pileH.pop(); this.h1 = this.pileH.pop();
    this.cles1.pop(); this.cles2.pop();
  }

  // Position déjà vue dans la partie ou dans la ligne (depuis le dernier coup irréversible) ?
  repetee() {
    const n = this.cles1.length - 1, k1 = this.cles1[n], k2 = this.cles2[n];
    const limite = Math.max(0, n - this.p.demi);
    for (let i = n - 2; i >= limite; i -= 2) if (this.cles1[i] === k1 && this.cles2[i] === k2) return true;
    return false;
  }

  aUnCoup() {
    for (const c of this.p.generer()) if (this.p.faire(c)) { this.p.defaire(); return true; }
    return false;
  }

  verifierTemps() {
    if ((++this.noeuds & 2047) === 0 && this.chrono && this.maintenant() - this.debut >= this.budgetMs) this.stop = true;
    return this.stop;
  }

  // Note d'ordre : coup de la table, prises MVV-LVA (et promotions), killers.
  ordonner(coups, coupTT, ply) {
    const b = this.p.b, notes = new Int32Array(coups.length);
    const k0 = this.killers[ply * 2], k1 = this.killers[ply * 2 + 1];
    for (let i = 0; i < coups.length; i++) {
      const c = coups[i], m = encoder(c);
      if (m === coupTT) { notes[i] = 1 << 30; continue; }
      const victime = b[c.vers] & 7, attaquant = b[c.de] & 7;
      let n = 0;
      if (victime) n = 100000 + VALEUR[victime] * 10 - attaquant;
      else if (attaquant === P && (c.de & 7) !== (c.vers & 7)) n = 100000 + 1000 - P; // en passant
      if (c.promo === 'q') n += 200000;
      else if (c.promo) n -= 50000;
      if (n === 0) { if (m === k0) n = 90000; else if (m === k1) n = 80000; }
      notes[i] = n;
    }
    return notes;
  }

  // Sélection paresseuse : amène en i le coup de meilleure note restante.
  static prendre(coups, notes, i) {
    let best = i;
    for (let j = i + 1; j < coups.length; j++) if (notes[j] > notes[best]) best = j;
    if (best !== i) {
      const c = coups[i]; coups[i] = coups[best]; coups[best] = c;
      const n = notes[i]; notes[i] = notes[best]; notes[best] = n;
    }
    return coups[i];
  }

  calme(alpha, beta, ply) {
    if (this.verifierTemps()) return 0;
    const debout = evaluer(this.p);
    if (debout >= beta || ply >= PLY_MAX - 1) return debout;
    if (debout > alpha) alpha = debout;
    const b = this.p.b;
    const coups = this.p.generer().filter((c) => b[c.vers] !== 0 || c.promo === 'q'
      || ((b[c.de] & 7) === P && (c.de & 7) !== (c.vers & 7)));
    const notes = this.ordonner(coups, -1, ply);
    let meilleur = debout;
    for (let i = 0; i < coups.length; i++) {
      const c = Recherche.prendre(coups, notes, i);
      if (!this.p.faire(c)) continue;   // prises : irréversibles, pas besoin du hachage
      const s = -this.calme(-beta, -alpha, ply + 1);
      this.p.defaire();
      if (this.stop) return 0;
      if (s > meilleur) {
        meilleur = s;
        if (s > alpha) { alpha = s; if (s >= beta) break; }
      }
    }
    return meilleur;
  }

  negamax(prof, alpha, beta, ply) {
    if (this.verifierTemps()) return 0;
    const p = this.p;
    if (this.repetee()) return 0;
    // Cinquante coups : nulle, sauf si la position est un mat (le mat passe avant,
    // comme dans etatFin).
    if (p.demi >= 100) return p.enEchec() && !this.aUnCoup() ? -(MAT - ply) : 0;
    const echec = p.enEchec();
    if (echec) prof++;
    if (prof <= 0 || ply >= PLY_MAX - 1) return this.calme(alpha, beta, ply);

    const k1 = this.cles1[this.cles1.length - 1], k2 = this.cles2[this.cles2.length - 1];
    const idx = k1 & TT_MASQUE;
    let coupTT = -1;
    if (ttType[idx] && ttCle[idx] === k2) {
      coupTT = ttCoup[idx];
      if (ttProf[idx] >= prof) {
        let s = ttScore[idx];
        if (s > EST_MAT) s -= ply; else if (s < -EST_MAT) s += ply;
        const t = ttType[idx];
        if (t === EXACT || (t === BORNE_BASSE && s >= beta) || (t === BORNE_HAUTE && s <= alpha)) return s;
      }
    }

    const coups = p.generer();
    const notes = this.ordonner(coups, coupTT, ply);
    const alphaInitial = alpha;
    let meilleur = -INF, meilleurCoup = -1, legaux = 0;
    for (let i = 0; i < coups.length; i++) {
      const c = Recherche.prendre(coups, notes, i);
      if (!this.faire(c)) continue;
      legaux++;
      const s = -this.negamax(prof - 1, -beta, -alpha, ply + 1);
      this.defaire();
      if (this.stop) return 0;
      if (s > meilleur) {
        meilleur = s;
        meilleurCoup = encoder(c);
        if (s > alpha) {
          alpha = s;
          if (s >= beta) {
            if (notes[i] < 100000 && meilleurCoup !== this.killers[ply * 2]) {
              this.killers[ply * 2 + 1] = this.killers[ply * 2];
              this.killers[ply * 2] = meilleurCoup;
            }
            break;
          }
        }
      }
    }
    if (legaux === 0) return echec ? -(MAT - ply) : 0;

    ttCle[idx] = k2;
    ttScore[idx] = meilleur > EST_MAT ? meilleur + ply : meilleur < -EST_MAT ? meilleur - ply : meilleur;
    ttCoup[idx] = meilleurCoup;
    ttProf[idx] = prof;
    ttType[idx] = meilleur >= beta ? BORNE_BASSE : meilleur > alphaInitial ? EXACT : BORNE_HAUTE;
    return meilleur;
  }

  // Une itération à la racine. Chaque coup est cherché avec la fenêtre
  // (meilleur − marge − 1, +∞) : les coups à moins de `marge` du meilleur reçoivent
  // un score exact, les autres une simple borne haute (exact = false).
  racine(prof, racines, marge) {
    const echec = this.p.enEchec();
    const resultats = [];
    let meilleur = -INF;
    for (const r of racines) {
      const alpha = meilleur === -INF ? -INF : meilleur - marge - 1;
      this.faire(r.coup);
      const s = -this.negamax(prof - 1 + (echec ? 1 : 0), -INF, -alpha, 1);
      this.defaire();
      if (this.stop) return null;
      resultats.push({ ...r, score: s, exact: s > alpha });
      if (s > meilleur) meilleur = s;
    }
    return resultats;
  }
}

function rejouer(fen, coups) {
  const p = Plateau.depuis(depuisFEN(fen));
  const cle = () => {
    const [h1, h2] = hacherBase(p);
    const f = colonneEp(p);
    return f < 0 ? [h1, h2] : [h1 ^ ZE1[f], h2 ^ ZE2[f]];
  };
  const historique = [cle()];
  for (const s of coups) {
    const coup = p.generer().find((c) => versUCI(c) === s);
    if (!coup || !p.faire(coup)) throw new Error(`Coup illégal : ${s}`);
    historique.push(cle());
  }
  return { p, historique };
}

export function choisirCoup({ fen = FEN_INITIALE, coups = [] } = {}, niveau,
  { rng = Math.random, maintenant = () => globalThis.performance.now(), budgetMs, profondeurMax } = {}) {
  const reglage = REGLAGES[niveau];
  if (!reglage) throw new Error(`Niveau inconnu : ${niveau}`);
  const budget = budgetMs ?? reglage.budgetMs;
  const profMax = Math.min(profondeurMax ?? reglage.profondeurMax, PLY_MAX - 1);
  const { p, historique } = rejouer(fen, coups);

  const legaux = p.generer().filter((c) => { if (!p.faire(c)) return false; p.defaire(); return true; });
  if (legaux.length === 0) throw new Error('Aucun coup légal');

  const premier = coups.length <= 1;
  const bruit = reglage.bruit;
  // Bruit uniforme tiré une fois par coup racine, dans l'ordre de génération.
  let racines = legaux.map((coup) => ({ coup, bruit: bruit ? (rng() * 2 - 1) * bruit : 0 }));
  const marge = Math.max(2 * bruit, premier ? MARGE_PREMIER : 0);

  const r = new Recherche(p, historique, budget, maintenant);
  let dernier = null, profondeur = 0, prof1 = null;
  for (let prof = 1; prof <= profMax; prof++) {
    r.chrono = prof > 1;
    const res = r.racine(prof, racines, marge);
    if (!res) break;                    // itération interrompue : jetée
    dernier = res; profondeur = prof;
    if (prof === 1) prof1 = res;
    // Ordre de l'itération suivante : meilleurs scores d'abord (tri stable).
    racines = res.slice().sort((a, b) => b.score - a.score).map(({ coup, bruit: z }) => ({ coup, bruit: z }));
    const top = Math.max(...res.map((x) => x.score));
    if (legaux.length === 1 || (Math.abs(top) > EST_MAT && MAT - Math.abs(top) <= prof)) break;
    if (r.maintenant() - r.debut >= budget) break;
  }

  const exacts = dernier.filter((x) => x.exact);
  const top = Math.max(...exacts.map((x) => x.score));
  let choix;
  if (premier) {
    const proches = exacts.filter((x) => x.score >= top - MARGE_PREMIER);
    choix = proches[Math.floor(rng() * proches.length)];
  } else if (reglage.distrait && rng() < reglage.distrait) {
    // Coup distrait : au hasard parmi ceux de la profondeur 1 à moins de `marge` du
    // meilleur (ils ont tous un score exact, voir racine).
    const top1 = Math.max(...prof1.filter((x) => x.exact).map((x) => x.score));
    const vus = prof1.filter((x) => x.exact && x.score >= top1 - marge);
    const c = vus[Math.floor(rng() * vus.length)];
    choix = dernier.find((x) => x.coup === c.coup);
  } else {
    choix = exacts.reduce((a, x) => (x.score + x.bruit > a.score + a.bruit ? x : a));
  }
  return { coup: choix.coup, score: choix.score, profondeur };
}
