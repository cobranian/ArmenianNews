// Journaux par siège (spec 2026-10-30, étape 3) — fonction PURE, sans
// réseau ni DOM, utilisée par salle2.js et testée par tests/net.test.js.
//
// Chaque siège S a son journal s<S>/j/<n> = { a, t } : n = 0, 1, 2…, une
// entrée écrite une seule fois, par S seul, avec t = heure du serveur (les
// règles le garantissent). Les deux clients fusionnent les deux journaux de
// la même façon, puis le jeu rejoue les actions dans cet ordre en ignorant
// celles qui sont illégales à leur place : deux clients qui ont reçu les
// mêmes entrées arrivent au même état.

export const MAX_N = 99999;
export const MAX_ACTION = 400;

// Un journal tel que lu dans la salle (objet { "0": {a, t}, … }, ou tableau
// quand Firebase le rend ainsi) → ses entrées valides, de n = 0 jusqu'au
// premier trou ou à la première entrée mal formée (exclus).
export function lireJournal(brut, siege) {
  const res = [];
  if (!brut || typeof brut !== 'object') return res;
  for (let n = 0; n <= MAX_N; n++) {
    const e = brut[n];
    if (!e || typeof e !== 'object' || Array.isArray(e)) break;
    const { a, t } = e;
    if (typeof a !== 'string' || a.length < 1 || a.length > MAX_ACTION) break;
    if (typeof t !== 'number' || !Number.isFinite(t)) break;
    res.push({ siege, n, a, t });
  }
  return res;
}

// Les deux journaux, fusionnés dans l'ordre (t, siège, n).
// `provisoires` : Set des n de MON journal pas encore confirmés par le
// serveur (leur t est une estimation locale) ; `monSiege` les désigne.
export function fusionner(brut1, brut2, { monSiege = 0, provisoires = null } = {}) {
  const tout = [...lireJournal(brut1, 1), ...lireJournal(brut2, 2)];
  for (const e of tout) e.provisoire = !!(provisoires && e.siege === monSiege && provisoires.has(e.n));
  tout.sort((x, y) => x.t - y.t || x.siege - y.siege || x.n - y.n);
  return tout;
}
