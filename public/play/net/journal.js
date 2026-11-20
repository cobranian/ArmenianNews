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
// premier trou, à la première entrée mal formée, ou à la première entrée
// ANTIDATÉE — plus ancienne que la précédente (exclus).
//
// Pourquoi l'antidatage : une entrée écrite tôt derrière un trou (n + 1 avant
// n) reste invisible jusqu'à ce que le trou soit comblé, puis se trierait par
// son heure AVANT des entrées auxquelles l'autre joueur a déjà répondu — un
// coup repris aux échecs, un double ou des dés choisis après coup au
// backgammon. Un journal honnête s'écrit dans l'ordre, donc ses heures
// serveur ne décroissent jamais (les règles exigent en outre n − 1 avant n).
//
// `provisoires` : Set des n de ce journal pas encore confirmés par le
// serveur. Leur t est une estimation locale, qui peut tomber un peu avant la
// précédente : ils ne sont pas coupés, mais ramenés à l'heure de la dernière
// entrée confirmée, et ne servent pas de référence aux suivantes.
export function lireJournal(brut, siege, provisoires = null) {
  const res = [];
  if (!brut || typeof brut !== 'object') return res;
  let dernier = -Infinity;
  for (let n = 0; n <= MAX_N; n++) {
    const e = brut[n];
    if (!e || typeof e !== 'object' || Array.isArray(e)) break;
    const { a } = e;
    let { t } = e;
    if (typeof a !== 'string' || a.length < 1 || a.length > MAX_ACTION) break;
    if (typeof t !== 'number' || !Number.isFinite(t)) break;
    if (provisoires && provisoires.has(n)) t = Math.max(t, dernier);
    else if (t < dernier) break;
    else dernier = t;
    res.push({ siege, n, a, t });
  }
  return res;
}

// Les deux journaux, fusionnés dans l'ordre (t, siège, n).
// `provisoires` : Set des n de MON journal pas encore confirmés par le
// serveur (leur t est une estimation locale) ; `monSiege` les désigne.
export function fusionner(brut1, brut2, { monSiege = 0, provisoires = null } = {}) {
  const tout = [
    ...lireJournal(brut1, 1, monSiege === 1 ? provisoires : null),
    ...lireJournal(brut2, 2, monSiege === 2 ? provisoires : null),
  ];
  for (const e of tout) e.provisoire = !!(provisoires && e.siege === monSiege && provisoires.has(e.n));
  tout.sort((x, y) => x.t - y.t || x.siege - y.siege || x.n - y.n);
  return tout;
}
