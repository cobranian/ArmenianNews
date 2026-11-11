// Backgammon — le plateau de marqueterie, en SVG construit par createElementNS.
// Vu du côté de Blanc : son jan intérieur (points 1 à 6) est en bas à droite,
// les deux bacs de sortie sont à droite (Noir en haut, Blanc en bas).
// Par-dessus le dessin, un <button> transparent par point, pour la barre et
// pour chaque bac : ce sont eux que le clavier et les lecteurs d'écran voient.
//
// Sur un téléphone debout, le même dessin tourne d'un quart de tour (sens
// horaire) : le jan intérieur passe en bas à gauche, les bacs en bas, la barre
// en travers. Tout reste calculé dans le repère 1000 × 700 ; seuls les
// chiffres, le videau, les ombres et les reflets sont redressés.

import { appliquerTour } from './rules.js';
import { t as tr, tn as trn } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';

// Repère du dessin (viewBox 1000 × 700).
export const GEO = {
  L: 1000, H: 700,
  F: 22,              // cadre
  W: 68,              // largeur d'une flèche
  BX: 430, BW: 56,    // barre
  DX: 486,            // début du champ de droite
  TX: 906, TW: 70,    // colonne des bacs
  Y0: 22, Y1: 678,    // haut et bas du champ
  R: 29, D: 62,       // rayon d'une dame, pas d'empilement
  POINTE: 290,        // longueur d'une flèche
  MILIEU: 350,
};
const G = GEO;

/** Requête média du plateau debout ; la même figure dans css/style.css. */
export const DEBOUT = '(orientation: portrait) and (max-aspect-ratio: 2/3)';
// Un quart de tour horaire : (x, y) du repère → (H − y, x) à l'écran.
const QUART = `matrix(0 1 -1 0 ${G.H} 0)`;
// Reflets des dames (en fraction de leur boîte), pour une lumière venue
// d'en haut à gauche de l'écran dans les deux sens du plateau.
const REFLETS = {
  couche: { ivoire: ['38%', '32%'], ebene: ['38%', '30%'] },
  debout: { ivoire: ['32%', '62%'], ebene: ['30%', '62%'] },
};

/** Centre de la flèche `p` et son sens (haut : la base est en haut). */
export function colonne(p) {
  if (p <= 6) return { x: G.DX + (6 - p) * G.W + G.W / 2, haut: false };
  if (p <= 12) return { x: G.F + (12 - p) * G.W + G.W / 2, haut: false };
  if (p <= 18) return { x: G.F + (p - 13) * G.W + G.W / 2, haut: true };
  return { x: G.DX + (p - 19) * G.W + G.W / 2, haut: true };
}

/** Centre de la k-ième dame (0 = contre la base ; au-delà de 4 : sur la cinquième). */
export function caseDame(p, k) {
  const { x, haut } = colonne(p);
  const i = Math.min(k, 4);
  const y = haut ? G.Y0 + G.R + 2 + i * G.D : G.Y1 - G.R - 2 - i * G.D;
  return { x, y };
}

const BARRE_R = 24;
function caseBarre(j, k) {
  const i = Math.min(k, 4);
  const x = G.BX + G.BW / 2;
  return { x, y: j === 'b' ? G.MILIEU + 52 + i * 48 : G.MILIEU - 52 - i * 48 };
}
// Les dames sorties sont posées sur la tranche, en pile depuis le bord.
function caseBac(j, k) {
  const x = G.TX + G.TW / 2;
  return { x, y: j === 'n' ? G.Y0 + 14 + k * 20 : G.Y1 - 14 - k * 20 };
}
function caseVideau(proprietaire) {
  const x = G.BX + G.BW / 2;
  if (proprietaire === 'b') return { x, y: G.Y1 - 30 };
  if (proprietaire === 'n') return { x, y: G.Y0 + 30 };
  return { x, y: G.MILIEU };
}

// Couleurs des placages (reprises par la vignette).
export const BOIS = {
  noyer: '#5A3A22', noyerFonce: '#3E2715', palissandre: '#3A2318', buis: '#EAD9A8',
  poirier: '#C59464', poirierFonce: '#B5844F',
  sienne: '#A0522D', sienneFonce: '#86411F', erable: '#E6CF9F', erableFonce: '#D2B783',
  ivoire: '#F4ECD9', ebene: '#221A16', laiton: '#D9B44A', bac: '#2A1A10',
};

function el(nom, attrs, parent) {
  const e = document.createElementNS(NS, nom);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

// Les noms parlent des couleurs vues à l'écran : pour l'invité (inverse), les
// dames de Blanc sont d'ébène, donc « noires », et réciproquement.
const blanc = (j) => (j === 'b') !== inverse;
const dames = (n, j) => (n === 0 ? null : trn(blanc(j) ? 'damesBlanches' : 'damesNoires', n));

// ------------------------------------------------------------- le décor
let degrades = null;   // les deux dégradés des dames, dont le reflet suit le sens du plateau
let debout = false;    // le plateau est-il tourné d'un quart de tour ?
let inverse = false;   // vue de l'invité : l'ivoire et l'ébène des dames sont échangés

function construireDecor(svg) {
  const defs = el('defs', {}, svg);
  // Veines du placage : de fines lignes à peine visibles.
  const veines = el('pattern', { id: 'bg-veines', width: 9, height: 140, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(2)' }, defs);
  el('rect', { width: 9, height: 140, fill: 'none' }, veines);
  el('path', { d: 'M2 0 C3 40 1 90 2.5 140', stroke: 'rgb(60 30 10 / .10)', 'stroke-width': 1.2, fill: 'none' }, veines);
  el('path', { d: 'M6.5 0 C6 50 7.5 100 6.5 140', stroke: 'rgb(255 240 210 / .07)', 'stroke-width': 1, fill: 'none' }, veines);
  // Frise de losanges alternés, horizontale puis verticale.
  const frise = (id, w, h, horiz) => {
    const p = el('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: w, height: h, fill: BOIS.palissandre }, p);
    const pts = horiz ? `0,${h / 2} ${w / 2},0 ${w},${h / 2} ${w / 2},${h}` : `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
    el('polygon', { points: pts, fill: BOIS.erable }, p);
  };
  frise('bg-frise-h', 14, 10, true);
  frise('bg-frise-v', 10, 14, false);
  const ivoire = el('radialGradient', { id: 'bg-ivoire', cx: '38%', cy: '32%', r: '75%' }, defs);
  el('stop', { offset: '0', 'stop-color': '#FFFBF0' }, ivoire);
  el('stop', { offset: '.6', 'stop-color': BOIS.ivoire }, ivoire);
  el('stop', { offset: '1', 'stop-color': '#D8CBAE' }, ivoire);
  const ebene = el('radialGradient', { id: 'bg-ebene', cx: '38%', cy: '30%', r: '75%' }, defs);
  el('stop', { offset: '0', 'stop-color': '#4A3B33' }, ebene);
  el('stop', { offset: '.55', 'stop-color': BOIS.ebene }, ebene);
  el('stop', { offset: '1', 'stop-color': '#0E0A08' }, ebene);
  const creux = el('linearGradient', { id: 'bg-creux', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
  el('stop', { offset: '0', 'stop-color': '#140C07' }, creux);
  el('stop', { offset: '.3', 'stop-color': BOIS.bac }, creux);
  el('stop', { offset: '1', 'stop-color': '#3A2617' }, creux);
  degrades = { ivoire, ebene };

  const decor = el('g', { class: 'decor' }, svg);
  // Cadre en noyer, frise incrustée à mi-épaisseur.
  el('rect', { x: 0, y: 0, width: G.L, height: G.H, rx: 16, fill: BOIS.noyer }, decor);
  el('rect', { x: 0, y: 0, width: G.L, height: G.H, rx: 16, fill: 'url(#bg-veines)' }, decor);
  el('rect', { x: 6, y: 6, width: G.L - 12, height: 10, fill: 'url(#bg-frise-h)' }, decor);
  el('rect', { x: 6, y: G.H - 16, width: G.L - 12, height: 10, fill: 'url(#bg-frise-h)' }, decor);
  el('rect', { x: 6, y: 16, width: 10, height: G.H - 32, fill: 'url(#bg-frise-v)' }, decor);
  el('rect', { x: G.L - 16, y: 16, width: 10, height: G.H - 32, fill: 'url(#bg-frise-v)' }, decor);
  el('rect', { x: 5, y: 5, width: G.L - 10, height: G.H - 10, rx: 12, fill: 'none', stroke: BOIS.buis, 'stroke-width': 1.5 }, decor);
  el('rect', { x: 17, y: 17, width: G.L - 34, height: G.H - 34, fill: 'none', stroke: BOIS.buis, 'stroke-width': 1.5 }, decor);

  // Deux champs de poirier.
  for (const x of [G.F, G.DX]) {
    el('rect', { x, y: G.Y0, width: 6 * G.W, height: G.Y1 - G.Y0, fill: BOIS.poirier }, decor);
    el('rect', { x, y: G.Y0, width: 6 * G.W, height: G.Y1 - G.Y0, fill: 'url(#bg-veines)' }, decor);
  }
  // Les flèches : chacune en deux demi-placages appariés, un filet de buis au milieu.
  for (let p = 1; p <= 24; p++) {
    const { x, haut } = colonne(p);
    const base = haut ? G.Y0 : G.Y1;
    const pointe = haut ? G.Y0 + G.POINTE : G.Y1 - G.POINTE;
    const demi = G.W / 2 - 3;
    const sienne = p % 2 === 1;
    const a = sienne ? BOIS.sienne : BOIS.erable;
    const b = sienne ? BOIS.sienneFonce : BOIS.erableFonce;
    el('polygon', { points: `${x - demi},${base} ${x},${base} ${x},${pointe}`, fill: a }, decor);
    el('polygon', { points: `${x},${base} ${x + demi},${base} ${x},${pointe}`, fill: b }, decor);
    el('polygon', { points: `${x - demi},${base} ${x + demi},${base} ${x},${pointe}`, fill: 'url(#bg-veines)', stroke: BOIS.buis, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, decor);
    el('line', { x1: x, y1: base, x2: x, y2: pointe, stroke: BOIS.buis, 'stroke-width': .8, opacity: .7 }, decor);
  }
  for (const x of [G.F, G.DX]) {
    el('rect', { x: x + .75, y: G.Y0 + .75, width: 6 * G.W - 1.5, height: G.Y1 - G.Y0 - 1.5, fill: 'none', stroke: BOIS.buis, 'stroke-width': 1.5 }, decor);
  }

  // La barre en palissandre, une rose des vents incrustée au centre.
  el('rect', { x: G.BX, y: G.Y0 - 5, width: G.BW, height: G.Y1 - G.Y0 + 10, fill: BOIS.palissandre }, decor);
  el('rect', { x: G.BX, y: G.Y0 - 5, width: G.BW, height: G.Y1 - G.Y0 + 10, fill: 'url(#bg-veines)' }, decor);
  el('rect', { x: G.BX + 5, y: G.Y0 + 2, width: G.BW - 10, height: G.Y1 - G.Y0 - 4, fill: 'none', stroke: BOIS.buis, 'stroke-width': 1, opacity: .7 }, decor);
  const cx = G.BX + G.BW / 2, cy = G.MILIEU;
  for (let i = 0; i < 8; i++) {
    const t = (i * Math.PI) / 4;
    const lon = i % 2 === 0 ? 24 : 15;
    const lx = cx + Math.cos(t) * lon, ly = cy + Math.sin(t) * lon;
    const g1x = cx + Math.cos(t + .38) * 6, g1y = cy + Math.sin(t + .38) * 6;
    const g2x = cx + Math.cos(t - .38) * 6, g2y = cy + Math.sin(t - .38) * 6;
    el('polygon', { points: `${cx},${cy} ${g1x},${g1y} ${lx},${ly}`, fill: BOIS.erable }, decor);
    el('polygon', { points: `${cx},${cy} ${g2x},${g2y} ${lx},${ly}`, fill: BOIS.sienne }, decor);
  }

  // Les deux bacs, creusés.
  for (const [y, h] of [[G.Y0, 318], [G.MILIEU + 10, 318]]) {
    el('rect', { x: G.TX, y, width: G.TW, height: h, rx: 6, fill: 'url(#bg-creux)' }, decor);
    el('rect', { x: G.TX + .75, y: y + .75, width: G.TW - 1.5, height: h - 1.5, rx: 6, fill: 'none', stroke: BOIS.buis, 'stroke-width': 1.5 }, decor);
  }
}

// --------------------------------------------------------------- dames
function dame(parent, x, y, r, j, compte) {
  const ivoire = (j === 'b') !== inverse;   // l'invité voit ses dames (Blanc dans sa vue) en ébène
  const g = el('g', { class: 'dame' }, parent);
  // L'ombre tombe en bas à droite de l'écran, plateau couché ou debout.
  el('circle', { cx: x + (debout ? 3 : 1.5), cy: y + (debout ? -1.5 : 3), r, fill: 'rgb(20 8 0 / .35)' }, g);
  if (ivoire) {
    el('circle', { cx: x, cy: y, r: r - .5, fill: 'url(#bg-ivoire)', stroke: '#A8977A', 'stroke-width': 1 }, g);
    // L'anneau incrusté : l'ivoire se reconnaît aussi par son motif.
    el('circle', { cx: x, cy: y, r: r * .6, fill: 'none', stroke: BOIS.ebene, 'stroke-width': r * .13 }, g);
    el('circle', { cx: x, cy: y, r: r * .6 - r * .1, fill: 'none', stroke: BOIS.sienne, 'stroke-width': 1, opacity: .8 }, g);
  } else {
    el('circle', { cx: x, cy: y, r: r - .5, fill: 'url(#bg-ebene)', stroke: '#000', 'stroke-width': 1 }, g);
    el('circle', { cx: x, cy: y, r: r * .86, fill: 'none', stroke: 'rgb(255 240 220 / .14)', 'stroke-width': 1.2 }, g);
  }
  if (compte) {
    const t = el('text', {
      x, y: y + r * .02, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': r * .95, 'font-weight': 800, class: 'compte',
      fill: ivoire ? BOIS.ebene : BOIS.ivoire,
    }, g);
    if (debout) t.setAttribute('transform', `rotate(-90 ${x} ${y})`);
    t.textContent = String(compte);
  }
  return g;
}

function tranche(parent, x, y, j) {
  const ivoire = (j === 'b') !== inverse;
  const g = el('g', { class: 'dame' }, parent);
  el('rect', { x: x - 27, y: y - 8, width: 54, height: 16, rx: 4,
    fill: ivoire ? BOIS.ivoire : BOIS.ebene, stroke: ivoire ? '#A8977A' : '#000', 'stroke-width': 1 }, g);
  el('line', { x1: x - 18, y1: y, x2: x + 18, y2: y, stroke: ivoire ? BOIS.ebene : 'rgb(255 240 220 / .2)', 'stroke-width': 2 }, g);
  return g;
}

function videau(parent, valeur, proprietaire) {
  const { x, y } = caseVideau(proprietaire);
  const c = 44;
  const g = el('g', { class: 'videau' }, parent);
  if (debout) g.setAttribute('transform', `rotate(-90 ${x} ${y})`);
  el('rect', { x: x - c / 2 + 3, y: y - c / 2 + 4, width: c, height: c, rx: 7, fill: 'rgb(0 0 0 / .4)' }, g);
  // Un cube : la face, et la tranche du dessus, plus sombre.
  el('path', { d: `M${x - c / 2} ${y - c / 2 + 4} l6 -8 h${c} l-6 8 z`, fill: '#C9B993' }, g);
  el('path', { d: `M${x + c / 2} ${y - c / 2 + 4} l6 -8 v${c} l-6 8 z`, fill: '#B5A47C' }, g);
  el('rect', { x: x - c / 2, y: y - c / 2 + 4, width: c, height: c, rx: 5, fill: BOIS.ivoire, stroke: '#8D7B5C', 'stroke-width': 1.2 }, g);
  const t = el('text', { x, y: y + 4.5, 'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-size': 22, 'font-weight': 800, fill: BOIS.sienneFonce, class: 'chiffre' }, g);
  t.textContent = String(valeur === 1 ? 64 : valeur);
}

// ---------------------------------------------------------------- export
export function creerPlateau(conteneur) {
  const svg = el('svg', { viewBox: `0 0 ${G.L} ${G.H}`, class: 'dessin', 'aria-hidden': 'true', focusable: 'false' });
  conteneur.prepend(svg);
  // Tout le dessin vit dans `monde`, que le plateau debout fait tourner.
  const monde = el('g', { class: 'monde' }, svg);
  construireDecor(monde);
  const marques = el('g', { class: 'marques' }, monde);
  const pions = el('g', { class: 'pions' }, monde);
  const dessus = el('g', { class: 'dessus' }, monde);

  // Les boutons, dans l'ordre de la course de Blanc : barre, 24 → 1, sorties.
  const calque = document.createElement('div');
  calque.className = 'cases';
  conteneur.appendChild(calque);
  const boutons = new Map();
  const zones = new Map();   // bouton → son rectangle dans le repère 1000 × 700
  // Place un bouton sur son rectangle, à l'écran, selon le sens du plateau.
  const placer = (b) => {
    const [x, y, w, h] = zones.get(b);
    const [l, t, lw, th] = debout
      ? [(G.H - y - h) / G.H, x / G.L, h / G.H, w / G.L]
      : [x / G.L, y / G.H, w / G.L, h / G.H];
    b.style.left = `${l * 100}%`;
    b.style.top = `${t * 100}%`;
    b.style.width = `${lw * 100}%`;
    b.style.height = `${th * 100}%`;
  };
  const bouton = (cible, x, y, w, h) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'case';
    b.dataset.cible = String(cible);
    zones.set(b, [x, y, w, h]);
    placer(b);
    calque.appendChild(b);
    boutons.set(String(cible), b);
  };
  bouton('barre', G.BX, G.Y0, G.BW, G.Y1 - G.Y0);
  for (let p = 24; p >= 1; p--) {
    const { x, haut } = colonne(p);
    bouton(p, x - G.W / 2, haut ? G.Y0 : G.MILIEU, G.W, G.MILIEU - G.Y0);
  }
  bouton('sortie', G.TX, G.MILIEU + 10, G.TW, 318);
  bouton('sortie-n', G.TX, G.Y0, G.TW, 318);

  let affichee = null;
  let derniers = null;   // les arguments du dernier dessin, pour redessiner au changement de sens

  function dessiner(partie, { joues = [], selection = null, arrivees = [], jouables = [], porte = null, mouvement = null } = {}) {
    const pos = partie && partie.phase === 'deplacer' && joues.length
      ? appliquerTour(partie.position, partie.trait, joues)
      : partie.position;
    affichee = pos;
    // Sans le mouvement : un redessin au changement de sens ne rejoue pas le glissement.
    derniers = [partie, { joues, selection, arrivees, jouables, porte }];
    marques.replaceChildren();
    pions.replaceChildren();
    dessus.replaceChildren();
    const sommets = new Map();   // cible → élément de la dame du dessus
    const arr = new Set(arrivees.map(String));
    const jou = new Set(jouables.map(String));

    // Marques des arrivées, sous les dames.
    for (const v of arr) {
      if (v === 'sortie') continue;
      const p = Number(v);
      const { x, haut } = colonne(p);
      const base = haut ? G.Y0 : G.Y1;
      const pointe = haut ? G.Y0 + G.POINTE : G.Y1 - G.POINTE;
      el('polygon', { points: `${x - G.W / 2 + 3},${base} ${x + G.W / 2 - 3},${base} ${x},${pointe}`, class: 'lueur' }, marques);
    }

    for (let p = 1; p <= 24; p++) {
      const v = pos.points[p - 1];
      const n = Math.abs(v);
      const j = v > 0 ? 'b' : 'n';
      for (let k = 0; k < Math.min(n, 5); k++) {
        const { x, y } = caseDame(p, k);
        const g = dame(pions, x, y, G.R, j, k === 4 && n > 5 ? n : 0);
        if (k === Math.min(n, 5) - 1) sommets.set(String(p), g);
      }
    }
    for (const j of ['b', 'n']) {
      const n = pos.barre[j];
      for (let k = 0; k < Math.min(n, 5); k++) {
        const { x, y } = caseBarre(j, k);
        const g = dame(pions, x, y, BARRE_R, j, k === 4 && n > 5 ? n : 0);
        if (k === Math.min(n, 5) - 1 && j === 'b') sommets.set('barre', g);
        if (k === Math.min(n, 5) - 1 && j === 'n') sommets.set('barre-n', g);
      }
      const s = pos.sortis[j];
      for (let k = 0; k < s; k++) {
        const { x, y } = caseBac(j, k);
        const g = tranche(pions, x, y, j);
        if (k === s - 1) sommets.set(j === 'b' ? 'sortie' : 'sortie-n', g);
      }
    }
    if (partie.videauActif) videau(pions, partie.cube.valeur, partie.cube.proprietaire);

    // Dame choisie : un anneau de laiton, et la dame se soulève un peu.
    const sel = selection === null ? null : String(selection);
    if (sel && sommets.has(sel)) {
      const g = sommets.get(sel);
      g.classList.add(porte !== null ? 'portee' : 'choisie');
      const c = g.querySelector('circle:nth-child(2)');
      el('circle', { cx: c.getAttribute('cx'), cy: c.getAttribute('cy'), r: Number(c.getAttribute('r')) + 4, class: 'anneau' }, g);
    }
    // Losanges de laiton là où la dame arriverait.
    for (const v of arr) {
      let x, y;
      if (v === 'sortie') {
        ({ x, y } = caseBac('b', pos.sortis.b));
        el('rect', { x: G.TX + 2, y: G.MILIEU + 12, width: G.TW - 4, height: 314, rx: 6, class: 'bac-lueur' }, marques);
      } else {
        const p = Number(v);
        const mien = pos.points[p - 1] > 0 ? pos.points[p - 1] : 0;
        ({ x, y } = caseDame(p, mien));
      }
      el('polygon', { points: `${x},${y - 13} ${x + 10},${y} ${x},${y + 13} ${x - 10},${y}`, class: 'losange' }, dessus);
    }

    // Glissement de la dame jouée, depuis son ancienne place.
    if (mouvement && mouvement.ms > 0) {
      const { pas, joueur, ms } = mouvement;
      const cle = pas.vers === 'sortie' ? (joueur === 'b' ? 'sortie' : 'sortie-n') : String(pas.vers);
      const g = sommets.get(cle);
      if (g && g.animate) {
        const depart = pas.depuis === 'barre'
          ? caseBarre(joueur, pos.barre[joueur])
          : caseDame(pas.depuis, Math.abs(pos.points[pas.depuis - 1]));
        const n = pas.vers === 'sortie' ? pos.sortis[joueur] - 1 : Math.abs(pos.points[pas.vers - 1]) - 1;
        const arrivee = pas.vers === 'sortie' ? caseBac(joueur, n) : caseDame(pas.vers, n);
        const dx = depart.x - arrivee.x, dy = depart.y - arrivee.y;
        g.parentNode.appendChild(g);
        g.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
          { duration: ms, easing: 'cubic-bezier(.3, .1, .2, 1)' });
      }
    }

    // Les boutons : noms, ordre de tabulation, état.
    for (const [cible, b] of boutons) {
      let nom;
      if (cible === 'barre') {
        const parts = [dames(pos.barre.b, 'b'), dames(pos.barre.n, 'n')].filter(Boolean);
        const contenu = parts.length === 2 ? tr('paire', { a: parts[0], b: parts[1] }) : parts[0] || tr('vide');
        nom = tr('caseBarre', { contenu });
      } else if (cible === 'sortie' || cible === 'sortie-n') {
        const j = cible === 'sortie' ? 'b' : 'n';
        nom = trn(blanc(j) ? 'sortieBlanches' : 'sortieNoires', pos.sortis[j]);
      } else {
        const v = pos.points[Number(cible) - 1];
        nom = tr('casePoint', { p: cible, contenu: v === 0 ? tr('vide') : dames(Math.abs(v), v > 0 ? 'b' : 'n') });
      }
      if (arr.has(cible)) nom += tr('arrivee');
      if (sel === cible) nom += tr('choisi');
      b.setAttribute('aria-label', nom);
      const jouable = jou.has(cible) || arr.has(cible);
      b.tabIndex = jouable ? 0 : -1;
      b.classList.toggle('jouable', jouable);
      b.classList.toggle('arrivee', arr.has(cible));
      if (sel === cible) b.setAttribute('aria-pressed', 'true'); else b.removeAttribute('aria-pressed');
    }
  }

  /** Cible sous un point de l'écran (coordonnées client). */
  function pointSous(cx, cy) {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
    // Debout, l'écran montre (H − y, x) : on revient au repère.
    const x = debout ? fy * G.L : fx * G.L;
    const y = debout ? G.H - fx * G.H : fy * G.H;
    if (y < G.Y0 - 6 || y > G.Y1 + 6) return null;
    if (x >= G.BX && x < G.BX + G.BW) return 'barre';
    if (x >= G.TX - 8 && x <= G.TX + G.TW + 8) return 'sortie';
    const haut = y < G.MILIEU;
    let col;
    if (x >= G.F && x < G.BX) {
      col = Math.floor((x - G.F) / G.W);
      return haut ? 13 + col : 12 - col;
    }
    if (x >= G.DX && x < G.DX + 6 * G.W) {
      col = Math.floor((x - G.DX) / G.W);
      return haut ? 19 + col : 6 - col;
    }
    return null;
  }

  /** Taille à l'écran, en pixels, d'une longueur du repère. */
  function pixels(unites) {
    const r = svg.getBoundingClientRect();
    return (r.width * unites) / (debout ? G.H : G.L);
  }

  /** Vue de l'invité : ses dames (Blanc dans le repère) sont dessinées en ébène. */
  function inverser(v) {
    inverse = !!v;
    if (derniers) api.dessiner(...derniers);
  }

  const api = { dessiner, pointSous, pixels, inverser, bouton: (cible) => boutons.get(String(cible)), position: () => affichee };

  function orienter(v) {
    debout = v;
    svg.setAttribute('viewBox', v ? `0 0 ${G.H} ${G.L}` : `0 0 ${G.L} ${G.H}`);
    if (v) monde.setAttribute('transform', QUART); else monde.removeAttribute('transform');
    const reflets = REFLETS[v ? 'debout' : 'couche'];
    for (const nom of ['ivoire', 'ebene']) {
      degrades[nom].setAttribute('cx', reflets[nom][0]);
      degrades[nom].setAttribute('cy', reflets[nom][1]);
    }
    conteneur.classList.toggle('debout', v);
    conteneur.setAttribute('aria-label', tr(v ? 'plateauGauche' : 'plateauDroite'));
    for (const b of boutons.values()) placer(b);
    // Par `api` : main.js peut avoir enveloppé dessiner (vue de l'invité).
    if (derniers) api.dessiner(...derniers);
  }
  const mq = typeof matchMedia === 'function' ? matchMedia(DEBOUT) : null;
  orienter(!!(mq && mq.matches));
  if (mq) mq.addEventListener('change', (e) => orienter(e.matches));

  return api;
}
