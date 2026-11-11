// Échecs — l'échiquier de bois, en SVG construit par createElementNS.
// Cases d'érable et de noyer, cadre de noyer sombre aux coordonnées gravées
// de laiton, pièces ivoire et ébène dessinées ici (silhouettes en chemins SVG,
// reprises telles quelles par la vignette en Canvas 2D via Path2D).
// Par-dessus le dessin, un <button> par case : ce sont eux que le clavier et
// les lecteurs d'écran voient (un seul est dans l'ordre de tabulation).

import { nomCase } from './rules.js';

const NS = 'http://www.w3.org/2000/svg';

// Repère du dessin : cadre F, case S, côté total T.
export const GEO = { F: 30, S: 100, T: 860 };
const { F, S, T } = GEO;

export const BOIS = {
  erable: '#E2C796', noyer: '#8A5B39', cadre: '#3A2415', cadreClair: '#55361F',
  laiton: '#C9A227', ivoire: '#F3E9D2', ivoireOmbre: '#D9C7A2', ebene: '#241A15', ebeneReflet: '#4A3A31',
  encre: '#2B1D14', filet: '#E8D6A8', echec: '#B3261E',
};

// ---------------------------------------------------------------- pièces
// Chaque pièce tient dans une boîte 100 × 100, posée sur y = 90.
const rond = (cx, cy, r) => `M${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} Z`;
const socle = (hw) => `M${50 - hw} 90 Q${50 - hw} 82 ${58 - hw} 81 H${42 + hw} Q${50 + hw} 82 ${50 + hw} 90 Z `
  + `M${59 - hw} 81 L${63 - hw} 75 H${37 + hw} L${41 + hw} 81 Z`;

export const PIECES = {
  p: {
    corps: `${socle(24)} M39 75 Q43 60 44 47 H56 Q57 60 61 75 Z M37 49 Q50 41 63 49 Q50 55 37 49 Z ${rond(50, 33, 12)}`,
    details: '',
  },
  r: {
    corps: `${socle(27)} M36 75 L38 42 H62 L64 75 Z M31 42 V20 H40 V27 H46 V20 H54 V27 H60 V20 H69 V42 Z`,
    details: 'M35 42 H65 M39 60 H61',
  },
  b: {
    corps: `${socle(25)} M39 75 L43 62 H57 L61 75 Z M36 64 Q50 58 64 64 Q50 69 36 64 Z `
      + `M50 22 C65 32 67 50 58 62 H42 C33 50 35 32 50 22 Z ${rond(50, 18, 5)}`,
    details: 'M45 35 L56 47',
  },
  n: {
    corps: `${socle(27)} M66 75 C69 58 66 43 60 33 C57 27 55 21 51 17 L49 10 L45 18 C39 20 33 25 29 33 `
      + 'L21 45 C19 50 22 54 27 53 L33 51 C37 50 41 48 45 46 C43 55 38 64 35 75 Z',
    details: 'M39 30 h4 M55 22 C62 32 65 45 64 62',
  },
  q: {
    corps: `${socle(28)} M35 75 L39 55 H61 L65 75 Z `
      + 'M33 56 L24 29 L34 42 L37 22 L44 40 L50 18 L56 40 L63 22 L66 42 L76 29 L67 56 Z '
      + `${rond(24, 27, 4)} ${rond(37, 20, 4)} ${rond(50, 15, 4)} ${rond(63, 20, 4)} ${rond(76, 27, 4)}`,
    details: 'M36 56 H64 M38 64 H62',
  },
  k: {
    corps: `${socle(28)} M35 75 L39 57 H61 L65 75 Z `
      + 'M33 58 C25 46 28 33 39 34 C44 35 48 39 50 43 C52 39 56 35 61 34 C72 33 75 46 67 58 Z '
      + 'M47 37 V28 H41 V22 H47 V13 H53 V22 H59 V28 H53 V37 Z',
    details: 'M36 58 H64 M38 65 H62',
  },
};

// Les noms lus par les lecteurs d'écran : js/i18n.js (« roi blanc », « dame noire »…).
const t = (cle, p) => globalThis.LokoI18n.t(cle, p);
export function nomPiece(lettre) {
  return t(`piece.${lettre}`);
}

function el(nom, attrs, parent) {
  const e = document.createElementNS(NS, nom);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

// Une pièce dessinée dans la boîte 100 × 100, à placer par `transform`.
function dessinPiece(parent, lettre) {
  const blanc = lettre === lettre.toUpperCase();
  const t = PIECES[lettre.toLowerCase()];
  const trait = blanc ? BOIS.encre : BOIS.filet;
  el('ellipse', { cx: 50, cy: 90, rx: 29, ry: 5, fill: 'rgb(20 10 4 / .3)' }, parent);
  el('path', {
    d: t.corps, fill: blanc ? 'url(#ech-ivoire)' : 'url(#ech-ebene)',
    stroke: trait, 'stroke-width': blanc ? 5 : 4.5, 'stroke-linejoin': 'round', 'paint-order': 'stroke',
  }, parent);
  if (t.details) {
    el('path', { d: t.details, fill: 'none', stroke: trait, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: blanc ? 0.75 : 0.6 }, parent);
  }
}

/** Une pièce seule, dans son propre <svg> (la pièce portée pendant un glisser). */
export function creerPiece(lettre) {
  const svg = el('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' });
  dessinPiece(svg, lettre);
  return svg;
}

// --------------------------------------------------------------- décor
function construireDefs(svg) {
  const defs = el('defs', {}, svg);
  // Veinage : de fines lignes à peine visibles, deux sens pour alterner les placages.
  const veines = (id, angle, clair, fonce) => {
    const p = el('pattern', { id, width: 11, height: 160, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${angle})` }, defs);
    el('path', { d: 'M2 0 C3.5 45 1 100 2.5 160', stroke: fonce, 'stroke-width': 1.3, fill: 'none' }, p);
    el('path', { d: 'M7.5 0 C7 55 8.5 110 7 160', stroke: clair, 'stroke-width': 1, fill: 'none' }, p);
  };
  veines('ech-veines-a', 4, 'rgb(255 245 220 / .10)', 'rgb(70 35 10 / .11)');
  veines('ech-veines-b', 94, 'rgb(255 245 220 / .10)', 'rgb(70 35 10 / .11)');
  veines('ech-veines-c', 1, 'rgb(255 235 200 / .05)', 'rgb(0 0 0 / .16)');

  const ivoire = el('linearGradient', { id: 'ech-ivoire', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  el('stop', { offset: '0', 'stop-color': '#FFF9EA' }, ivoire);
  el('stop', { offset: '.55', 'stop-color': BOIS.ivoire }, ivoire);
  el('stop', { offset: '1', 'stop-color': BOIS.ivoireOmbre }, ivoire);
  const ebene = el('linearGradient', { id: 'ech-ebene', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  el('stop', { offset: '0', 'stop-color': BOIS.ebeneReflet }, ebene);
  el('stop', { offset: '.5', 'stop-color': BOIS.ebene }, ebene);
  el('stop', { offset: '1', 'stop-color': '#120C09' }, ebene);
  const echec = el('radialGradient', { id: 'ech-echec', cx: '50%', cy: '55%', r: '55%' }, defs);
  el('stop', { offset: '0', 'stop-color': BOIS.echec, 'stop-opacity': '.85' }, echec);
  el('stop', { offset: '.6', 'stop-color': BOIS.echec, 'stop-opacity': '.45' }, echec);
  el('stop', { offset: '1', 'stop-color': BOIS.echec, 'stop-opacity': '0' }, echec);
}

function construireDecor(svg) {
  const decor = el('g', { class: 'decor' }, svg);
  el('rect', { x: 0, y: 0, width: T, height: T, rx: 10, fill: BOIS.cadre }, decor);
  el('rect', { x: 0, y: 0, width: T, height: T, rx: 10, fill: 'url(#ech-veines-c)' }, decor);
  el('rect', { x: 3, y: 3, width: T - 6, height: T - 6, rx: 8, fill: 'none', stroke: BOIS.cadreClair, 'stroke-width': 2 }, decor);
  for (let dr = 0; dr < 8; dr++) {
    for (let dc = 0; dc < 8; dc++) {
      const clair = (dr + dc) % 2 === 0;
      const x = F + dc * S, y = F + dr * S;
      el('rect', { x, y, width: S, height: S, fill: clair ? BOIS.erable : BOIS.noyer }, decor);
      el('rect', { x, y, width: S, height: S, fill: (dr + dc) % 4 < 2 ? 'url(#ech-veines-a)' : 'url(#ech-veines-b)' }, decor);
    }
  }
  // Filet de laiton entre le cadre et les cases.
  el('rect', { x: F - 3, y: F - 3, width: 8 * S + 6, height: 8 * S + 6, fill: 'none', stroke: BOIS.laiton, 'stroke-width': 2.5, opacity: 0.9 }, decor);
}

// ---------------------------------------------------------------- export
export function creerEchiquier(conteneur) {
  const svg = el('svg', { viewBox: `0 0 ${T} ${T}`, class: 'dessin', 'aria-hidden': 'true', focusable: 'false' });
  conteneur.prepend(svg);
  construireDefs(svg);
  construireDecor(svg);
  const coords = el('g', { class: 'coords' }, svg);
  const marques = el('g', { class: 'marques' }, svg);
  const calquePieces = el('g', { class: 'pieces' }, svg);
  const dessus = el('g', { class: 'dessus' }, svg);

  const calque = document.createElement('div');
  calque.className = 'cases';
  conteneur.appendChild(calque);
  const boutons = [];
  for (let i = 0; i < 64; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'case';
    b.dataset.i = String(i);
    b.tabIndex = -1;
    boutons.push(b);
  }

  let retourne = null;
  let clePieces = '';
  let pieces = new Map();      // case → <g> animable
  let affichee = null;

  const place = (i) => {
    const f = i & 7, r = i >> 3;
    const dc = retourne ? 7 - f : f;
    const dr = retourne ? r : 7 - r;
    return { dc, dr, x: F + dc * S, y: F + dr * S };
  };

  function orienter(ret) {
    retourne = ret;
    coords.replaceChildren();
    for (let k = 0; k < 8; k++) {
      const col = 'abcdefgh'[ret ? 7 - k : k];
      const rang = String(ret ? k + 1 : 8 - k);
      const a = el('text', { x: F + k * S + S / 2, y: T - F / 2 + 1, class: 'coord' }, coords);
      a.textContent = col;
      const b = el('text', { x: F / 2, y: F + k * S + S / 2 + 1, class: 'coord' }, coords);
      b.textContent = rang;
    }
    // Les boutons suivent l'ordre affiché : de haut en bas, de gauche à droite.
    const ordre = boutons.slice().sort((p, q) => {
      const a = place(Number(p.dataset.i)), b = place(Number(q.dataset.i));
      return a.dr - b.dr || a.dc - b.dc;
    });
    for (const b of ordre) {
      const { dc, dr } = place(Number(b.dataset.i));
      b.style.left = `${dc * 12.5}%`;
      b.style.top = `${dr * 12.5}%`;
    }
    calque.replaceChildren(...ordre);
  }

  function dessiner(pos, { retourne: ret = false, selection = null, cibles = [], dernier = null, echec = null, porte = null, focus = null } = {}) {
    if (ret !== retourne) { orienter(ret); clePieces = ''; }
    affichee = pos;

    // Les pièces ne sont refaites que si elles changent : un nouveau rendu ne
    // coupe pas un glissement en cours.
    const cle = `${pos.cases.join(',')}|${porte}`;
    if (cle !== clePieces) {
      clePieces = cle;
      calquePieces.replaceChildren();
      pieces = new Map();
      pos.cases.forEach((lettre, i) => {
        if (!lettre) return;
        const { x, y } = place(i);
        const g = el('g', { class: i === porte ? 'piece portee' : 'piece' }, calquePieces);
        const dedans = el('g', { transform: `translate(${x} ${y})` }, g);
        dessinPiece(dedans, lettre);
        pieces.set(i, g);
      });
    }

    marques.replaceChildren();
    dessus.replaceChildren();
    if (dernier) {
      for (const i of dernier) {
        const { x, y } = place(i);
        el('rect', { x, y, width: S, height: S, class: 'dernier' }, marques);
      }
    }
    if (echec !== null) {
      const { x, y } = place(echec);
      el('rect', { x, y, width: S, height: S, fill: 'url(#ech-echec)' }, marques);
    }
    if (selection !== null) {
      const { x, y } = place(selection);
      el('rect', { x: x + 4, y: y + 4, width: S - 8, height: S - 8, class: 'choisie' }, marques);
    }
    const ens = new Set(cibles);
    const pionChoisi = selection !== null && pos.cases[selection].toLowerCase() === 'p';
    const prise = (v) => pos.cases[v] !== '' || (pionChoisi && (v & 7) !== (selection & 7));
    for (const v of ens) {
      const { x, y } = place(v);
      if (prise(v)) el('circle', { cx: x + S / 2, cy: y + S / 2, r: S / 2 - 7, class: 'anneau' }, dessus);
      else el('circle', { cx: x + S / 2, cy: y + S / 2, r: 12, class: 'point' }, dessus);
    }

    // Les boutons : nom, état, tabulation itinérante.
    const f = focus === null ? (ret ? 52 : 12) : focus;
    boutons.forEach((b, i) => {
      const lettre = pos.cases[i];
      let nom = t('caseNom', { case: nomCase(i), contenu: lettre ? nomPiece(lettre) : t('caseVide') });
      if (i === echec) nom += t('caseEchec');
      if (ens.has(i)) nom += t('caseArrivee');
      b.setAttribute('aria-label', nom);
      b.tabIndex = i === f ? 0 : -1;
      b.classList.toggle('arrivee', ens.has(i));
      if (i === selection) b.setAttribute('aria-pressed', 'true'); else b.removeAttribute('aria-pressed');
    });
  }

  /** Case sous un point de l'écran (coordonnées client), ou null. */
  function caseSous(cx, cy) {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const x = ((cx - r.left) / r.width) * T - F;
    const y = ((cy - r.top) / r.height) * T - F;
    if (x < 0 || y < 0 || x >= 8 * S || y >= 8 * S) return null;
    const dc = Math.floor(x / S), dr = Math.floor(y / S);
    const f = retourne ? 7 - dc : dc;
    const rg = retourne ? dr : 7 - dr;
    return rg * 8 + f;
  }

  /** Fait glisser la pièce arrivée (et la tour d'un roque) depuis son départ. */
  function animer(coup, ms) {
    return new Promise((resoudre) => {
      if (!ms || !affichee) { resoudre(); return; }
      const mouvements = [[coup.de, coup.vers]];
      const lettre = affichee.cases[coup.vers];
      if (lettre && lettre.toLowerCase() === 'k' && Math.abs((coup.vers & 7) - (coup.de & 7)) === 2) {
        const rang = coup.vers & 56;
        mouvements.push((coup.vers & 7) === 6 ? [rang + 7, rang + 5] : [rang, rang + 3]);
      }
      for (const [de, vers] of mouvements) {
        const g = pieces.get(vers);
        if (!g || !g.animate) continue;
        const a = place(de), b = place(vers);
        g.parentNode.appendChild(g);
        g.animate([{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)` }, { transform: 'translate(0px, 0px)' }],
          { duration: ms, easing: 'cubic-bezier(.3, .1, .2, 1)' });
      }
      setTimeout(resoudre, ms);
    });
  }

  /** Côté d'une case à l'écran, en pixels. */
  const tailleCase = () => (svg.getBoundingClientRect().width * S) / T;

  return { dessiner, caseSous, animer, bouton: (i) => boutons[i], tailleCase };
}
