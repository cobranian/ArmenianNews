// Règles des échecs. Module pur : aucune dépendance, aucun DOM.
//
// Cases 0–63, index = rangée × 8 + colonne (a1 = 0, h1 = 7, a8 = 56, h8 = 63).
// Camps 'w' / 'b'. Pièces en lettres FEN (PNBRQK blanches, pnbrqk noires).
//
// Position = { cases: string[64] ('' ou lettre FEN), trait: 'w' | 'b',
//              roques: string (sous-ensemble ordonné de 'KQkq'),
//              ep: 0..63 | null, demi: number, numero: number } — jamais modifiée.
// Coup = { de, vers, promo: null | 'q' | 'r' | 'b' | 'n' }.
//
// Plateau (bas niveau, mutable) : `generer()` renvoie des coups PSEUDO-LÉGAUX
// (le roi peut y rester en échec), à l'exception du roque dont les cases
// (départ, traversée, arrivée) sont vérifiées à la génération. La légalité
// est jugée par `faire`, qui annule le coup et renvoie false si le roi du
// camp qui joue reste attaqué. `coupsLegaux`, `jouer` et `perft` passent
// tous par ce même chemin.

export const FEN_INITIALE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ---------- Cases ----------

export const nomCase = (i) => 'abcdefgh'[i & 7] + ((i >> 3) + 1);

export function indexCase(nom) {
  if (typeof nom !== 'string' || !/^[a-h][1-8]$/.test(nom)) throw new Error(`Case invalide : ${nom}`);
  return (nom.charCodeAt(1) - 49) * 8 + (nom.charCodeAt(0) - 97);
}

// ---------- Codes internes des pièces ----------
// 0 = vide ; type 1..6 = P N B R Q K ; noir = type + 8.

const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const NOIR = 8;
const LETTRES = ['', 'P', 'N', 'B', 'R', 'Q', 'K', '', '', 'p', 'n', 'b', 'r', 'q', 'k'];
const CODE_DE = { P, N, B, R, Q, K, p: P + NOIR, n: N + NOIR, b: B + NOIR, r: R + NOIR, q: Q + NOIR, k: K + NOIR };
const PROMO_CODE = { q: Q, r: R, b: B, n: N };

// ---------- Tables précalculées ----------

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]; // 0–3 tour, 4–7 fou
const RAYONS = [];      // RAYONS[case][dir] = cases successives
const CAV = [];         // sauts de cavalier
const ROI = [];         // pas de roi
const ATT_PION = { w: [], b: [] }; // cases d'où un pion de ce camp attaque la case
for (let s = 0; s < 64; s++) {
  const f = s & 7, r = s >> 3;
  RAYONS.push(DIRS.map(([df, dr]) => {
    const l = [];
    for (let ff = f + df, rr = r + dr; ff >= 0 && ff < 8 && rr >= 0 && rr < 8; ff += df, rr += dr) l.push(rr * 8 + ff);
    return l;
  }));
  const cible = (liste) => liste.filter(([df, dr]) => f + df >= 0 && f + df < 8 && r + dr >= 0 && r + dr < 8)
    .map(([df, dr]) => (r + dr) * 8 + f + df);
  CAV.push(cible([[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]));
  ROI.push(cible(DIRS));
  // Un pion blanc en (f±1, r−1) attaque (f, r) ; un pion noir en (f±1, r+1).
  ATT_PION.w.push(cible([[-1, -1], [1, -1]]));
  ATT_PION.b.push(cible([[-1, 1], [1, 1]]));
}

// Droits de roque perdus quand une case est touchée (départ ou arrivée).
const MASQUE_ROQUE = new Int8Array(64).fill(15);
MASQUE_ROQUE[0] = 15 & ~2;   // a1 → Q
MASQUE_ROQUE[7] = 15 & ~1;   // h1 → K
MASQUE_ROQUE[4] = 15 & ~3;   // e1 → K, Q
MASQUE_ROQUE[56] = 15 & ~8;  // a8 → q
MASQUE_ROQUE[63] = 15 & ~4;  // h8 → k
MASQUE_ROQUE[60] = 15 & ~12; // e8 → k, q
const BITS_ROQUE = 'KQkq';

const roquesVersBits = (s) => {
  let b = 0;
  for (let i = 0; i < 4; i++) if (s.includes(BITS_ROQUE[i])) b |= 1 << i;
  return b;
};
const bitsVersRoques = (b) => {
  let s = '';
  for (let i = 0; i < 4; i++) if (b & (1 << i)) s += BITS_ROQUE[i];
  return s;
};

// ---------- FEN ----------

export function depuisFEN(fen) {
  if (typeof fen !== 'string') throw new Error('FEN invalide');
  const champs = fen.trim().split(/\s+/);
  if (champs.length < 4 || champs.length > 6) throw new Error(`FEN invalide : ${fen}`);
  const [plateau, trait, roques, ep] = champs;
  const rangees = plateau.split('/');
  if (rangees.length !== 8) throw new Error(`FEN invalide (rangées) : ${fen}`);
  const cases = new Array(64).fill('');
  const rois = { K: 0, k: 0 };
  rangees.forEach((rang, i) => {
    const r = 7 - i;
    let f = 0;
    for (const ch of rang) {
      if (ch >= '1' && ch <= '8') f += +ch;
      else if (CODE_DE[ch] !== undefined) {
        if (f > 7) throw new Error(`FEN invalide (rangée trop longue) : ${fen}`);
        if (ch === 'K' || ch === 'k') rois[ch]++;
        if ((ch === 'P' || ch === 'p') && (r === 0 || r === 7)) throw new Error(`FEN invalide (pion en bout) : ${fen}`);
        cases[r * 8 + f++] = ch;
      } else throw new Error(`FEN invalide (caractère ${ch}) : ${fen}`);
    }
    if (f !== 8) throw new Error(`FEN invalide (rangée de ${f} cases) : ${fen}`);
  });
  if (rois.K !== 1 || rois.k !== 1) throw new Error(`FEN invalide (rois) : ${fen}`);
  if (trait !== 'w' && trait !== 'b') throw new Error(`FEN invalide (trait) : ${fen}`);
  if (roques !== '-' && !/^K?Q?k?q?$/.test(roques)) throw new Error(`FEN invalide (roques) : ${fen}`);
  if (ep !== '-' && !/^[a-h][36]$/.test(ep)) throw new Error(`FEN invalide (en passant) : ${fen}`);
  const entier = (s, defaut) => {
    if (s === undefined) return defaut;
    if (!/^\d+$/.test(s)) throw new Error(`FEN invalide (compteur) : ${fen}`);
    return +s;
  };
  return {
    cases,
    trait,
    roques: roques === '-' ? '' : roques,
    ep: ep === '-' ? null : indexCase(ep),
    demi: entier(champs[4], 0),
    numero: entier(champs[5], 1),
  };
}

export function versFEN(pos) {
  const rangees = [];
  for (let r = 7; r >= 0; r--) {
    let s = '', vides = 0;
    for (let f = 0; f < 8; f++) {
      const c = pos.cases[r * 8 + f];
      if (c === '') vides++;
      else { if (vides) { s += vides; vides = 0; } s += c; }
    }
    if (vides) s += vides;
    rangees.push(s);
  }
  return `${rangees.join('/')} ${pos.trait} ${pos.roques || '-'} ${pos.ep === null ? '-' : nomCase(pos.ep)} ${pos.demi} ${pos.numero}`;
}

// ---------- Plateau ----------

export class Plateau {
  constructor() {
    this.b = new Int8Array(64);
    this.trait = 0;      // 0 = blanc, 8 = noir (même décalage que les codes de pièces)
    this.roques = 0;     // bits : 1 K, 2 Q, 4 k, 8 q
    this.ep = -1;
    this.demi = 0;
    this.numero = 1;
    this.roi = [0, 0];   // case du roi blanc, noir
    this.pile = [];
  }

  static depuis(pos) {
    const p = new Plateau();
    for (let i = 0; i < 64; i++) {
      const c = pos.cases[i];
      if (c !== '') {
        const code = CODE_DE[c];
        p.b[i] = code;
        if (code === K) p.roi[0] = i;
        else if (code === K + NOIR) p.roi[1] = i;
      }
    }
    p.trait = pos.trait === 'w' ? 0 : NOIR;
    p.roques = roquesVersBits(pos.roques);
    p.ep = pos.ep === null ? -1 : pos.ep;
    p.demi = pos.demi;
    p.numero = pos.numero;
    return p;
  }

  versPosition() {
    return {
      cases: Array.from(this.b, (c) => LETTRES[c]),
      trait: this.trait === 0 ? 'w' : 'b',
      roques: bitsVersRoques(this.roques),
      ep: this.ep < 0 ? null : this.ep,
      demi: this.demi,
      numero: this.numero,
    };
  }

  // La case `i` est-elle attaquée par le camp `camp` ('w' | 'b') ?
  attaquee(i, camp) {
    return this._att(i, camp === 'w' ? 0 : NOIR);
  }

  _att(i, c) {
    const b = this.b;
    for (const s of ATT_PION[c ? 'b' : 'w'][i]) if (b[s] === (P | c)) return true;
    for (const s of CAV[i]) if (b[s] === (N | c)) return true;
    for (const s of ROI[i]) if (b[s] === (K | c)) return true;
    const rayons = RAYONS[i];
    for (let d = 0; d < 8; d++) {
      const ray = rayons[d], lent = d < 4 ? R : B;
      for (let k = 0; k < ray.length; k++) {
        const x = b[ray[k]];
        if (x === 0) continue;
        if (x === (lent | c) || x === (Q | c)) return true;
        break;
      }
    }
    return false;
  }

  // Le camp au trait est-il en échec ?
  enEchec() {
    return this._att(this.roi[this.trait >> 3], this.trait ^ NOIR);
  }

  // Coups pseudo-légaux du camp au trait (voir l'en-tête du module).
  generer() {
    const coups = [];
    const b = this.b, c = this.trait, adv = c ^ NOIR;
    const ajoute = (de, vers) => coups.push({ de, vers, promo: null });
    for (let de = 0; de < 64; de++) {
      const x = b[de];
      if (x === 0 || (x & NOIR) !== c) continue;
      const type = x & 7;
      if (type === P) {
        const avant = c === 0 ? 8 : -8;
        const rangee = de >> 3;
        const dernier = c === 0 ? 6 : 1;
        const depart = c === 0 ? 1 : 6;
        const poser = (vers) => {
          if (rangee === dernier) for (const pr of ['q', 'r', 'b', 'n']) coups.push({ de, vers, promo: pr });
          else ajoute(de, vers);
        };
        const un = de + avant;
        if (b[un] === 0) {
          poser(un);
          if (rangee === depart && b[un + avant] === 0) ajoute(de, un + avant);
        }
        const f = de & 7;
        for (const df of [-1, 1]) {
          if (f + df < 0 || f + df > 7) continue;
          const vers = un + df;
          const cible = b[vers];
          if (cible !== 0 && (cible & NOIR) === adv) poser(vers);
          else if (cible === 0 && vers === this.ep) ajoute(de, vers);
        }
      } else if (type === N) {
        for (const vers of CAV[de]) { const t = b[vers]; if (t === 0 || (t & NOIR) !== c) ajoute(de, vers); }
      } else if (type === K) {
        for (const vers of ROI[de]) { const t = b[vers]; if (t === 0 || (t & NOIR) !== c) ajoute(de, vers); }
        this._roques(de, ajoute);
      } else {
        const rayons = RAYONS[de];
        const d0 = type === B ? 4 : 0, d1 = type === R ? 4 : 8;
        for (let d = d0; d < d1; d++) {
          for (const vers of rayons[d]) {
            const t = b[vers];
            if (t === 0) ajoute(de, vers);
            else { if ((t & NOIR) !== c) ajoute(de, vers); break; }
          }
        }
      }
    }
    return coups;
  }

  _roques(de, ajoute) {
    const b = this.b, c = this.trait, base = c === 0 ? 0 : 56;
    if (de !== base + 4) return;
    const adv = c ^ NOIR;
    const droitK = this.roques & (c === 0 ? 1 : 4), droitQ = this.roques & (c === 0 ? 2 : 8);
    if (!droitK && !droitQ) return;
    if (this._att(de, adv)) return;
    if (droitK && b[base + 7] === (R | c) && b[base + 5] === 0 && b[base + 6] === 0
      && !this._att(base + 5, adv) && !this._att(base + 6, adv)) ajoute(de, base + 6);
    if (droitQ && b[base] === (R | c) && b[base + 1] === 0 && b[base + 2] === 0 && b[base + 3] === 0
      && !this._att(base + 3, adv) && !this._att(base + 2, adv)) ajoute(de, base + 2);
  }

  // Joue le coup ; s'il laisse le roi en échec, l'annule et renvoie false.
  faire(coup) {
    const b = this.b, { de, vers } = coup;
    const x = b[de], c = this.trait, type = x & 7;
    let prise = b[vers], casePrise = vers;
    if (type === P && vers === this.ep && prise === 0 && ((de ^ vers) & 7) !== 0) {
      casePrise = vers + (c === 0 ? -8 : 8); // en passant
      prise = b[casePrise];
    }
    this.pile.push({ de, vers, x, prise, casePrise, roques: this.roques, ep: this.ep, demi: this.demi });

    b[casePrise] = 0;
    b[vers] = coup.promo ? (PROMO_CODE[coup.promo] | c) : x;
    b[de] = 0;
    if (type === K) {
      this.roi[c >> 3] = vers;
      if (vers - de === 2) { b[de + 1] = b[de + 3]; b[de + 3] = 0; }
      else if (de - vers === 2) { b[de - 1] = b[de - 4]; b[de - 4] = 0; }
    }
    this.roques &= MASQUE_ROQUE[de] & MASQUE_ROQUE[vers];
    this.ep = type === P && (vers - de === 16 || de - vers === 16) ? (de + vers) >> 1 : -1;
    this.demi = type === P || prise !== 0 ? 0 : this.demi + 1;
    if (c !== 0) this.numero++;
    this.trait = c ^ NOIR;

    if (this._att(this.roi[c >> 3], this.trait)) { this.defaire(); return false; }
    return true;
  }

  defaire() {
    const u = this.pile.pop();
    const b = this.b, c = u.x & NOIR;
    this.trait = c;
    if (c !== 0) this.numero--;
    this.roques = u.roques; this.ep = u.ep; this.demi = u.demi;
    b[u.de] = u.x;
    b[u.vers] = 0;
    b[u.casePrise] = u.prise;
    if ((u.x & 7) === K) {
      this.roi[c >> 3] = u.de;
      if (u.vers - u.de === 2) { b[u.de + 3] = b[u.de + 1]; b[u.de + 1] = 0; }
      else if (u.de - u.vers === 2) { b[u.de - 4] = b[u.de - 1]; b[u.de - 1] = 0; }
    }
  }
}

// ---------- API immuable ----------

const memeCoup = (a, b) => a.de === b.de && a.vers === b.vers && (a.promo || null) === (b.promo || null);

export function coupsLegaux(pos) {
  const p = Plateau.depuis(pos);
  const res = [];
  for (const c of p.generer()) if (p.faire(c)) { p.defaire(); res.push(c); }
  return res;
}

export function jouer(pos, coup) {
  const p = Plateau.depuis(pos);
  for (const c of p.generer()) {
    if (memeCoup(c, coup)) {
      if (p.faire(c)) return p.versPosition();
      break;
    }
  }
  throw new Error(`Coup illégal : ${versUCI(coup)}`);
}

export const enEchec = (pos) => Plateau.depuis(pos).enEchec();

// ---------- UCI ----------

export const versUCI = (coup) => nomCase(coup.de) + nomCase(coup.vers) + (coup.promo || '');

export function depuisUCI(pos, s) {
  if (typeof s !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(s)) return null;
  const cherche = { de: indexCase(s.slice(0, 2)), vers: indexCase(s.slice(2, 4)), promo: s[4] || null };
  return coupsLegaux(pos).find((c) => memeCoup(c, cherche)) || null;
}

// ---------- Perft ----------

function perftPlateau(p, profondeur) {
  if (profondeur === 0) return 1;
  let n = 0;
  for (const c of p.generer()) {
    if (!p.faire(c)) continue;
    n += profondeur === 1 ? 1 : perftPlateau(p, profondeur - 1);
    p.defaire();
  }
  return n;
}

export const perft = (pos, profondeur) => perftPlateau(Plateau.depuis(pos), profondeur);
