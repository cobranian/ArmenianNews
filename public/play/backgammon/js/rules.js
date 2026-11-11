// Règles du backgammon. Module pur : aucune dépendance, aucun DOM.
//
// Position = { points: number[24] (index = point − 1 ; > 0 blanc, < 0 noir),
//              barre: { b, n }, sortis: { b, n } } — jamais modifiée.
// Pas = { depuis: 1..24 | 'barre', vers: 1..24 | 'sortie', de: 1..6 }.
// Tour = Pas[].
//
// Blanc va du 24 vers le 1 (jan 1–6, entre sur 25 − dé) ; Noir va du 1 vers
// le 24 (jan 19–24, entre sur dé). Les calculs se font dans la « vue » du
// joueur au trait : ses points vont de 24 (le plus loin) à 1, la barre vaut
// 25 et la sortie 0. Pour Noir, point de vue = 25 − point absolu.

const BARRE = 25;
const SORTIE = 0;

export const adversaire = (j) => (j === 'b' ? 'n' : 'b');

export function positionInitiale() {
  const points = new Array(24).fill(0);
  points[23] = 2; points[12] = 5; points[7] = 3; points[5] = 5;
  points[0] = -2; points[11] = -5; points[16] = -3; points[18] = -5;
  return { points, barre: { b: 0, n: 0 }, sortis: { b: 0, n: 0 } };
}

export function pipCount(pos, j) {
  let t = pos.barre[j] * 25;
  for (let i = 0; i < 24; i++) {
    const v = pos.points[i];
    if (j === 'b' && v > 0) t += v * (i + 1);
    else if (j === 'n' && v < 0) t += -v * (24 - i);
  }
  return t;
}

export const desDuLancer = (d1, d2) => (d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]);

export const deDepuisOctet = (o) => (o < 252 ? (o % 6) + 1 : null);

// ---------- Vue du joueur au trait ----------

// Tableaux de la vue : moi[0..25] (25 = barre, 0 = sorties), lui[1..24].
function vue(pos, j) {
  if (j !== 'b' && j !== 'n') throw new Error(`Joueur invalide : ${j}`);
  const moi = new Array(26).fill(0);
  const lui = new Array(25).fill(0);
  for (let i = 0; i < 24; i++) {
    const v = pos.points[i];
    if (v === 0) continue;
    const p = j === 'b' ? i + 1 : 24 - i;
    if ((v > 0) === (j === 'b')) moi[p] = Math.abs(v);
    else lui[p] = Math.abs(v);
  }
  moi[BARRE] = pos.barre[j];
  moi[SORTIE] = pos.sortis[j];
  return { moi, lui };
}

const versAbsolu = (j, p) => (p === BARRE ? 'barre' : p === SORTIE ? 'sortie' : j === 'b' ? p : 25 - p);

// Pas d'un seul dé dans la vue, sous forme de paires [depuis, vers] poussées dans `out`.
function pasVue(moi, lui, de, out) {
  if (!Number.isInteger(de) || de < 1 || de > 6) return;
  if (moi[BARRE] > 0) {
    const v = BARRE - de;
    if (lui[v] < 2) out.push(BARRE, v);
    return;
  }
  // Point le plus éloigné occupé (hors barre) : sert à la sortie.
  let haut = 0;
  for (let p = 24; p >= 1; p--) if (moi[p] > 0) { haut = p; break; }
  const toutAuJan = haut <= 6;
  for (let p = haut; p >= 1; p--) {
    if (moi[p] === 0) continue;
    const v = p - de;
    if (v >= 1) {
      if (lui[v] < 2) out.push(p, v);
    } else if (toutAuJan && (v === 0 || p === haut)) {
      out.push(p, SORTIE);
    }
  }
}

// Joue un pas dans la vue ; renvoie 1 si un blot adverse est frappé.
function jouerVue(moi, lui, d, v) {
  moi[d]--;
  moi[v]++;
  if (v !== SORTIE && lui[v] === 1) { lui[v] = 0; return 1; }
  return 0;
}

function annulerVue(moi, lui, d, v, frappe) {
  moi[v]--;
  moi[d]++;
  if (frappe) lui[v] = 1;
}

// ---------- Pas ----------

export function pasLegaux(pos, j, de) {
  const { moi, lui } = vue(pos, j);
  if (!Number.isInteger(de) || de < 1 || de > 6) return [];
  const out = [];
  pasVue(moi, lui, de, out);
  const res = [];
  for (let i = 0; i < out.length; i += 2) {
    res.push({ depuis: versAbsolu(j, out[i]), vers: versAbsolu(j, out[i + 1]), de });
  }
  return res;
}

const memePas = (a, b) => a.depuis === b.depuis && a.vers === b.vers && a.de === b.de;

export function appliquerPas(pos, j, pas) {
  if (!pas || !pasLegaux(pos, j, pas.de).some((p) => memePas(p, pas))) {
    throw new Error(`Pas illégal : ${JSON.stringify(pas)}`);
  }
  const o = adversaire(j);
  const signe = j === 'b' ? 1 : -1;
  const points = pos.points.slice();
  const barre = { ...pos.barre };
  const sortis = { ...pos.sortis };
  if (pas.depuis === 'barre') barre[j]--;
  else points[pas.depuis - 1] -= signe;
  if (pas.vers === 'sortie') {
    sortis[j]++;
  } else {
    const i = pas.vers - 1;
    if (points[i] === -signe) { points[i] = 0; barre[o]++; }
    points[i] += signe;
  }
  return { points, barre, sortis };
}

// ---------- Tours ----------

// Recherche en profondeur sur les dés restants, dans la vue, avec des
// tableaux modifiés puis restaurés (pas de copie par nœud). Chaque feuille
// (plus aucun pas jouable, ou plus de dé) donne une séquence. Pour un double,
// les dés sont identiques : on ne branche que sur les valeurs distinctes,
// ce qui évite les séquences en double.
function sequencesVue(moi, lui, des) {
  const feuilles = [];
  const chemin = []; // triplets [depuis, vers, de]
  let max = 0;

  const restants = des.slice();
  const explorer = () => {
    let joue = false;
    const essayes = [];
    for (let k = 0; k < restants.length; k++) {
      const de = restants[k];
      if (de === 0 || essayes.includes(de)) continue;
      essayes.push(de);
      const out = [];
      pasVue(moi, lui, de, out);
      if (out.length === 0) continue;
      joue = true;
      restants[k] = 0;
      for (let i = 0; i < out.length; i += 2) {
        const d = out[i], v = out[i + 1];
        const frappe = jouerVue(moi, lui, d, v);
        chemin.push(d, v, de);
        explorer();
        chemin.length -= 3;
        annulerVue(moi, lui, d, v, frappe);
      }
      restants[k] = de;
    }
    if (!joue) {
      const n = chemin.length / 3;
      // Une feuille plus courte que le maximum déjà vu ne sera jamais gardée.
      if (n >= max) {
        if (n > max) { max = n; feuilles.length = 0; }
        feuilles.push(chemin.slice());
      }
    }
  };
  explorer();
  return { feuilles, max };
}

export function toursLegaux(pos, j, des) {
  const { moi, lui } = vue(pos, j);
  const r = sequencesVue(moi, lui, des);
  const max = r.max;
  let feuilles = r.feuilles;
  if (max === 0) return [[]];
  // Un seul dé jouable sur deux différents : le plus fort s'il se joue.
  if (max === 1 && des.length === 2 && des[0] !== des[1]) {
    const fort = Math.max(des[0], des[1]);
    const avecFort = feuilles.filter((f) => f[2] === fort);
    if (avecFort.length > 0) feuilles = avecFort;
  }
  return feuilles.map((f) => {
    const tour = [];
    for (let i = 0; i < f.length; i += 3) {
      tour.push({ depuis: versAbsolu(j, f[i]), vers: versAbsolu(j, f[i + 1]), de: f[i + 2] });
    }
    return tour;
  });
}

const prolonge = (tour, joues) => {
  if (tour.length < joues.length) return false;
  for (let i = 0; i < joues.length; i++) if (!memePas(tour[i], joues[i])) return false;
  return true;
};

export function pasPossibles(pos, j, des, joues) {
  const res = [];
  for (const t of toursLegaux(pos, j, des)) {
    if (t.length <= joues.length || !prolonge(t, joues)) continue;
    const p = t[joues.length];
    if (!res.some((r) => memePas(r, p))) res.push(p);
  }
  return res;
}

export function tourComplet(pos, j, des, joues) {
  return toursLegaux(pos, j, des).some((t) => t.length === joues.length && prolonge(t, joues));
}

/**
 * Enchaîne les pas du tour. Chaque pas est vérifié, mais pas le fait que le
 * tour soit maximal : l'appelant qui en a besoin passe par tourComplet ou
 * toursLegaux.
 */
export function appliquerTour(pos, j, tour) {
  let p = pos;
  for (const pas of tour) p = appliquerPas(p, j, pas);
  return p;
}

// ---------- Fin de manche ----------

export function issue(pos) {
  for (const g of ['b', 'n']) {
    if (pos.sortis[g] < 15) continue;
    const o = adversaire(g);
    if (pos.sortis[o] > 0) return { gagnant: g, type: 1 };
    let dansJan = pos.barre[o] > 0;
    // Jan intérieur du gagnant : 1–6 pour Blanc, 19–24 pour Noir.
    for (let a = 1; a <= 6 && !dansJan; a++) {
      const v = pos.points[g === 'b' ? a - 1 : 24 - a];
      if (o === 'n' ? v < 0 : v > 0) dansJan = true;
    }
    return { gagnant: g, type: dansJan ? 3 : 2 };
  }
  return null;
}
