// Backgammon — le DOM : menu, plateau de marqueterie, dés à l'écran, gestes
// (toucher, glisser, clavier), tour du robot (worker.js, repli sur le fil
// principal), videau, reprise de la partie sauvegardée, vignette. Le mode ami
// (bas du fichier) charge la couche de salles du portail par import()
// dynamique : une partie contre le robot ne télécharge jamais le SDK Firebase.

import { t, tn, traduirePage } from './i18n.js';
import { toursLegaux, pasPossibles, tourComplet, deDepuisOctet, appliquerPas } from './rules.js';
import {
  nouveauMatch, ouverture, lancer, jouerTour, peutDoubler, doubler, accepter, refuser, mancheSuivante,
} from './match.js';
import { lirePartie, ecrirePartie } from './sauvegarde.js';
import { NIVEAUX, BUDGET_MS, choisirTour, veutDoubler, accepteDouble } from './robot.js';
import { creerPlateau, GEO, BOIS, colonne, caseDame } from './plateau.js';
import { nouveauSecret, engagement } from './hasard.js';
import {
  partageInitial, lirePartage, replier, encoderAction, actionMatch, acteurAttendu, abandonne,
  miroirPartie, miroirTour, peutReclamer, lireCle, ecrireCle, retenirSecret, secretPour,
} from './remote.js';

const $ = (id) => document.getElementById(id);
const CLE_PARTIE = 'backgammon.partie';
const CLE_PSEUDO = 'backgammon.pseudo';
const CLE_AMI = 'backgammon.ami.';            // + code de la salle : la clé des dés
const CLE_AMI_NEUVE = 'backgammon.ami.nouvelle'; // clé de l'hôte avant que la salle ait un code
const GARDE_MS = 350;          // double toucher sur la même cible : le second est ignoré
const DELAI_TRAVAILLEUR_MS = 3000;
const PAS_ROBOT_MS = 300;
const PAS_HUMAIN_MS = 170;
const ROULE_MS = 700;
const SEUIL_GLISSER = 8;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const reduit = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const delaiRobot = () => 400 + Math.random() * 300;

// Statistiques du portail (lokolok/assets/stats.js) : absentes hors du portail.
// Une manche = une partie (début, puis fin).
const stat = (n, p) => { try { if (window.lokolokStat) window.lokolokStat(n, p); } catch (_) { /* jamais d'erreur */ } };
let statEnCours = null;       // { mode, cle } : la manche dont le début est parti, pas encore la fin
const FINS = ['fin-manche', 'fin-match'];
// À chaque étape : la manche commence (début) ou s'achève (fin, vue du joueur local 'b').
function noterStat(mode, cle, p, niv) {
  if (FINS.includes(p.phase)) {
    if (statEnCours && statEnCours.cle === cle) {
      stat('partie_fin', { mode, issue: p.resultat && p.resultat.gagnant === 'b' ? 'gagne' : 'perdu' });
      statEnCours = null;
    }
    return;
  }
  if (statEnCours && statEnCours.cle === cle) return;
  statAbandon();
  statEnCours = { mode, cle };
  stat('partie_debut', niv ? { mode, niveau: niv } : { mode });
}
// Quitter une manche commencée et pas finie.
function statAbandon() {
  if (statEnCours) stat('partie_fin', { mode: statEnCours.mode, issue: 'abandon' });
  statEnCours = null;
}

// ---------------------------------------------------------------- mémoire
function lire(cle) { try { return localStorage.getItem(cle); } catch (_) { return null; } }
function ecrire(cle, v) { try { localStorage.setItem(cle, v); } catch (_) { /* sans mémoire */ } }
function effacer(cle) { try { localStorage.removeItem(cle); } catch (_) { /* sans mémoire */ } }
const lireNiveau = () => { const n = lire('backgammon.niveau'); return NIVEAUX.includes(n) ? n : 'moyen'; };
const lireLongueur = () => { const n = lire('backgammon.longueur'); return ['1', '3', '5'].includes(n) ? Number(n) : 3; };
const lireVideau = () => { const n = lire('backgammon.videau'); return n === '0' ? false : true; };
const lirePseudo = () => String(lire(CLE_PSEUDO) || '').slice(0, 20);

// -------------------------------------------------------------------- dés
// Un octet ≥ 252 est rejeté (deDepuisOctet rend null) : aucun biais.
function tirerDe() {
  for (;;) {
    const octets = crypto.getRandomValues(new Uint8Array(8));
    for (const o of octets) {
      const d = deDepuisOctet(o);
      if (d !== null) return d;
    }
  }
}

// Les faces : 1 devant, 6 derrière, 3 à droite, 4 à gauche, 2 dessus, 5 dessous.
const FACES = [
  { v: 1, t: 'translateZ(var(--demi))' },
  { v: 6, t: 'rotateY(180deg) translateZ(var(--demi))' },
  { v: 3, t: 'rotateY(90deg) translateZ(var(--demi))' },
  { v: 4, t: 'rotateY(-90deg) translateZ(var(--demi))' },
  { v: 2, t: 'rotateX(90deg) translateZ(var(--demi))' },
  { v: 5, t: 'rotateX(-90deg) translateZ(var(--demi))' },
];
const ORIENTATION = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
const POINTS_FACE = {
  1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
};
function creerCube(valeur, roule) {
  const de = document.createElement('span');
  de.className = 'de';
  const cube = document.createElement('span');
  cube.className = 'cube';
  const [rx, ry] = ORIENTATION[valeur];
  cube.style.setProperty('--rx', `${rx}deg`);
  cube.style.setProperty('--ry', `${ry}deg`);
  for (const f of FACES) {
    const face = document.createElement('span');
    face.className = 'face';
    face.style.transform = f.t;
    for (const pos of POINTS_FACE[f.v]) {
      const p = document.createElement('i');
      p.style.gridArea = `${Math.ceil(pos / 3)} / ${((pos - 1) % 3) + 1}`;
      face.appendChild(p);
    }
    cube.appendChild(face);
  }
  if (roule) {
    // Chaque dé part d'un peu plus loin, avec ses propres tours.
    cube.style.setProperty('--tx', `${(Math.random() * 1.6 + 1.4).toFixed(2)}`);
    cube.style.setProperty('--tours-x', `${(Math.random() < .5 ? -1 : 1) * (360 + 180 * Math.floor(Math.random() * 2))}deg`);
    cube.style.setProperty('--tours-y', `${(Math.random() < .5 ? -1 : 1) * 360}deg`);
    cube.classList.add('roule');
  }
  de.appendChild(cube);
  return de;
}
// Un dé dont la valeur n'est pas encore connue (mode ami : l'ami doit révéler
// son secret) : il tourne sur lui-même jusqu'à la révélation.
function creerCubeEnAttente() {
  const de = creerCube(1 + Math.floor(Math.random() * 6), false);
  de.classList.add('attend');
  de.firstChild.classList.add('tourne');
  return de;
}

// ----------------------------------------------------------------- état
let plateau = null;
let partie = null;
let niveau = 'moyen';
let jeton = 0;                // change à chaque partie : les boucles périmées s'arrêtent
let joues = [];               // pas du tour de l'humain, non validés
let selection = null;
let humainActif = false;      // le plateau accepte les gestes
let finAnim = 0;              // performance.now() de la fin de l'animation en cours
let derniereTape = -Infinity;
let derniereCible = null;
let dernierPointeur = -Infinity;
let geste = null;
let fantome = null;
let attente = null;           // { types, resoudre } : boutons attendus
let minuteurAnnonce = null;
let desAffiches = null;       // { b: [valeurs], n: [valeurs] } : quels dés sont posés de quel côté
let ami = null;               // mode ami : le contexte de la salle (voir partieAmi)

const occupe = () => performance.now() < finAnim;

// Un geste ou un bouton reçu pendant le glissement d'une dame attend sa fin,
// dans l'ordre d'arrivée (le glissement n'est pas coupé par un nouveau rendu).
const enSuspens = [];
let minuteurSuspens = null;
function apresAnim(f) {
  if (enSuspens.length >= 4) return;
  enSuspens.push(f);
  if (minuteurSuspens === null) planifierSuspens();
}
function planifierSuspens() {
  minuteurSuspens = setTimeout(() => {
    minuteurSuspens = null;
    while (enSuspens.length) {
      if (occupe()) { planifierSuspens(); return; }
      enSuspens.shift()();
    }
  }, Math.max(0, finAnim - performance.now()) + 10);
}
function viderSuspens() {
  enSuspens.length = 0;
  clearTimeout(minuteurSuspens);
  minuteurSuspens = null;
}

// Le focus est perdu (sur <body> ou sur un bouton qui vient de se cacher) :
// il revient sur la première case jouable, sinon sur le plateau.
function rendreFocus() {
  const a = document.activeElement;
  if (a && a !== document.body && !a.closest('[hidden]')) return;
  if ($('partie').inert) return;
  const c = $('plateau').querySelector('.case.jouable');
  (c || $('plateau')).focus({ preventScroll: true });
}

// Ce qui vient d'arriver (le tour du robot, sa réponse au double) est lu
// avec l'annonce suivante : une seule mise à jour du bandeau.
let aDire = '';
function retenir(texte) { aDire = texte; }
function annoncer(texte, duree = 0) {
  clearTimeout(minuteurAnnonce);
  if (aDire) { texte = texte ? `${aDire} ${texte}` : aDire; aDire = ''; duree = 0; }
  $('annonce').textContent = texte;
  if (texte && duree) minuteurAnnonce = setTimeout(() => { $('annonce').textContent = ''; }, duree);
}

// ----------------------------------------------------------------- écrans
const ECRANS = ['menu', 'double', 'fin', 'invite', 'attente'];
function montrer(nom) {
  for (const e of ECRANS) $('ecran-' + e).hidden = e !== nom;
  $('partie').inert = !!nom;
  if (nom) {
    const cible = $('ecran-' + nom).querySelector('button:not([hidden])');
    if (cible) cible.focus();
  }
}
const ecranOuvert = () => ECRANS.some((e) => !$('ecran-' + e).hidden);
function erreur(message) {
  montrer('attente');
  $('attente-statut').textContent = message;
}
// Nom de l'adversaire : le robot, ou l'ami (son prénom seulement au score).
const nomAdversaire = () => (ami ? t('oppAmi') : t('oppRobot'));
const nomScore = () => (ami ? ami.nomAmi || t('scoreAmi') : t('scoreRobot'));

// Attend l'un des boutons `types` ; ils paraissent aussitôt, le premier
// visible prend le focus si `focus` est demandé.
function attendre(types, focus = false) {
  const p = new Promise((resoudre) => { attente = { types, resoudre }; });
  if (partie) renduBoutons();
  if (focus) {
    const ids = { lancer: 'btn-lancer', doubler: 'btn-lancer', valider: 'btn-valider' };
    const b = ids[types[0]] && $(ids[types[0]]);
    if (b && !b.hidden) b.focus();
  }
  return p;
}
function agir(type) {
  if (!attente || !attente.types.includes(type)) return;
  if (occupe()) { apresAnim(() => agir(type)); return; }
  const a = attente;
  attente = null;
  if (partie) renduBoutons();
  a.resoudre(type);
}

// ------------------------------------------------------------------ rendu
function possibles() {
  if (!partie || partie.phase !== 'deplacer' || partie.trait !== 'b') return [];
  return pasPossibles(partie.position, 'b', partie.des, joues);
}

function rendu(mouvement = null) {
  const ps = humainActif ? possibles() : [];
  const origines = [...new Set(ps.map((p) => p.depuis))];
  const arrivees = selection === null ? [] : [...new Set(ps.filter((p) => p.depuis === selection).map((p) => p.vers))];
  plateau.dessiner(partie, {
    joues: partie.phase === 'deplacer' ? joues : [],
    selection, arrivees, jouables: origines,
    porte: geste && geste.glisse ? geste.c : null,
    mouvement,
  });
  renduPanneau();
  renduBoutons();
  renduDes();
}

function renduPanneau(p = partie) {
  $('score').textContent = texteScore(p);
  $('manche').textContent = t('manche', { n: p.manche });
  $('crawford').hidden = p.crawford !== 'pendant';
  $('videau-texte').hidden = !p.videauActif;
  const ou = p.cube.proprietaire === null ? 'videauCentre' : p.cube.proprietaire === 'b' ? 'videauToi' : ami ? 'videauAmi' : 'videauRobot';
  $('videau-texte').textContent = t(ou, { v: p.cube.valeur });
}
const texteScore = (p) => t('score', { b: p.score.b, n: p.score.n, nom: nomScore(), l: p.longueur });

function renduBoutons() {
  const a = attente ? attente.types : [];
  const moi = partie.trait === 'b';
  $('btn-lancer').hidden = !a.includes('lancer');
  $('btn-doubler').hidden = !(a.includes('doubler') && moi && peutDoubler(partie));
  const deplace = a.includes('valider');
  $('btn-annuler').hidden = !deplace;
  $('btn-valider').hidden = !deplace;
  $('btn-annuler').disabled = joues.length === 0;
  $('btn-valider').disabled = !(deplace && tourComplet(partie.position, 'b', partie.des, joues));
}

function compter(liste) {
  const m = new Map();
  for (const v of liste) m.set(v, (m.get(v) || 0) + 1);
  return m;
}
function nommerDes(valeurs) {
  if (valeurs.length === 4) return t('desDouble', { v: valeurs[0] });
  if (valeurs.length === 2) return t('paire', { a: valeurs[0], b: valeurs[1] });
  return valeurs.join(t('sep'));
}

// Les dés posés : à droite ceux de l'humain, à gauche ceux du robot.
function poserDes(b, n, roule) {
  desAffiches = { b, n };
  for (const j of ['b', 'n']) {
    const boite = $('des-' + j);
    const vals = desAffiches[j];
    boite.replaceChildren(...vals.map((v) => creerCube(v, roule && !reduit())));
  }
  if (roule && !reduit()) finAnim = Math.max(finAnim, performance.now() + ROULE_MS);
  renduDes();
}
function renduDes() {
  if (!desAffiches) return;
  const enJeu = partie.phase === 'deplacer' ? partie.trait : null;
  const utilises = enJeu ? compter((enJeu === 'b' ? joues : jouesRobot).map((p) => p.de)) : new Map();
  for (const j of ['b', 'n']) {
    const boite = $('des-' + j);
    const vals = desAffiches[j];
    const reste = new Map(utilises);
    let joue = 0;
    [...boite.children].forEach((d, i) => {
      const v = vals[i];
      const u = j === enJeu && (reste.get(v) || 0) > 0;
      if (u) { reste.set(v, reste.get(v) - 1); joue++; }
      d.classList.toggle('joue', u);
    });
    const qui = t(j === 'b' ? 'tesDes' : ami ? 'desAmi' : 'desRobot');
    boite.setAttribute('aria-label', vals.length
      ? `${t('desAria', { qui, des: nommerDes(vals) })}${joue ? tn('desJoues', joue) : ''}`
      : t('desAriaVide', { qui }));
  }
}
let jouesRobot = [];

function desDeLaPartie() {
  if (partie.phase !== 'deplacer') return { b: [], n: [] };
  return partie.trait === 'b' ? { b: partie.des.slice(), n: [] } : { b: [], n: partie.des.slice() };
}

// ---------------------------------------------------------------- gestes
function choisirPas(depuis, vers) {
  const c = possibles().filter((p) => p.depuis === depuis && p.vers === vers);
  if (c.length <= 1) return c[0] || null;
  // Deux dés mènent à la même arrivée (une sortie) : le dé exact d'abord,
  // sinon le plus petit qui suffit.
  const exact = c.find((p) => vers === 'sortie' && p.de === depuis);
  return exact || c.reduce((a, b) => (b.de < a.de ? b : a));
}

function jouerPas(pas) {
  joues.push(pas);
  selection = null;
  const ms = reduit() ? 0 : PAS_HUMAIN_MS;
  finAnim = Math.max(finAnim, performance.now() + ms);
  rendu(ms ? { pas, joueur: 'b', ms } : null);
  if (tourComplet(partie.position, 'b', partie.des, joues) && possibles().length === 0) {
    annoncer(t('tourComplet'));
  } else {
    annoncer('');
  }
}

function annulerPas() {
  if (!attente || !attente.types.includes('valider') || joues.length === 0) return;
  if (occupe()) { apresAnim(annulerPas); return; }
  joues.pop();
  selection = null;
  rendu();
  annoncer(t('pasAnnule'), 2500);
}

function toucherCible(c) {
  if (!humainActif || c === null || c === undefined) return;
  if (occupe()) { apresAnim(() => toucherCible(c)); return; }
  // Seul un second toucher sur la même cible est ignoré : il défairait le choix
  // d'une dame. « Dame puis arrivée », même rapide, passe.
  const t = performance.now();
  if (c === derniereCible && t - derniereTape < GARDE_MS) return;
  derniereTape = t;
  derniereCible = c;
  if (selection !== null) {
    const pas = choisirPas(selection, c);
    if (pas) { jouerPas(pas); return; }
  }
  const origines = possibles().map((p) => p.depuis);
  if (origines.includes(c)) selection = selection === c ? null : c;
  else selection = null;
  rendu();
}

const cibleDe = (s) => (s === 'barre' || s === 'sortie' ? s : /^\d+$/.test(s) ? Number(s) : null);

function surPointerDown(e) {
  if (geste && geste.id === e.pointerId) return;
  if (geste) surPointerCancel({ pointerId: geste.id });   // geste resté en plan
  if (!humainActif) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const c = plateau.pointSous(e.clientX, e.clientY);
  geste = { id: e.pointerId, x0: e.clientX, y0: e.clientY, c, glisse: false };
  try { $('plateau').setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
}
function surPointerMove(e) {
  if (!geste || e.pointerId !== geste.id) return;
  if (!geste.glisse) {
    if (Math.hypot(e.clientX - geste.x0, e.clientY - geste.y0) < SEUIL_GLISSER) return;
    if (!humainActif || occupe() || !possibles().some((p) => p.depuis === geste.c)) return;
    geste.glisse = true;
    selection = geste.c;
    const taille = plateau.pixels(2 * GEO.R);
    fantome = document.createElement('span');
    fantome.className = ami && ami.moi === 'n' ? 'fantome noire' : 'fantome';
    fantome.style.width = fantome.style.height = `${taille}px`;
    document.body.appendChild(fantome);
    rendu();
  }
  fantome.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
}
function finirGeste() {
  if (fantome) { fantome.remove(); fantome = null; }
}
function surPointerUp(e) {
  if (!geste || e.pointerId !== geste.id) return;
  const g = geste;
  geste = null;
  dernierPointeur = performance.now();
  finirGeste();
  if (!g.glisse) {
    toucherCible(g.c);
    return;
  }
  const v = plateau.pointSous(e.clientX, e.clientY);
  const pas = humainActif && !occupe() ? choisirPas(g.c, v) : null;
  if (pas) {
    derniereTape = performance.now();
    derniereCible = v;
    jouerPas(pas);
    return;
  }
  if (v !== g.c) selection = null;   // lâchée ailleurs : la dame revient
  rendu();
}
function surPointerCancel(e) {
  if (!geste || e.pointerId !== geste.id) return;
  const g = geste;
  geste = null;
  finirGeste();
  if (g.glisse) { selection = null; rendu(); }
}

function surTouche(e) {
  if (!partie || !$('ecran-menu').hidden || ecranOuvert()) return;
  // Une saisie (« Ton prénom ») garde ses touches : pas de raccourci de jeu.
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.altKey || e.metaKey) return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey) {
    if (k === 'z') { e.preventDefault(); annulerPas(); }
    return;
  }
  const bouton = { l: 'btn-lancer', v: 'btn-valider', d: 'btn-doubler' }[k];
  if (bouton) {
    const b = $(bouton);
    if (!b.hidden && !b.disabled) { e.preventDefault(); b.click(); }
    return;
  }
  if (k === 'u') { e.preventDefault(); annulerPas(); }
  if (e.key === 'Escape' && selection !== null) { selection = null; rendu(); }
}

// ------------------------------------------------------------------ robot
// Un seul worker, créé à la première demande. Erreur ou silence de plus de
// 3 s : il est abandonné, ce tour-là est calculé sur le fil principal avec un
// budget court, et un worker neuf est créé au tour suivant.
let travailleur = null;
let travailleurEssaye = false;
const enAttente = [];

function abandonnerTravailleur() {
  if (travailleur) { try { travailleur.terminate(); } catch (_) { /* déjà mort */ } }
  travailleur = null;
  travailleurEssaye = false;
  for (const d of enAttente.splice(0)) { clearTimeout(d.minuterie); d.resoudre(null); }
}
function obtenirTravailleur() {
  if (travailleurEssaye) return travailleur;
  travailleurEssaye = true;
  let w;
  try {
    w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch (_) {
    travailleur = null;
    return null;
  }
  travailleur = w;
  const actif = () => travailleur === w;
  w.onmessage = (e) => {
    if (!actif()) return;
    const d = enAttente.shift();
    if (!d) return;
    clearTimeout(d.minuterie);
    const r = e.data;
    d.resoudre(r && Array.isArray(r.tour) ? r.tour : null);
  };
  w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); if (actif()) abandonnerTravailleur(); };
  w.onmessageerror = () => { if (actif()) abandonnerTravailleur(); };
  return w;
}
function demanderAuTravailleur(pos, des, niv) {
  const w = obtenirTravailleur();
  if (!w) return Promise.resolve(null);
  return new Promise((resoudre) => {
    const d = { resoudre, minuterie: setTimeout(abandonnerTravailleur, DELAI_TRAVAILLEUR_MS) };
    enAttente.push(d);
    try {
      w.postMessage({ pos, joueur: 'n', des, niveau: niv, budgetMs: BUDGET_MS.fort });
    } catch (_) {
      abandonnerTravailleur();
    }
  });
}
const memeTour = (a, b) => a.length === b.length && a.every((p, i) => b[i] && p.depuis === b[i].depuis && p.vers === b[i].vers && p.de === b[i].de);
async function tourDuRobot(pos, des, niv) {
  const tour = await demanderAuTravailleur(pos, des, niv);
  const legaux = toursLegaux(pos, 'n', des);
  if (tour) {
    const t = legaux.find((l) => memeTour(l, tour));
    if (t) return t;
  }
  return choisirTour(pos, 'n', des, niv, { budgetMs: BUDGET_MS.repli });
}

const nomLieu = (v) => (v === 'barre' ? t('barre') : v === 'sortie' ? t('sortie') : String(v));
// « 13 vers 7, 7 vers 5 et frappe une dame » : `pos` est la position avant le tour du robot.
function texteTour(pos, tour) {
  let frappes = 0;
  for (const p of tour) {
    if (p.vers !== 'sortie' && pos.points[p.vers - 1] === 1) frappes++;
    pos = appliquerPas(pos, 'n', p);
  }
  const texte = tour.map((p) => t('pas', { de: nomLieu(p.depuis), vers: nomLieu(p.vers) })).join(t('sep'));
  return frappes === 0 ? texte : tn('frappe', frappes, { t: texte });
}

// ------------------------------------------------------------------ manche
// Le mode ami n'écrit jamais la partie sauvegardée du robot : il reprend par la salle.
function sauver() {
  if (ami) return;
  if (partie.phase === 'fin-match') { effacer(CLE_PARTIE); return; }
  ecrire(CLE_PARTIE, ecrirePartie({ niveau, partie }));
}

async function phaseOuverture(moi) {
  poserDes([], [], false);
  annoncer(t('ouvertureRobot'));
  for (;;) {
    rendu();
    await attendre(['lancer'], true);
    if (moi !== jeton) return;
    rendu();
    const db = tirerDe(), dn = tirerDe();
    // Écrit avant l'animation : recharger pendant le roulement rend les mêmes dés.
    const q = ouverture(partie, db, dn);
    const egalite = q === partie;
    if (!egalite) { partie = q; sauver(); }
    poserDes([db], [dn], true);
    annoncer('');
    await pause(reduit() ? 0 : ROULE_MS);
    if (moi !== jeton) return;
    if (egalite) {
      annoncer(t('egalite', { d: db }));
      continue;
    }
    annoncer(partie.trait === 'b'
      ? t('tuCommences', { a: db, b: dn })
      : t('robotCommence', { a: dn, b: db }));
    await pause(reduit() ? 300 : 600);
    if (moi !== jeton) return;
    // Les deux dés passent du côté de celui qui commence.
    const d = desDeLaPartie();
    poserDes(d.b, d.n, false);
    return;
  }
}

async function phaseLancerHumain(moi) {
  poserDes([], [], false);
  const peut = peutDoubler(partie);
  annoncer(peut ? t('aToiDouble') : t('aToi'));
  rendu();
  const r = await attendre(peut ? ['lancer', 'doubler'] : ['lancer'], true);
  if (moi !== jeton) return;
  if (r === 'doubler') { partie = doubler(partie); return; }
  partie = lancer(partie, tirerDe(), tirerDe());
  sauver();                               // juste après le lancer : les mêmes dés reviendront
  poserDes(partie.des.slice(), [], true);
  rendu();
  annoncer('');
  await pause(reduit() ? 0 : ROULE_MS);
}

async function phaseDeplacerHumain(moi) {
  joues = [];
  selection = null;
  const d = desDeLaPartie();
  if (!desAffiches || desAffiches.b.join() !== d.b.join()) poserDes(d.b, d.n, false);
  const rien = toursLegaux(partie.position, 'b', partie.des)[0].length === 0;
  humainActif = !rien;
  let promesse = attendre(['valider']);
  rendu();
  annoncer(rien ? t('aucunCoup') : t('tesDesChoisis', { des: nommerDes(partie.des) }));
  if (rien) $('btn-valider').focus();   // « Valider » passe la main
  else rendreFocus();
  for (;;) {
    await promesse;
    if (moi !== jeton) return;
    if (tourComplet(partie.position, 'b', partie.des, joues)) break;
    promesse = attendre(['valider']);
    rendu();
  }
  humainActif = false;
  selection = null;
  const tour = joues.slice();
  joues = [];
  partie = jouerTour(partie, tour);
  rendu();
  rendreFocus();                          // « Valider » vient de se cacher
}

async function phaseLancerRobot(moi) {
  poserDes([], [], false);
  rendu();
  annoncer(t('auRobot'));
  await pause(delaiRobot());
  if (moi !== jeton) return;
  if (veutDoubler(partie, niveau)) { partie = doubler(partie); return; }
  partie = lancer(partie, tirerDe(), tirerDe());
  sauver();
  poserDes([], partie.des.slice(), true);
  rendu();
  await pause(reduit() ? 0 : ROULE_MS);
}

async function phaseDeplacerRobot(moi, delai) {
  const d = desDeLaPartie();
  if (!desAffiches || desAffiches.n.join() !== d.n.join()) poserDes(d.b, d.n, false);
  jouesRobot = [];
  rendu();
  annoncer(t('robotReflechit'));
  const debut = performance.now();
  const tour = await tourDuRobot(partie.position, partie.des, niveau);
  if (moi !== jeton) return;
  if (delai) await pause(Math.max(0, delaiRobot() - (performance.now() - debut)));
  if (moi !== jeton) return;
  if (tour.length === 0) {
    annoncer(t('robotNePeut'));
    retenir(t('robotNePouvait'));
    await pause(900);
  } else {
    for (let k = 0; k < tour.length; k++) {
      jouesRobot = tour.slice(0, k + 1);
      const ms = reduit() ? 0 : PAS_ROBOT_MS;
      finAnim = performance.now() + PAS_ROBOT_MS;
      plateau.dessiner(partie, { joues: jouesRobot, mouvement: ms ? { pas: tour[k], joueur: 'n', ms } : null });
      renduDes();
      await pause(PAS_ROBOT_MS);
      if (moi !== jeton) return;
    }
    retenir(t('robotAJoue', { t: texteTour(partie.position, tour) }));
  }
  jouesRobot = [];
  partie = jouerTour(partie, tour);
}

async function phaseDouble(moi) {
  const v = partie.cube.valeur * 2;
  if (partie.trait === 'b') {
    rendu();
    annoncer(t('tuDoubles', { v }));
    await pause(delaiRobot());
    if (moi !== jeton) return;
    if (accepteDouble(partie, niveau)) {
      partie = accepter(partie);
      retenir(t('robotAccepte', { v }));
    } else {
      partie = refuser(partie);            // l'écran de fin le dit
    }
    return;
  }
  rendu();
  $('double-texte').textContent = t('robotDouble', { v });
  annoncer(t('robotDouble', { v }));
  montrer('double');
  const r = await attendre(['accepter', 'refuser']);
  if (moi !== jeton) return;
  montrer(null);
  rendreFocus();
  if (r === 'accepter') {
    partie = accepter(partie);
    retenir(t('tuAcceptes', { v }));
  } else {
    partie = refuser(partie);
  }
}

function texteFin(p) {
  const r = p.resultat;
  const toi = r.gagnant === 'b';
  const lui = nomAdversaire();
  const pts = tn('points', r.points);
  let manche;
  if (r.abandon) manche = t(toi ? 'finAbandonLui' : 'finAbandonToi', { lui, pts });
  else if (r.refus) manche = t(toi ? 'finRefusLui' : 'finRefusToi', { lui, pts });
  else {
    const titre = r.type === 3 ? t('finBackgammon') : r.type === 2 ? t('finGammon') : '';
    manche = t(toi ? 'tuGagnes' : 'luiGagne', { titre, lui, pts });
  }
  if (p.phase === 'fin-match') {
    const [a, b] = toi ? [p.score.b, p.score.n] : [p.score.n, p.score.b];
    return { manche, match: t(toi ? 'tuGagnesMatch' : 'luiGagneMatch', { lui, a, b }) };
  }
  return { manche, match: texteScore(p) };
}
// Une phrase terminée : le point final de la langue est ajouté s'il manque.
function finiPar(texte) {
  return /[.!?。！？۔։।]$/.test(texte) ? texte : texte + t('pointFinal');
}

async function phaseFin(moi) {
  poserDes([], [], false);
  rendu();
  const tf = texteFin(partie);
  const finMatch = partie.phase === 'fin-match';
  $('fin-texte').textContent = tf.manche;
  $('fin-score').textContent = tf.match;
  $('btn-suivante').hidden = finMatch;
  $('btn-nouveau').hidden = !finMatch;
  annoncer(`${tf.manche} ${finMatch ? tf.match : ''}`.trim());
  // Le bandeau de fin paraît une fois la dernière dame posée.
  await pause(reduit() ? 200 : 500);
  if (moi !== jeton) return;
  montrer('fin');
  const r = await attendre(['suivante', 'nouveau']);
  if (moi !== jeton) return;
  montrer(null);
  if (r === 'suivante') partie = mancheSuivante(partie);
  else partie = nouveauMatch({ longueur: partie.longueur, videau: partie.videauActif });
  rendu();
  rendreFocus();
}

async function jouerPartie(niv, reprise) {
  const moi = ++jeton;
  niveau = niv;
  partie = reprise;
  joues = [];
  jouesRobot = [];
  selection = null;
  humainActif = false;
  attente = null;
  desAffiches = null;
  viderSuspens();
  montrer(null);
  let precedente = null;
  let statMatch = 0;                        // un nouveau match recommence à la manche 1
  try {
    for (;;) {
      if (moi !== jeton) return;
      sauver();                             // chaque changement de phase est écrit
      const ph = partie.phase;
      if (precedente === 'fin-match') statMatch++;
      noterStat('robot', `${moi}:${statMatch}:${partie.manche}`, partie, niveau);
      const robot = partie.trait === 'n';
      if (ph === 'ouverture') await phaseOuverture(moi);
      else if (ph === 'lancer') await (robot ? phaseLancerRobot(moi) : phaseLancerHumain(moi));
      else if (ph === 'deplacer') {
        // Le robot vient de lancer : il a déjà attendu. Sinon (ouverture, reprise),
        // le délai visible s'applique avant son premier pas.
        await (robot ? phaseDeplacerRobot(moi, precedente !== 'lancer') : phaseDeplacerHumain(moi));
      } else if (ph === 'double') await phaseDouble(moi);
      else await phaseFin(moi);
      precedente = ph;
    }
  } catch (e) {
    // Une erreur imprévue ne laisse pas un plateau figé : retour au menu.
    if (moi !== jeton) return;
    console.error(e);
    quitter();
  }
}

function quitter() {
  statAbandon();
  if (salleOuverte || amiEnCours) {
    // Quitter la salle : ses abonnements coupés, la clé des dés effacée, puis
    // un démarrage propre sans paramètre (la sauvegarde robot reste intacte).
    if (salleOuverte) salleOuverte.fermer();
    if (codeAmi) effacer(CLE_AMI + codeAmi);
    location.href = location.pathname;
    return;
  }
  jeton++;
  viderSuspens();
  attente = null;
  humainActif = false;
  geste = null;
  finirGeste();
  partie = null;
  effacer(CLE_PARTIE);
  aDire = '';
  annoncer('');
  montrer('menu');
}

// ------------------------------------------------------------------- menu
function majMenu() {
  const n = lireNiveau(), l = String(lireLongueur());
  majMode();
  for (const r of document.querySelectorAll('input[name="niveau"]')) r.checked = r.value === n;
  for (const r of document.querySelectorAll('input[name="longueur"]')) r.checked = r.value === l;
  $('videau').checked = lireVideau();
  majNote();
}
// Le niveau ne vaut que contre le robot ; longueur et videau valent pour les deux.
const modeChoisi = () => (document.querySelector('input[name="mode"]:checked')?.value === 'ami' ? 'ami' : 'robot');
function majMode() {
  $('choix-niveau').hidden = modeChoisi() === 'ami';
}
function majNote() {
  const un = document.querySelector('input[name="longueur"]:checked')?.value === '1';
  $('videau-note').classList.toggle('active', un);
}

// -------------------------------------------------------------------- ami
// Salle v2 : chaque joueur n'écrit que son journal d'actions, daté par le
// serveur ; remote.replier rejoue les deux journaux fusionnés, dés compris,
// et ignore toute action illégale à sa place ou venue du mauvais siège. Tout
// ce qui vient de la salle (actions, prénom) est une donnée non fiable et
// passe par remote.js ou textContent. Seule exception : le SVG du QR code,
// fabriqué par le portail à partir d'une URL que nous construisons.
//
// L'interface garde son hypothèse « le joueur local est Blanc » : l'invité
// (Noir) voit la partie passée par miroirPartie, et ses tours repassent par
// miroirTour avant l'écriture. Ses dames restent d'ébène (plateau.inverser).
//
// Dés (protocole v2) : le lanceur publie une contribution `c` ; l'autre
// révèle (`'V'`, automatique) le secret qu'il avait engagé avant. La clé des
// secrets vit dans localStorage (backgammon.ami.<code>), rangée AVANT
// l'écriture qui publie un engage.

const OUVERTURE_AMI = t('ouvertureAmi');
const NON_ENVOYE = t('nonEnvoye');
const REESSAI_AUTO_MS = 2000;     // une écriture automatique refusée est retentée
const CLE_PERDUE = t('clePerdue');
let salleOuverte = null;
let amiEnCours = false;           // mode ami lancé, salle peut-être pas encore ouverte
let codeAmi = null;               // code de la salle ouverte : sa clé est effacée au départ

// La partie d'un Jeu, vue de mon côté.
const vueDe = (A, jeu) => (A.moi === 'b' ? jeu.partie : miroirPartie(jeu.partie));

// Les dés dont la valeur attend la révélation de l'ami.
function poserDesEnAttente(nb, nn) {
  desAffiches = { b: [], n: [] };
  $('des-b').replaceChildren(...Array.from({ length: nb }, creerCubeEnAttente));
  $('des-n').replaceChildren(...Array.from({ length: nn }, creerCubeEnAttente));
  renduDes();
}

// Un ami qui ne joue plus (README « Un ami qui ne joue plus ») : 3 min après
// sa dernière action, à l'heure du serveur, « Réclamer la victoire » paraît.
function majReclamation(A) {
  if (ami !== A) {
    clearInterval(A.veille);
    if (!ami) $('reclamation').hidden = true;
    return;
  }
  $('reclamation').hidden = !(!A.bloque && A.jeu && A.montreJeu === A.jeu
    && peutReclamer(A.jeu, A.moi, A.salle.heureServeur()));
}

function reclamer() {
  const A = ami;
  if (!A || A.bloque || !A.jeu || !peutReclamer(A.jeu, A.moi, A.salle.heureServeur())) return;
  $('reclamation').hidden = true;
  envoyer(A, { a: 'F' });
}

function bandeauAmi() {
  const A = ami;
  if (!A || A.bloque) return;
  if (!A.jeu) annoncer(t('lecture'));
  else if (A.assis && !A.amiEnLigne) annoncer(t('amiDeconnecte'));
  else if (A.alerte) annoncer(A.alerte);
  else annoncer(A.texte);
}

function rangerCle(A) {
  ecrire(CLE_AMI + A.code, ecrireCle(A.cle));
}

// Le secret neuf de l'engage que publie l'action à cette place (match, rang) :
// le même si l'écriture est refusée puis refaite. Retenu et rangé AVANT
// l'écriture qui publie son engage.
function engageNeuf(A) {
  const ici = `${A.jeu.match}:${A.jeu.nb}`;
  if (!A.vPour || A.vPour.ici !== ici) {
    const s = nouveauSecret();
    A.cle = retenirSecret(A.cle, s);
    rangerCle(A);
    A.vPour = { ici, s };
  }
  return engagement(A.vPour.s);
}

function planifier(A) {
  A.file = A.file.then(() => synchroniser(A)).catch((e) => { console.error(e); });
}

// Une action à la fois : elle paraît tout de suite (surJournal rend mon
// entrée avant la réponse du serveur) ; refusée, elle disparaît d'elle-même.
function envoyerTexte(A, texte, auto = false) {
  if (ami !== A || !A.jeu || A.bloque || A.envoi) return;
  A.envoi = true;
  A.alerte = '';
  A.salle.ajouter(texte).then(() => {
    A.envoi = false;
    if (ami === A) planifier(A);
  }, () => {
    A.envoi = false;
    if (ami !== A) return;
    A.alerte = NON_ENVOYE;
    if (auto) A.echecAuto = performance.now();
    joues = [];
    selection = null;
    planifier(A);
  });
}

function envoyer(A, action, auto = false) {
  let texte;
  try {
    texte = encoderAction(action);
  } catch (e) {
    console.error(e);
    return;
  }
  envoyerTexte(A, texte, auto);
}

// Une écriture automatique ('I', 'O', 'V') ; refusée, elle est retentée un
// peu plus tard.
function auto(A, f) {
  const reste = A.echecAuto + REESSAI_AUTO_MS - performance.now();
  if (reste > 0) {
    clearTimeout(A.minuteur);
    A.minuteur = setTimeout(() => { if (ami === A) planifier(A); }, reste);
    return;
  }
  f();
}

function bloquer(A, message) {
  A.bloque = true;
  attente = null;
  humainActif = false;
  erreur(message);
}

// Je révèle le secret engagé pour le lancer demandé par l'ami.
function reveler(A) {
  const s = secretPour(A.cle, A.jeu.registre.engage[A.moi]);
  if (!s) { bloquer(A, CLE_PERDUE); return; }
  envoyer(A, { a: 'V', s, e: engageNeuf(A) }, true);
}

// Les dés de l'ouverture : un pour chacun, puis le plus fort commence.
async function animerOuverture(A, P1) {
  const [db, dn] = P1.des;                    // [dé de Blanc, dé de Noir]
  const monDe = A.moi === 'b' ? db : dn, sonDe = A.moi === 'b' ? dn : db;
  poserDes([monDe], [sonDe], true);
  rendu();
  annoncer('');
  await pause(reduit() ? 0 : ROULE_MS);
  if (ami !== A) return;
  const dit = P1.trait === 'b' ? t('tuCommences', { a: monDe, b: sonDe }) : t('amiCommence', { a: sonDe, b: monDe });
  annoncer(dit);
  if (P1.trait !== 'b') A.dit = dit;
  await pause(reduit() ? 300 : 600);
  if (ami !== A) return;
  const d = desDeLaPartie();
  poserDes(d.b, d.n, false);
}

// Anime une action acceptée, du Jeu `de` au Jeu `vers`.
async function animerAction(A, de, vers, act, acteur) {
  const P0 = vueDe(A, de), P1 = vueDe(A, vers);
  const mien = acteur === A.moi;
  if (act.a === 'V') {
    if (ami !== A) return;
    partie = P1;
    const { ouverture: ouv, lanceur } = de.attente;
    if (ouv) {
      // Ouverture à égalité : les dés sont rejetés, rien à montrer.
      if (P1.phase === 'ouverture') return;
      await animerOuverture(A, P1);
      return;
    }
    poserDes(lanceur === A.moi ? P1.des.slice() : [], lanceur === A.moi ? [] : P1.des.slice(), true);
    rendu();
    annoncer('');
    await pause(reduit() ? 0 : ROULE_MS);
    return;
  }
  if (act.a === 'J' && !mien) {
    // Le tour de l'ami, pas à pas, comme celui du robot.
    const tour = A.moi === 'b' ? act.t : miroirTour(act.t);
    partie = P0;
    const d = desDeLaPartie();
    if (!desAffiches || desAffiches.n.join() !== d.n.join()) poserDes(d.b, d.n, false);
    jouesRobot = [];
    rendu();
    if (tour.length === 0) {
      annoncer(t('amiNePeut'));
      A.dit = t('amiNePeut');
      await pause(900);
    } else {
      for (let k = 0; k < tour.length; k++) {
        jouesRobot = tour.slice(0, k + 1);
        const ms = reduit() ? 0 : PAS_ROBOT_MS;
        finAnim = performance.now() + PAS_ROBOT_MS;
        plateau.dessiner(partie, { joues: jouesRobot, mouvement: ms ? { pas: tour[k], joueur: 'n', ms } : null });
        renduDes();
        await pause(PAS_ROBOT_MS);
        if (ami !== A) return;
      }
      A.dit = t('amiAJoue', { t: texteTour(P0.position, tour) });
    }
    jouesRobot = [];
  } else if (act.a === 'A') {
    const v = P1.cube.valeur;
    A.dit = mien ? t('tuAcceptes', { v }) : t('amiAccepte', { v });
  }
  partie = P1;
}

// Met l'écran à jour sur le dernier pli : les actions nouvelles du match
// affiché sont animées une à une ; sinon (premier pli, nouveau match, une de
// mes actions refusée) tout est redessiné. Les appels passent un par un.
async function synchroniser(A) {
  if (ami !== A || A.bloque || !A.jeu) return;
  const cible = A.jeu, pas = A.pas;
  attente = null;
  humainActif = false;
  selection = null;
  let anime = false;
  // L'écran montre `montreJeu` : est-ce un Jeu de ce pli, d'où l'on peut animer la suite ?
  const k = pas.findIndex((p) => p.avant === A.montreJeu);
  if (A.montreJeu && A.montreJeu !== cible && k >= 0) {
    for (let i = k; i < pas.length; i++) {
      await animerAction(A, pas[i].avant, pas[i].apres, pas[i].act, pas[i].acteur);
      if (ami !== A) return;
      anime = true;
      A.montreJeu = pas[i].apres;
      if (A.jeu !== cible) return;           // un autre pli est arrivé : il passera ensuite
    }
    partie = vueDe(A, cible);
  } else {
    A.montreJeu = cible;
    partie = vueDe(A, cible);
    jouesRobot = [];
    desAffiches = null;
  }
  if (anime && (partie.phase === 'fin-manche' || partie.phase === 'fin-match')) {
    // Le bandeau de fin paraît une fois la dernière dame posée.
    await pause(reduit() ? 200 : 500);
    if (ami !== A || A.jeu !== cible) return;
  }
  preparer(A);
}

// Ce qu'attend le Jeu courant : mes boutons, l'écriture automatique due, ou
// l'attente de l'ami.
function preparer(A) {
  const n = ++A.etape;
  const vivant = () => ami === A && A.etape === n && !A.bloque;
  const j = A.jeu, p = partie;
  attente = null;
  humainActif = false;
  selection = null;
  joues = [];
  const dit = A.dit;
  A.dit = '';
  const dire = (t) => { A.texte = [dit, t].filter(Boolean).join(' '); };
  // Le focus reste dans « Ton prénom » si on y écrit.
  const focus = document.activeElement !== $('pseudo');
  let dialogue = null;
  // La manche commence une fois l'invité engagé (match 1) ; reprise : un nouveau début.
  if (j.registre.engage.n !== null) noterStat('ami', `${A.code}:${j.match}:${p.manche}`, p);
  if (j.attente) {
    const { ouverture: ouv, lanceur } = j.attente;
    if (ouv) poserDesEnAttente(1, 1);
    else poserDesEnAttente(lanceur === A.moi ? 2 : 0, lanceur === A.moi ? 0 : 2);
    if (acteurAttendu(j) === A.moi) {
      dire(ouv ? OUVERTURE_AMI : t('amiLance'));
      auto(A, () => reveler(A));
    } else {
      dire(ouv ? OUVERTURE_AMI : t('desRoulent'));
    }
  } else if (j.registre.engage.n === null) {
    // Match 1 : l'invité s'engage et demande l'ouverture en arrivant.
    poserDes([], [], false);
    dire(OUVERTURE_AMI);
    if (A.moi === 'n') auto(A, () => envoyer(A, { a: 'I', e: engageNeuf(A), c: nouveauSecret() }, true));
  } else if (p.phase === 'ouverture') {
    poserDes([], [], false);
    dire(OUVERTURE_AMI);
    if (A.moi === 'n') auto(A, () => envoyer(A, { a: 'O', c: nouveauSecret() }, true));
  } else if (p.phase === 'lancer') {
    poserDes([], [], false);
    if (p.trait === 'b') {
      const peut = peutDoubler(p);
      dire(peut ? t('aToiDouble') : t('aToi'));
      attendre(peut ? ['lancer', 'doubler'] : ['lancer'], focus).then((r) => {
        if (!vivant()) return;
        envoyer(A, r === 'doubler' ? { a: 'D' } : { a: 'L', c: nouveauSecret() });
      });
    } else {
      dire(t('amiLance'));
    }
  } else if (p.phase === 'deplacer') {
    const d = desDeLaPartie();
    if (!desAffiches || desAffiches.b.join() !== d.b.join() || desAffiches.n.join() !== d.n.join()) poserDes(d.b, d.n, false);
    if (p.trait === 'b') {
      const rien = toursLegaux(p.position, 'b', p.des)[0].length === 0;
      humainActif = !rien;
      dire(rien ? t('aucunCoup') : t('tesDesChoisis', { des: nommerDes(p.des) }));
      const valider = () => attendre(['valider']).then(() => {
        if (!vivant()) return;
        if (!tourComplet(partie.position, 'b', partie.des, joues)) { valider(); rendu(); return; }
        humainActif = false;
        selection = null;
        const tour = joues.slice();
        joues = [];
        envoyer(A, { a: 'J', t: A.moi === 'b' ? tour : miroirTour(tour) });
      });
      valider();
      if (rien && focus) $('btn-valider').focus();
    } else {
      dire(t('amiReflechit'));
    }
  } else if (p.phase === 'double') {
    poserDes([], [], false);
    const v = p.cube.valeur * 2;
    if (p.trait === 'b') {
      dire(t('amiReflechitDouble'));
    } else {
      dire(t('amiDouble', { v }));
      $('double-texte').textContent = t('amiDouble', { v });
      dialogue = 'double';
      attendre(['accepter', 'refuser']).then((r) => {
        if (!vivant()) return;
        montrer(null);
        envoyer(A, { a: r === 'accepter' ? 'A' : 'R' });
      });
    }
  } else {
    // Fin de manche ou de match : l'un ou l'autre lance la suite ; si les
    // deux la lancent, la seconde action est ignorée.
    poserDes([], [], false);
    const tf = texteFin(p);
    const finMatch = p.phase === 'fin-match';
    $('fin-texte').textContent = tf.manche;
    $('fin-score').textContent = tf.match;
    const fini = abandonne(p);                // une réclamation met fin à la salle
    $('btn-suivante').hidden = finMatch || fini;
    $('btn-nouveau').hidden = !finMatch || fini;
    if (fini) $('fin-score').textContent = `${finiPar(tf.match)} ${t('rejouer')}`;
    dire(`${tf.manche} ${finMatch ? tf.match : ''}`.trim());
    dialogue = 'fin';
    attendre(['suivante', 'nouveau']).then((r) => {
      if (!vivant()) return;
      montrer(null);
      if (r === 'suivante') envoyer(A, { a: 'S' });
      else envoyerTexte(A, actionMatch(j.match + 1));
    });
  }
  if (!vivant()) return;                    // clé perdue : l'erreur est à l'écran
  rendu();
  bandeauAmi();
  majReclamation(A);
  const pleinEcran = !$('ecran-invite').hidden || !$('ecran-attente').hidden;
  if (dialogue) {
    if ($('ecran-' + dialogue).hidden && !pleinEcran) montrer(dialogue);
  } else if (!$('ecran-double').hidden || !$('ecran-fin').hidden) {
    montrer(null);
  }
  rendreFocus();
}

async function partieAmi(code, options) {
  const moi = ++jeton;
  viderSuspens();
  partie = null;
  attente = null;
  humainActif = false;
  selection = null;
  joues = [];
  jouesRobot = [];
  desAffiches = null;
  montrer('attente');
  $('attente-statut').textContent = code ? t('connexion', { code }) : t('ouvertureSalle');

  let Net;
  try {
    Net = await import('/play/net/salle2.js');
  } catch (_) {
    // Sur le portail, c'est le réseau ou un bloqueur ; ailleurs, la couche de
    // salles n'existe pas.
    throw new Error(location.pathname.startsWith('/play/')
      ? t('injoignable')
      : t('horsPortail'));
  }
  if (moi !== jeton) return;
  // L'hôte engage son premier secret avant de créer la salle : rangé d'abord
  // sous une clé provisoire, puis sous le code.
  let cle = { secrets: {} };
  let salle;
  if (code) {
    salle = await Net.rejoindreSalle('backgammon', code);
  } else {
    const s = nouveauSecret();
    cle = retenirSecret(lireCle(lire(CLE_AMI_NEUVE)), s);
    ecrire(CLE_AMI_NEUVE, ecrireCle(cle));
    salle = await Net.creerSalle('backgammon', { partage: partageInitial(options, engagement(s)) });
  }
  if (moi !== jeton) { salle.fermer(); return; }
  salleOuverte = salle;
  codeAmi = salle.code;
  const siege = salle.siege;
  if (siege !== 1 && siege !== 2) throw new Error(t('siegeInconnu'));
  if (!lirePartage(salle.partage)) throw new Error(t('salleIllisible'));
  if (!code) stat('salle_creee'); else if (siege === 2) stat('salle_rejointe');

  // La clé provisoire restée en plan (l'hôte qui a rafraîchi juste après la
  // création) d'abord, puis celle de la salle, puis le secret que je viens
  // d'engager : les secrets vivants sont les plus récents et ne sortent pas
  // de la fenêtre des quatre derniers. Un secret ne sert qu'à son engage.
  let stock = lireCle(lire(CLE_AMI_NEUVE));
  for (const s of Object.values(lireCle(lire(CLE_AMI + salle.code)).secrets)) stock = retenirSecret(stock, s);
  for (const s of Object.values(cle.secrets)) stock = retenirSecret(stock, s);

  const A = {
    moi: siege === 1 ? 'b' : 'n', salle, code: salle.code, cle: stock, partage: salle.partage,
    jeu: null, pas: [],               // dernier pli des journaux : le Jeu courant et les actions du match
    montreJeu: null,                  // Jeu affiché (les animations le rattrapent)
    file: Promise.resolve(), etape: 0,
    assis: false, amiEnLigne: false, nomAmi: '',
    texte: '', dit: '', alerte: '', bloque: false, veille: null,
    envoi: false, echecAuto: -Infinity, minuteur: null, vPour: null,
  };
  ami = A;
  A.veille = setInterval(() => majReclamation(A), 1000);
  rangerCle(A);
  effacer(CLE_AMI_NEUVE);
  $('plateau').classList.toggle('vue-noire', A.moi === 'n');
  plateau.inverser(A.moi === 'n');

  const champ = $('pseudo');
  champ.value = lirePseudo();
  $('ligne-pseudo').hidden = false;
  function publierPseudo() {
    const p = champ.value.trim().slice(0, 20);
    ecrire(CLE_PSEUDO, p);
    salle.poserPseudo(p).catch(() => { /* le prénom n'est pas vital */ });
  }
  champ.onchange = publierPseudo;
  if (champ.value) publierPseudo();
  bandeauAmi();

  let qrFait = false;
  async function inviter() {
    // Appelée à chaque mise à jour de présence : ne pas reprendre le focus.
    if ($('ecran-invite').hidden) montrer('invite');
    $('lien').value = salle.url;
    if (qrFait) return;
    qrFait = true;
    try {
      const svg = await Net.genererQR(salle.url);
      if (moi !== jeton) return;
      $('qr').innerHTML = svg;
    } catch (_) {
      qrFait = false;
      $('qr').textContent = t('qrIndispo');
    }
  }

  salle.surJoueurs(({ ami: autre }) => {
    if (moi !== jeton || ami !== A) return;
    A.assis = !!autre;
    A.amiEnLigne = A.assis && autre.enLigne !== false;
    A.nomAmi = A.assis && typeof autre.pseudo === 'string' ? autre.pseudo.trim().slice(0, 20) : '';
    if (A.bloque) return;
    // Tant que l'ami n'est pas assis, l'invitation reste à l'écran — y
    // compris pour un hôte qui a rafraîchi sa page avant son arrivée.
    if (!A.assis) inviter();
    else if (!$('ecran-invite').hidden || !$('ecran-attente').hidden) {
      montrer(null);
      // Un dialogue (double, fin) attendait derrière l'écran plein.
      if (A.montreJeu) planifier(A);
    }
    if (partie) renduPanneau();
    bandeauAmi();
  });

  salle.surJournal((entrees) => {
    if (moi !== jeton || ami !== A || A.bloque) return;
    const r = replier(entrees, A.partage);
    if (!r.jeu) {
      bloquer(A, t('salleIllisible'));
      return;
    }
    A.jeu = r.jeu;
    A.pas = r.pas;
    planifier(A);
  });
}

function lancerAmi(code, options) {
  amiEnCours = true;
  const tentative = partieAmi(code, options);
  const moi = jeton;                 // posé par partieAmi, de façon synchrone
  tentative.catch((e) => {
    // Une tentative abandonnée qui échoue plus tard ne touche à rien.
    if (moi !== jeton) return;
    jeton++;
    ami = null;
    partie = null;
    attente = null;
    humainActif = false;
    if (salleOuverte) { salleOuverte.fermer(); salleOuverte = null; }
    effacer(CLE_AMI_NEUVE);            // la salle n'a pas été créée : le secret provisoire ne sert plus
    erreur(String((e && e.message) || e));
  });
}

// --------------------------------------------------------------- vignette
// ?vignette=1 : une toile 640×400 et window.__vignette() pour la capturer.
function vignette() {
  document.body.classList.add('vignette');
  const toile = document.createElement('canvas');
  toile.width = 640; toile.height = 400;
  document.body.appendChild(toile);
  const g = toile.getContext('2d');
  g.fillStyle = '#3B4654'; g.fillRect(0, 0, 640, 400);

  const s = 0.46, X = (640 - GEO.L * s) / 2, Y = 74;
  g.save();
  g.translate(X, Y); g.scale(s, s);
  g.shadowColor = 'rgba(10,12,20,0.5)'; g.shadowBlur = 30; g.shadowOffsetY = 12;
  g.fillStyle = BOIS.noyer; g.beginPath(); g.roundRect(0, 0, GEO.L, GEO.H, 16); g.fill();
  g.shadowColor = 'transparent';
  // Frise.
  for (let x = 6; x < GEO.L - 6; x += 14) {
    for (const y of [6, GEO.H - 16]) {
      g.fillStyle = BOIS.palissandre; g.fillRect(x, y, 14, 10);
      g.fillStyle = BOIS.erable; g.beginPath();
      g.moveTo(x, y + 5); g.lineTo(x + 7, y); g.lineTo(x + 14, y + 5); g.lineTo(x + 7, y + 10); g.fill();
    }
  }
  g.fillStyle = BOIS.poirier;
  g.fillRect(GEO.F, GEO.Y0, 6 * GEO.W, GEO.Y1 - GEO.Y0);
  g.fillRect(GEO.DX, GEO.Y0, 6 * GEO.W, GEO.Y1 - GEO.Y0);
  for (let p = 1; p <= 24; p++) {
    const { x, haut } = colonne(p);
    const base = haut ? GEO.Y0 : GEO.Y1, pointe = haut ? GEO.Y0 + GEO.POINTE : GEO.Y1 - GEO.POINTE;
    const demi = GEO.W / 2 - 3, sienne = p % 2 === 1;
    g.fillStyle = sienne ? BOIS.sienne : BOIS.erable;
    g.beginPath(); g.moveTo(x - demi, base); g.lineTo(x, base); g.lineTo(x, pointe); g.fill();
    g.fillStyle = sienne ? BOIS.sienneFonce : BOIS.erableFonce;
    g.beginPath(); g.moveTo(x, base); g.lineTo(x + demi, base); g.lineTo(x, pointe); g.fill();
    g.strokeStyle = BOIS.buis; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x - demi, base); g.lineTo(x, pointe); g.lineTo(x + demi, base); g.stroke();
  }
  g.fillStyle = BOIS.palissandre; g.fillRect(GEO.BX, GEO.Y0 - 5, GEO.BW, GEO.Y1 - GEO.Y0 + 10);
  g.fillStyle = BOIS.bac;
  g.fillRect(GEO.TX, GEO.Y0, GEO.TW, 318); g.fillRect(GEO.TX, GEO.MILIEU + 10, GEO.TW, 318);
  g.strokeStyle = BOIS.buis; g.lineWidth = 2;
  g.strokeRect(GEO.F, GEO.Y0, 6 * GEO.W, GEO.Y1 - GEO.Y0); g.strokeRect(GEO.DX, GEO.Y0, 6 * GEO.W, GEO.Y1 - GEO.Y0);

  // Une position de milieu de partie.
  const scene = { 24: 1, 13: 4, 8: 2, 6: 4, 5: 2, 4: 2, 1: -2, 12: -3, 17: -2, 19: -4, 20: -2, 22: -2 };
  const dame = (x, y, j) => {
    g.fillStyle = 'rgba(20,8,0,0.35)'; g.beginPath(); g.arc(x + 1.5, y + 3, GEO.R, 0, 7); g.fill();
    g.fillStyle = j === 'b' ? BOIS.ivoire : BOIS.ebene; g.beginPath(); g.arc(x, y, GEO.R - .5, 0, 7); g.fill();
    if (j === 'b') { g.strokeStyle = BOIS.ebene; g.lineWidth = GEO.R * .13; g.beginPath(); g.arc(x, y, GEO.R * .6, 0, 7); g.stroke(); }
    else { g.strokeStyle = 'rgba(255,240,220,0.18)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, GEO.R * .86, 0, 7); g.stroke(); }
  };
  for (const [p, v] of Object.entries(scene)) {
    for (let k = 0; k < Math.abs(v); k++) { const c = caseDame(Number(p), k); dame(c.x, c.y, v > 0 ? 'b' : 'n'); }
  }
  dame(GEO.BX + GEO.BW / 2, GEO.MILIEU - 52, 'n');
  for (let k = 0; k < 2; k++) {
    g.fillStyle = BOIS.ivoire; g.fillRect(GEO.TX + 8, GEO.Y1 - 22 - k * 20, 54, 16);
  }
  // Le videau à 2, chez Blanc.
  g.fillStyle = BOIS.ivoire; g.beginPath(); g.roundRect(GEO.BX + 6, GEO.Y1 - 52, 44, 44, 5); g.fill();
  g.fillStyle = BOIS.sienneFonce; g.font = '800 24px "Alegreya Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('2', GEO.BX + 28, GEO.Y1 - 29);
  // Deux dés, sur le champ de droite.
  const de = (x, y, v, a) => {
    g.save(); g.translate(x, y); g.rotate(a);
    g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 8; g.shadowOffsetY = 5;
    g.fillStyle = '#F7F1E3'; g.beginPath(); g.roundRect(-34, -34, 68, 68, 12); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = BOIS.sienneFonce;
    for (const q of POINTS_FACE[v]) {
      const cx = ((q - 1) % 3 - 1) * 20, cy = (Math.ceil(q / 3) - 2) * 20;
      g.beginPath(); g.arc(cx, cy, 6.5, 0, 7); g.fill();
    }
    g.restore();
  };
  de(640, 350, 5, -0.2); de(745, 340, 3, 0.15);
  g.restore();

  g.fillStyle = '#F1E7D0'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '400 46px Marcellus, Georgia, serif';
  const titre = {"fr": "Backgammon", "en": "Backgammon", "es": "Backgammon", "de": "Backgammon", "pt": "Gamão", "it": "Backgammon", "ru": "Нарды (короткие)", "zh": "西洋双陆棋", "ar": "الطاولة", "bn": "ব্যাকগ্যামন", "hy": "Նարդի", "ur": "بیک گیمن"};
  g.fillText(titre[(document.documentElement.lang || 'fr').split('-')[0]] || titre.fr, 320, 54, 600);
  window.__vignette = () => toile.toDataURL('image/png');
}

// ----------------------------------------------------------------- départ
async function demarrer() {
  const params = new URLSearchParams(location.search);
  if (params.get('vignette') === '1') {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([
          document.fonts.load('400 46px Marcellus'),
          document.fonts.load('800 24px "Alegreya Sans"'),
        ]).catch(() => {}),
        pause(1500),
      ]);
    }
    vignette();
    return;
  }

  traduirePage();
  plateau = creerPlateau($('plateau'));
  // Le menu se pose sur une position de départ.
  const depart = nouveauMatch({ longueur: 3, videau: true });
  plateau.dessiner(depart);
  renduPanneau(depart);
  $('double-texte').textContent = t('robotDouble', { v: 2 });

  for (const r of document.querySelectorAll('input[name="niveau"]')) {
    r.addEventListener('change', () => ecrire('backgammon.niveau', r.value));
  }
  for (const r of document.querySelectorAll('input[name="longueur"]')) {
    r.addEventListener('change', () => { ecrire('backgammon.longueur', r.value); majNote(); });
  }
  $('videau').addEventListener('change', () => ecrire('backgammon.videau', $('videau').checked ? '1' : '0'));
  $('btn-jouer').addEventListener('click', () => {
    const niv = document.querySelector('input[name="niveau"]:checked')?.value;
    const lon = Number(document.querySelector('input[name="longueur"]:checked')?.value);
    const n = NIVEAUX.includes(niv) ? niv : 'moyen';
    const l = [1, 3, 5].includes(lon) ? lon : 3;
    ecrire('backgammon.niveau', n);
    ecrire('backgammon.longueur', String(l));
    ecrire('backgammon.videau', $('videau').checked ? '1' : '0');
    if (modeChoisi() === 'ami') { lancerAmi(null, { longueur: l, videau: $('videau').checked }); return; }
    jouerPartie(n, nouveauMatch({ longueur: l, videau: $('videau').checked }));
  });
  for (const r of document.querySelectorAll('input[name="mode"]')) r.addEventListener('change', majMode);
  $('invite-annuler').addEventListener('click', quitter);
  $('attente-retour').addEventListener('click', quitter);
  $('copier').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('lien').value);
      $('copier').textContent = t('copie');
    } catch (_) {
      $('lien').focus();
      $('lien').select();                                  // copie manuelle
    }
  });

  $('btn-lancer').addEventListener('click', () => agir('lancer'));
  $('btn-doubler').addEventListener('click', () => agir('doubler'));
  $('btn-valider').addEventListener('click', () => agir('valider'));
  $('btn-annuler').addEventListener('click', annulerPas);
  $('btn-accepter').addEventListener('click', () => agir('accepter'));
  $('btn-refuser').addEventListener('click', () => agir('refuser'));
  $('btn-suivante').addEventListener('click', () => agir('suivante'));
  $('btn-nouveau').addEventListener('click', () => agir('nouveau'));
  $('btn-reclamer').addEventListener('click', reclamer);
  $('btn-menu').addEventListener('click', quitter);
  $('btn-fin-menu').addEventListener('click', quitter);

  const zone = $('plateau');
  zone.addEventListener('pointerdown', surPointerDown);
  zone.addEventListener('pointermove', surPointerMove);
  // Sur window : un lâcher hors du plateau termine le geste même sans capture.
  window.addEventListener('pointerup', surPointerUp);
  window.addEventListener('pointercancel', surPointerCancel);
  // Seule la perte de capture par le plateau lui-même annule le geste (la capture
  // implicite d'un bouton, perdue quand le plateau la prend, ne compte pas).
  zone.addEventListener('lostpointercapture', (e) => { if (e.target === zone) surPointerCancel(e); });
  // Clavier et lecteurs d'écran : un click qui ne suit aucun pointerup.
  zone.addEventListener('click', (e) => {
    if (geste || performance.now() - dernierPointeur < 700) return;
    const b = e.target.closest('button.case');
    if (b) toucherCible(cibleDe(b.dataset.cible));
  });
  document.addEventListener('keydown', surTouche);

  majMenu();

  // Un lien ?room=CODE (l'invité, ou l'hôte qui rafraîchit) saute le menu.
  // Le garde du portail (protocole.js) valide le code ; lien invalide ou jeu
  // servi hors du portail : démarrage normal, sans le paramètre.
  if (params.has('room')) {
    let code = null;
    try {
      const P = await import('/play/net/protocole.js');
      code = P.codeDepuisUrl(location.search);
    } catch (_) { /* hors du portail */ }
    if (code) { lancerAmi(code, null); return; }
    // Lien invalide : on retire le paramètre et on démarre comme sans lien,
    // reprise de la partie contre le robot comprise.
    history.replaceState(history.state, '', location.pathname);
  }

  const sauvee = lirePartie(lire(CLE_PARTIE));
  if (sauvee) { jouerPartie(sauvee.niveau, sauvee.partie); return; }
  effacer(CLE_PARTIE);
  montrer('menu');
}

demarrer();
