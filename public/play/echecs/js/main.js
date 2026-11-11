// Échecs — le DOM : menu, échiquier, gestes (toucher, glisser, clavier),
// promotion, tour du robot (worker.js, repli sur le fil principal),
// feuille de partie, reprise de la partie sauvegardée, vignette. Le mode ami
// (bas du fichier) charge la couche de salles du portail par import()
// dynamique : une partie contre le robot ne télécharge jamais le SDK Firebase.

import { FEN_INITIALE, depuisFEN, indexCase, coupsLegaux, enEchec, depuisUCI, versUCI } from './rules.js';
import {
  nouvellePartie, positionCourante, jouerCoup, etatFin, abandonner, peutAnnuler, annuler,
  ecrirePartie, lirePartie,
} from './partie.js';
import { NIVEAUX, BUDGET_MS, choisirCoup } from './robot.js';
import { creerEchiquier, creerPiece, PIECES, BOIS, GEO } from './echiquier.js';
import {
  analyser, finDe, finie, jouerAmi, abandonAmi, campDuSiege, replier, lirePartage, actionSuivante,
  demanderReprise, repondreReprise, proposerNulle, repondreNulle, tomberDrapeau, possibles, cleTour,
  peutContinuer, reclamerTemps, dater, verdictTemps,
} from './remote.js';
import {
  CADENCES, CREDIT_MS, formatTemps, restant, lireCadence,
} from './pendule.js';

// Les textes : js/i18n.js (script classique chargé dans <head>). `coup`
// traduit un coup de la notation française (san.js) vers celle de la langue.
const { t, coup: notation } = window.LokoI18n;
const nomCadence = (c) => t(`cad.${c}`);

const $ = (id) => document.getElementById(id);
const CLE_PARTIE = 'echecs.partie';
const CLE_NIVEAU = 'echecs.niveau';
const CLE_COULEUR = 'echecs.couleur';
const CLE_PSEUDO = 'echecs.pseudo';
const CLE_CADENCE = 'echecs.cadence';
const COULEURS = ['blancs', 'noirs', 'hasard'];
const NOM_NIVEAU = { facile: t('niv.facile'), intermediaire: t('niv.intermediaire'), moyen: t('niv.moyen'), fort: t('niv.fort') };
const GARDE_MS = 350;          // double toucher sur la même case : le second est ignoré
const DELAI_TRAVAILLEUR_MS = 3000;
const GLISSE_MS = 180;
const SEUIL_GLISSER = 8;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const reduit = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const delaiRobot = () => 400 + Math.random() * 300;
// L'horloge locale, monotone : la borne basse du temps écoulé depuis la
// réception d'une heure serveur.
const horloge = () => performance.now();
const TIC_MS = 100;
const RELANCE_DRAPEAU_MS = 3000;

// Statistiques du portail (lokolok/assets/stats.js) : absentes hors du portail.
const stat = (n, p) => { try { if (window.lokolokStat) window.lokolokStat(n, p); } catch (_) { /* jamais d'erreur */ } };
let statEnCours = null;       // { mode, manche? } : la partie dont le début est parti, pas encore la fin
// L'issue vue de mon camp : gagné, perdu, nul, ou mon abandon.
function issueDe(fin, monCamp) {
  if (!fin.gagnant) return 'nul';
  if (fin.gagnant === monCamp) return 'gagne';
  return fin.type === 'abandon' ? 'abandon' : 'perdu';
}
function statDebut(mode, niv, manche = null) {
  statEnCours = { mode, manche };
  stat('partie_debut', { mode, niveau: niv });
}
function statFin(fin, monCamp) {
  if (!statEnCours) return;
  stat('partie_fin', { mode: statEnCours.mode, issue: issueDe(fin, monCamp) });
  statEnCours = null;
}
// Quitter (menu, nouvelle partie) une partie commencée et pas finie.
function statAbandon() {
  if (!statEnCours) return;
  stat('partie_fin', { mode: statEnCours.mode, issue: 'abandon' });
  statEnCours = null;
}

// ---------------------------------------------------------------- mémoire
function lire(cle) { try { return localStorage.getItem(cle); } catch (_) { return null; } }
function ecrire(cle, v) { try { localStorage.setItem(cle, v); } catch (_) { /* sans mémoire */ } }
function effacer(cle) { try { localStorage.removeItem(cle); } catch (_) { /* sans mémoire */ } }
const lireNiveau = () => { const n = lire(CLE_NIVEAU); return NIVEAUX.includes(n) ? n : 'moyen'; };
const lireCouleur = () => { const c = lire(CLE_COULEUR); return COULEURS.includes(c) ? c : 'blancs'; };
const lirePseudo = () => String(lire(CLE_PSEUDO) || '').slice(0, 20);

// « Au hasard » : un octet tiré par crypto, son bit de poids faible.
function camp(couleur) {
  if (couleur === 'noirs') return 'b';
  if (couleur === 'hasard') return (crypto.getRandomValues(new Uint8Array(1))[0] & 1) ? 'b' : 'w';
  return 'w';
}

// ----------------------------------------------------------------- état
let echiquier = null;
let partie = null;
let niveau = 'moyen';
let jeton = 0;                // change à chaque partie : les suites périmées s'arrêtent
let numeroDemande = 0;        // chaque demande au robot porte un numéro
let selection = null;
let humainActif = false;      // c'est à l'humain : l'échiquier accepte les gestes
let reflexion = false;        // le robot cherche son coup
let finAnim = 0;              // performance.now() de la fin du glissement en cours
let derniereTape = -Infinity;
let derniereCible = null;
let dernierPointeur = -Infinity;
let geste = null;
let fantome = null;
let focusCase = null;         // la case qui porte la tabulation
let promo = null;             // { coups } : promotion en attente du choix
let reseau = null;            // mode ami : { jouer, abandonner, suivante }, posé par partieAmi
let salleOuverte = null;
let amiEnCours = false;       // mode ami lancé, salle peut-être pas encore ouverte

const occupe = () => performance.now() < finAnim;
const retourne = () => !!partie && partie.humain === 'b';

// Un geste reçu pendant le glissement d'une pièce attend sa fin, dans l'ordre.
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

const focusDefautPour = (humain) => (humain === 'b' ? 52 : 12);
const focusDefaut = () => focusDefautPour(retourne() ? 'b' : 'w');

// Le focus est perdu (sur <body>, sur un bouton caché ou désactivé) ou déjà
// sur l'échiquier : il va sur la case qui porte la tabulation.
function rendreFocus() {
  const a = document.activeElement;
  const surEchiquier = a && a.closest && a.closest('#echiquier');
  if (a && a !== document.body && !a.closest('[hidden]') && !a.disabled && !surEchiquier) return;
  if (!partie || $('partie').inert) return;
  const b = echiquier.bouton(focusCase === null ? focusDefaut() : focusCase);
  if (a !== b) b.focus({ preventScroll: true });
}

function annoncer(texte, genre = '') {
  const b = $('bandeau');
  b.textContent = texte;
  b.classList.toggle('reflechit', genre === 'reflechit');
  b.classList.toggle('fin', genre === 'fin');
}

// ----------------------------------------------------------------- écrans
const ECRANS = ['menu', 'robot', 'ami', 'invite', 'attente', 'promo', 'abandon'];
const PLEINS = ['menu', 'robot', 'ami', 'invite', 'attente'];      // ils cachent la partie
function montrer(nom, cible = null) {
  for (const e of ECRANS) $('ecran-' + e).hidden = e !== nom;
  $('partie').inert = !!nom;
  if (nom) {
    const b = cible ? $(cible) : $('ecran-' + nom).querySelector('button:not([hidden])');
    if (b) b.focus();
  }
}
const ecranOuvert = () => ECRANS.some((e) => !$('ecran-' + e).hidden);
const ecranPleinOuvert = () => PLEINS.some((e) => !$('ecran-' + e).hidden);
function erreur(message) {
  montrer('attente');
  $('attente-statut').textContent = message;
}

// ------------------------------------------------------------------ rendu
const estAMoi = (pos, i) => {
  const l = pos.cases[i];
  return !!l && (l === l.toUpperCase()) === (partie.humain === 'w');
};

function rendu() {
  if (!partie) return;
  const pos = positionCourante(partie);
  const cibles = humainActif && selection !== null
    ? [...new Set(coupsLegaux(pos).filter((c) => c.de === selection).map((c) => c.vers))]
    : [];
  const n = partie.coups.length;
  const u = n ? partie.coups[n - 1] : null;
  const dernier = u ? [indexCase(u.slice(0, 2)), indexCase(u.slice(2, 4))] : null;
  const echec = enEchec(pos) ? pos.cases.indexOf(pos.trait === 'w' ? 'K' : 'k') : null;
  echiquier.dessiner(pos, {
    retourne: retourne(), selection, cibles, dernier, echec,
    porte: geste && geste.glisse ? geste.c : null,
    focus: focusCase === null ? focusDefaut() : focusCase,
  });
  renduListe();
  renduBoutons();
  if (!reseau) renduJoueurs(pos);
}

// Contre le robot, comme chess.com : le robot au-dessus de l'échiquier, toi
// en dessous, et la barre de celui qui a le trait cerclée de laiton.
function renduJoueurs(pos) {
  const fin = etatFin(partie);
  const el = $('partie');
  el.classList.add('avec-pendule', 'sans-temps', 'mode-robot');
  $('pendule-haut').hidden = $('pendule-bas').hidden = false;
  $('pendule-haut').querySelector('.pendule-nom').textContent = t('robotNiveau', { niveau: NOM_NIVEAU[niveau] });
  $('pendule-bas').querySelector('.pendule-nom').textContent = t('toi');
  $('pendule-haut').classList.toggle('au-trait', !fin && pos.trait !== partie.humain);
  $('pendule-bas').classList.toggle('au-trait', !fin && pos.trait === partie.humain);
  $('pendule-haut').classList.remove('urgent');
  $('pendule-bas').classList.remove('urgent');
}

// La feuille de partie : un <li> par coup complet, qui suit le dernier.
function renduListe() {
  const ol = $('coups');
  const lignes = [];
  const sans = partie.sans;
  for (let k = 0; k < sans.length; k += 2) {
    const li = document.createElement('li');
    for (const j of [k, k + 1]) {
      const s = document.createElement('span');
      if (j < sans.length) s.textContent = sans[j];
      if (j === sans.length - 1) s.className = 'dernier';
      li.appendChild(s);
    }
    lignes.push(li);
  }
  ol.replaceChildren(...lignes);
  ol.scrollTop = ol.scrollHeight;
}

function renduBoutons() {
  const fin = etatFin(partie);
  $('commandes').hidden = !!fin;
  $('ecran-fin').hidden = !fin;
  // Mode ami : pas de partie suivante après la dernière manche de la salle.
  $('btn-nouvelle').hidden = !!reseau && !reseau.peutSuivre();
  // Mode ami : pas d'annulation, mais reprendre (avec l'accord de l'ami),
  // proposer la nulle, et répondre à la demande de l'ami.
  $('btn-annuler').hidden = !!reseau;
  $('btn-annuler').disabled = reflexion || !peutAnnuler(partie);
  $('btn-abandonner').disabled = reflexion || !!fin;
  $('btn-fin-annuler').hidden = !!reseau || !peutAnnuler(partie);
  const r = reseau ? reseau.possibles() : null;
  const repondre = !!(r && r.repondre);
  $('btn-reprendre').hidden = $('btn-nulle').hidden = !reseau || repondre;
  $('btn-reprendre').disabled = !r || !r.reprendre;
  $('btn-nulle').disabled = !r || !r.nulle;
  $('btn-accepter').hidden = $('btn-refuser').hidden = !repondre;
}

function texteFin(fin) {
  switch (fin.type) {
    case 'mat': return fin.gagnant === partie.humain ? t('finMatGagne') : t('finMatRobot');
    case 'pat': return t('finPat');
    case 'repetition': return t('finRepetition');
    case 'cinquante': return t('finCinquante');
    case 'materiel': return t('finMateriel');
    default: return t('finAbandon');
  }
}

// ---------------------------------------------------------------- partie
// Le mode ami n'écrit jamais la partie sauvegardée du robot : il reprend par la salle.
function sauver() { if (!reseau) ecrire(CLE_PARTIE, ecrirePartie({ niveau, partie })); }

function lancer(niv, p) {
  const moi = ++jeton;
  niveau = niv;
  partie = p;
  selection = null;
  humainActif = false;
  reflexion = false;
  promo = null;
  geste = null;
  finirGeste();
  viderSuspens();
  finAnim = 0;
  focusCase = focusDefaut();
  $('ligne').textContent = t('ligneRobot', { camp: t(p.humain === 'w' ? 'campBlancs' : 'campNoirs'), niveau: NOM_NIVEAU[niv] });
  annoncer('');
  montrer(null);
  sauver();
  statEnCours = null;
  if (!etatFin(p)) statDebut('robot', niv);
  suite(moi, '');
}

// Ce qui vient après un coup : la fin, la main à l'humain, ou le robot.
// `dit` est ce qui vient d'arriver, lu avec l'annonce suivante.
function suite(moi, dit) {
  if (moi !== jeton) return;
  const fin = etatFin(partie);
  if (fin) { finDePartie(fin, dit); return; }
  if (positionCourante(partie).trait === partie.humain) {
    humainActif = true;
    reflexion = false;
    rendu();
    annoncer(dit || t('aToi'));
    rendreFocus();
    return;
  }
  tourRobot(moi);
}

function finDePartie(fin, dit) {
  statFin(fin, partie.humain);
  humainActif = false;
  reflexion = false;
  selection = null;
  rendu();
  const t = texteFin(fin);
  annoncer(dit ? `${dit} ${t}` : t, 'fin');
  const a = document.activeElement;
  if (!a || a === document.body || a.disabled || a.closest('[hidden]') || a.closest('#echiquier')) {
    $('btn-nouvelle').focus({ preventScroll: true });
  }
}

// Le coup est joué, la position redessinée, la pièce glisse — sauf si l'humain
// vient de la déposer lui-même sur son arrivée (`glisse: false`).
function poser(coup, { glisse = true } = {}) {
  const ms = !glisse || reduit() ? 0 : GLISSE_MS;
  finAnim = Math.max(finAnim, performance.now() + ms);
  rendu();
  echiquier.animer(coup, ms);
}

function jouerHumain(coup, depose = false) {
  if (reseau) { reseau.jouer(coup, depose); return; }
  humainActif = false;
  selection = null;
  promo = null;
  partie = jouerCoup(partie, coup);
  sauver();
  focusCase = coup.vers;
  poser(coup, { glisse: !depose });
  annoncer('');
  rendreFocus();
  suite(jeton, '');
}

async function tourRobot(moi) {
  humainActif = false;
  selection = null;
  reflexion = true;
  rendu();
  annoncer(t('robotReflechit'), 'reflechit');
  const debut = performance.now();
  const delai = delaiRobot();
  const num = ++numeroDemande;
  const perime = () => moi !== jeton || num !== numeroDemande;
  try {
    const coup = await coupDuRobot(partie, niveau);
    if (perime()) return;
    const reste = delai - (performance.now() - debut);
    if (reste > 0) await pause(reste);
    if (perime()) return;
    partie = jouerCoup(partie, coup);
    sauver();
    reflexion = false;
    const s = partie.sans[partie.sans.length - 1];
    poser(coup);
    rendreFocus();
    suite(moi, t(s.endsWith('+') ? 'robotAJoueEchec' : 'robotAJoue', { coup: notation(s.replace(/[+#]$/, '')) }));
  } catch (e) {
    // Une erreur imprévue ne laisse pas un échiquier figé, et ne coûte pas la
    // partie : la sauvegarde (faite après chaque coup) reste, on le dit, et
    // Annuler, Abandonner et Menu restent possibles.
    if (perime()) return;
    console.error(e);
    reflexion = false;
    humainActif = false;
    // Le coup du robot a pu être joué et sauvé avant l'erreur : la main revient à l'humain.
    try {
      if (positionCourante(partie).trait === partie.humain) { suite(moi, ''); return; }
    } catch (_) { /* on tombe sur l'annonce */ }
    humainActif = false;
    try { rendu(); } catch (_) { /* l'annonce suffit */ }
    annoncer(t('robotErreur'));
    rendreFocus();
  }
}

// ------------------------------------------------------------------ robot
// Un seul worker, créé à la première demande. Erreur ou silence au-delà du
// budget + 3 s : il est abandonné, ce coup-là est calculé sur le fil
// principal avec un budget court, et un worker neuf est créé au tour suivant.
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
  if (typeof Worker !== 'function') { travailleur = null; return null; }
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
    d.resoudre(r && typeof r.coup === 'string' ? r.coup : null);
  };
  w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); if (actif()) abandonnerTravailleur(); };
  w.onmessageerror = () => { if (actif()) abandonnerTravailleur(); };
  return w;
}
function demanderAuTravailleur(coups, niv) {
  const w = obtenirTravailleur();
  if (!w) return Promise.resolve(null);
  return new Promise((resoudre) => {
    const d = { resoudre, minuterie: setTimeout(abandonnerTravailleur, BUDGET_MS[niv] + DELAI_TRAVAILLEUR_MS) };
    enAttente.push(d);
    try {
      w.postMessage({ fen: FEN_INITIALE, coups: coups.slice(), niveau: niv, budgetMs: BUDGET_MS[niv] });
    } catch (_) {
      abandonnerTravailleur();
    }
  });
}
// La réponse est revalidée sur la position : un coup invalide passe au repli.
async function coupDuRobot(p, niv) {
  const pos = positionCourante(p);
  const uci = await demanderAuTravailleur(p.coups, niv);
  const coup = uci ? depuisUCI(pos, uci) : null;
  if (coup) return coup;
  const r = choisirCoup({ fen: FEN_INITIALE, coups: p.coups }, niv, { budgetMs: BUDGET_MS.repli });
  const sur = depuisUCI(pos, versUCI(r.coup));
  if (!sur) throw new Error('Coup du robot invalide');
  return sur;
}

// ---------------------------------------------------------------- gestes
function toucher(c) {
  if (c === null || c === undefined) { deselectionner(); return; }
  if (!partie) return;
  if (!humainActif || ecranOuvert()) return;
  if (occupe()) { apresAnim(() => toucher(c)); return; }
  // Seul un second toucher sur la même case est ignoré : il défairait le choix
  // d'une pièce. « Pièce puis arrivée », même rapide, passe.
  const t = performance.now();
  if (c === derniereCible && t - derniereTape < GARDE_MS) return;
  derniereTape = t;
  derniereCible = c;
  focusCase = c;
  const pos = positionCourante(partie);
  if (selection !== null) {
    const cs = coupsLegaux(pos).filter((k) => k.de === selection && k.vers === c);
    if (cs.length) { tenter(cs); return; }
  }
  selection = estAMoi(pos, c) && selection !== c ? c : null;
  rendu();
}

// Toucher le cadre ou hors de l'échiquier : la pièce choisie est relâchée.
function deselectionner() {
  if (!partie || !humainActif || ecranOuvert() || selection === null) return;
  selection = null;
  rendu();
}

// Plusieurs coups vers la même case : c'est une promotion, on demande la pièce.
// `depose` : la pièce a été glissée jusqu'à son arrivée, elle n'a plus à y glisser.
function tenter(cs, depose = false) {
  if (cs.length > 1) ouvrirPromo(cs, depose);
  else jouerHumain(cs[0], depose);
}

function ouvrirPromo(cs, depose) {
  promo = { coups: cs, depose };
  rendu();
  const blanc = partie.humain === 'w';
  for (const b of document.querySelectorAll('.piece-promo')) {
    const l = b.dataset.promo;
    const ancien = b.querySelector('svg');
    if (ancien) ancien.remove();
    b.prepend(creerPiece(blanc ? l.toUpperCase() : l));
  }
  annoncer(t('choisisPromo'));
  montrer('promo');
}
function choisirPromo(lettre) {
  if (!promo) return;
  const c = promo.coups.find((k) => k.promo === lettre);
  if (!c) return;
  montrer(null);
  jouerHumain(c, promo.depose);
}
function annulerPromo() {
  if (!promo) return;
  promo = null;
  selection = null;
  montrer(null);
  rendu();
  if (reseau) reseau.bandeau(); else annoncer(t('aToi'));
  rendreFocus();
}

function finirGeste() {
  if (fantome) { fantome.remove(); fantome = null; }
}
function surPointerDown(e) {
  if (geste && geste.id === e.pointerId) return;
  if (geste) surPointerCancel({ pointerId: geste.id });   // geste resté en plan
  if (!partie || !humainActif || ecranOuvert()) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const c = echiquier.caseSous(e.clientX, e.clientY);
  geste = { id: e.pointerId, x0: e.clientX, y0: e.clientY, c, glisse: false };
  try { $('echiquier').setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
}
function surPointerMove(e) {
  if (!geste || e.pointerId !== geste.id) return;
  if (!geste.glisse) {
    if (Math.hypot(e.clientX - geste.x0, e.clientY - geste.y0) < SEUIL_GLISSER) return;
    if (!humainActif || occupe() || ecranOuvert() || geste.c === null) return;
    const pos = positionCourante(partie);
    if (!estAMoi(pos, geste.c)) return;
    geste.glisse = true;
    selection = geste.c;
    focusCase = geste.c;
    const taille = echiquier.tailleCase() * 1.1;
    fantome = document.createElement('div');
    fantome.className = 'fantome';
    fantome.style.width = fantome.style.height = `${taille}px`;
    fantome.appendChild(creerPiece(pos.cases[geste.c]));
    document.body.appendChild(fantome);
    rendu();
  }
  fantome.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -60%)`;
}
function surPointerUp(e) {
  if (!geste || e.pointerId !== geste.id) return;
  const g = geste;
  geste = null;
  dernierPointeur = performance.now();
  finirGeste();
  if (!g.glisse) { toucher(g.c); return; }
  const v = echiquier.caseSous(e.clientX, e.clientY);
  if (humainActif && !occupe() && !ecranOuvert() && v !== null) {
    const cs = coupsLegaux(positionCourante(partie)).filter((k) => k.de === g.c && k.vers === v);
    if (cs.length) {
      derniereTape = performance.now();
      derniereCible = v;
      focusCase = v;
      tenter(cs, true);
      return;
    }
  }
  if (v !== g.c) selection = null;   // lâchée hors d'une arrivée : la pièce revient
  rendu();
}
function surPointerCancel(e) {
  if (!geste || e.pointerId !== geste.id) return;
  const g = geste;
  geste = null;
  finirGeste();
  if (g.glisse) { selection = null; rendu(); }
}

// Les flèches suivent l'échiquier affiché (retourné quand l'humain a les noirs).
function deplacerFocus(dx, dy) {
  const i = focusCase === null ? focusDefaut() : focusCase;
  const ret = retourne();
  const f = i & 7, r = i >> 3;
  const dc = Math.min(7, Math.max(0, (ret ? 7 - f : f) + dx));
  const dr = Math.min(7, Math.max(0, (ret ? r : 7 - r) + dy));
  focusCase = (ret ? dr : 7 - dr) * 8 + (ret ? 7 - dc : dc);
  rendu();
  echiquier.bouton(focusCase).focus({ preventScroll: true });
}

const FLECHES = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
function surTouche(e) {
  if (!partie || ecranPleinOuvert()) return;
  if (!$('ecran-promo').hidden) {
    if (e.key === 'Escape') { e.preventDefault(); annulerPromo(); }
    return;
  }
  if (!$('ecran-abandon').hidden) {
    if (e.key === 'Escape') { e.preventDefault(); nePasAbandonner(); }
    return;
  }
  // Une saisie (« Ton prénom ») garde ses touches : pas de raccourci de jeu.
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.altKey || e.metaKey) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey && k === 'z') || (!e.ctrlKey && k === 'u')) { e.preventDefault(); annulerCoup(); return; }
  if (e.ctrlKey) return;
  if (e.key === 'Escape') {
    if (selection !== null) { selection = null; rendu(); }
    return;
  }
  const fl = FLECHES[e.key];
  if (fl && e.target instanceof Element && e.target.closest('#echiquier')) {
    e.preventDefault();
    deplacerFocus(fl[0], fl[1]);
  }
}

// ------------------------------------------------------- commandes de partie
function annulerCoup() {
  if (reseau || !partie || reflexion || ecranOuvert() || !peutAnnuler(partie)) return;
  if (occupe()) { apresAnim(annulerCoup); return; }
  const avant = partie.coups.length;
  partie = annuler(partie);
  sauver();
  selection = null;
  humainActif = false;
  suite(jeton, avant - partie.coups.length > 1 ? t('coupsAnnules') : t('coupAnnule'));
}

function demanderAbandon() {
  if (!partie || reflexion || etatFin(partie) || ecranOuvert()) return;
  selection = null;
  rendu();
  montrer('abandon', 'btn-non');
}
function abandonnerPartie() {
  montrer(null);
  if (!partie || etatFin(partie)) return;
  if (reseau) { reseau.abandonner(); return; }
  partie = abandonner(partie);
  sauver();
  suite(jeton, '');
}
// « Non » ou Échap : le focus revient sur « Abandonner », d'où le dialogue est parti.
function nePasAbandonner() {
  montrer(null);
  const b = $('btn-abandonner');
  if (!b.disabled && !b.closest('[hidden]')) b.focus({ preventScroll: true });
  else rendreFocus();
}

function nouvelle() {
  if (reseau) { reseau.suivante(); return; }
  if (!partie) return;
  statAbandon();
  effacer(CLE_PARTIE);
  lancer(niveau, nouvellePartie({ humain: camp(lireCouleur()) }));
}

function quitter() {
  statAbandon();
  if (salleOuverte || amiEnCours) {
    // Démarrage propre : c'est ce qui coupe les abonnements de la salle.
    if (salleOuverte) salleOuverte.fermer();
    location.href = location.pathname;
    return;
  }
  jeton++;
  viderSuspens();
  humainActif = false;
  reflexion = false;
  promo = null;
  geste = null;
  finirGeste();
  partie = null;
  effacer(CLE_PARTIE);
  annoncer('');
  majMenu();
  montrer('menu');
}

// ------------------------------------------------------------------- menu
function majMenu() {
  const n = lireNiveau(), c = lireCouleur();
  for (const r of document.querySelectorAll('input[name="niveau"]')) r.checked = r.value === n;
  for (const r of document.querySelectorAll('input[name="couleur"]')) r.checked = r.value === c;
}

// -------------------------------------------------------------------- ami
// Salle v2 : chacun écrit son journal d'actions, daté par le serveur ;
// remote.replier rejoue les deux journaux fusionnés (auteur vérifié par le
// siège, pendule calculée sur les heures du serveur). Tout ce qui vient de la
// salle (actions, prénom) est une donnée non fiable et passe par remote.js
// ou textContent. Seule exception : le SVG du QR code, fabriqué par le
// portail à partir d'une URL que nous construisons. Le mode ami n'écrit
// jamais la partie sauvegardée.

async function partieAmi(code, cadenceDemandee = 0) {
  const moi = ++jeton;
  viderSuspens();
  partie = null;
  humainActif = false;
  selection = null;
  promo = null;
  montrer('attente');
  $('attente-statut').textContent = code ? t('connexion', { code }) : t('ouverture');

  let Net;
  try {
    Net = await import('/play/net/salle2.js');
  } catch (_) {
    // Sur le portail, c'est le réseau ou un bloqueur ; ailleurs, la couche de
    // salles n'existe pas.
    throw new Error(location.pathname.startsWith('/play/')
      ? t('errInjoignable')
      : t('errHorsPortail'));
  }
  if (moi !== jeton) return;
  const salle = code
    ? await Net.rejoindreSalle('echecs', code)
    : await Net.creerSalle('echecs', { partage: { cadence: cadenceDemandee } });
  if (moi !== jeton) { salle.fermer(); return; }
  salleOuverte = salle;
  const siege = salle.siege;
  if (siege !== 1 && siege !== 2) throw new Error(t('errSiege'));
  if (!code) stat('salle_creee'); else if (siege === 2) stat('salle_rejointe');
  const partage = lirePartage(salle.partage);
  if (!partage) throw new Error(t('errIllisible'));

  let connu = null;          // état rejoué depuis les deux journaux
  let analyse = null;        // analyser(connu)
  let finConnue = null;      // etatFin(partie), calculée une fois par état
  let cleConnue = '';        // pour ne pas redessiner un état identique
  let assis = false;         // l'ami a pris sa place
  let amiEnLigne = false;
  let nomAmi = '';
  let alerte = '';
  let qrFait = false;
  let envoi = false;         // une de mes actions est en vol (une à la fois)
  let depose = false;        // mon coup en vol a été déposé à la main : pas de glissé
  let refusTemps = 0;        // défaites ou réclamations refusées par le serveur
  let estimee = 0;           // heure serveur estimée de ma dernière écriture à dater
  let monCamp = 'w';
  // L'ancre du tour en cours, à l'horloge locale : la réception de l'heure
  // serveur de son début (borne basse du temps écoulé, pour réclamer).
  let ancre = { cle: null, t: 0 };
  let essaiTemps = -Infinity;
  const lui = () => (monCamp === 'w' ? 'b' : 'w');

  const champ = $('pseudo');
  champ.value = lirePseudo();
  $('ligne-pseudo').hidden = false;
  function majLigne() {
    const c = partage.cadence;
    const cad = c ? ` · ${nomCadence(c)}` : '';
    $('ligne').textContent = t('ligneAmi', { camp: t(monCamp === 'w' ? 'campBlancs' : 'campNoirs'), nom: nomAmi || t('tonAmiMin') }) + cad;
  }
  function publierPseudo() {
    const p = champ.value.trim().slice(0, 20);
    ecrire(CLE_PSEUDO, p);
    salle.poserPseudo(p).catch(() => { /* le prénom n'est pas vital */ });
  }
  champ.onchange = publierPseudo;
  if (champ.value) publierPseudo();
  majLigne();

  // La partie affichée : celle de l'état, vue de mon camp, avec son issue
  // hors de l'échiquier (abandon, temps, accord) posée pour etatFin().
  function prendre(e, a = analyser(e)) {
    analyse = a;
    monCamp = campDuSiege(e, siege);
    partie = { ...analyse.partie, humain: monCamp, issue: analyse.issue ? finDe(analyse) : null };
    finConnue = etatFin(partie);
  }

  // ------------------------------------------------------------ pendule
  function noterAncre() {
    if (!connu || !analyse) return;
    const cle = cleTour(connu, analyse);
    if (cle === ancre.cle || analyse.debut === null) return;   // début pas encore daté
    ancre = { cle, t: horloge() };
  }
  const tourne = (camp) => !!analyse && analyse.tourne && analyse.trait === camp;
  // Le temps à l'heure serveur estimée, mes heures pas encore datées
  // remplacées par l'estimation de mon écriture (une estimation fausse peut
  // rendre ma réclamation « trop tôt » : on affiche alors sans l'estimation).
  function resteDe(camp) {
    if (!analyse || analyse.cadence === 0) return null;
    let a = analyse;
    try { a = analyser(dater(connu, estimee)); } catch (_) { /* affichage seul */ }
    return restant({ reste: a.reste[camp], tourne: tourne(camp), debut: a.debut, maintenant: Net.heureServeur() });
  }
  // Comme chess.com : le nom de l'ami au-dessus de l'échiquier, le mien en
  // dessous, avec le temps seulement quand la partie a une pendule.
  function majPendules() {
    const avec = !!connu && !!analyse;
    const temps = avec && connu.cadence > 0;
    $('partie').classList.toggle('avec-pendule', avec);
    $('partie').classList.toggle('sans-temps', avec && !temps);
    $('partie').classList.remove('mode-robot');
    $('pendule-haut').hidden = $('pendule-bas').hidden = !avec;
    if (!avec) return;
    const fin = finConnue;
    $('pendule-haut').querySelector('.pendule-nom').textContent = nomAmi || t('tonAmi');
    $('pendule-bas').querySelector('.pendule-nom').textContent = t('toi');
    for (const [id, camp] of [['pendule-haut', lui()], ['pendule-bas', monCamp]]) {
      const el = $(id);
      const auTrait = !fin && analyse.trait === camp;
      el.classList.toggle('au-trait', auTrait);
      if (!temps) { el.classList.remove('urgent'); continue; }
      const r = resteDe(camp);
      const texte = formatTemps(r);
      const span = el.querySelector('.pendule-temps');
      if (span.textContent !== texte) span.textContent = texte;
      el.classList.toggle('urgent', r < 10000 && (auTrait || r <= 0));
    }
  }
  // Ma pendule à la limite du serveur : je publie ma défaite. Le temps de
  // l'ami sûrement épuisé à l'heure serveur (borne basse locale) : je le
  // réclame, et la réclamation sera datée après sa limite.
  function verdict() {
    if (!analyse || !analyse.tourne || finConnue) return null;
    const ecoule = ancre.cle === cleTour(connu, analyse) ? horloge() - ancre.t : null;
    return verdictTemps(connu, monCamp, { maintenant: Net.heureServeur(), estimee, ecoule });
  }
  function tic() {
    if (moi !== jeton) { clearInterval(minuterie); return; }
    if (!connu || connu.cadence === 0) return;
    majPendules();
    const v = verdict();
    if (v === 'drapeau') drapeau();
    else if (v === 'reclamer') auTemps(() => reclamerTemps(connu, monCamp), t('reclamationEchec'));
  }
  function auTemps(fabrique, message) {
    // Refusée deux fois par les règles : on n'insiste plus.
    if (refusTemps >= 2 || envoi || horloge() - essaiTemps < RELANCE_DRAPEAU_MS) return;
    let a;
    try { a = fabrique(); } catch (_) { return; }
    essaiTemps = horloge();
    envoyer(a, message, { sorte: 'temps' });
  }
  const drapeau = () => auTemps(() => tomberDrapeau(connu, monCamp), t('drapeauEchec'));
  const minuterie = setInterval(tic, TIC_MS);

  // ------------------------------------------------------------ bandeau
  // La dernière action, si elle vient de l'ami : « Ton ami a joué Cf3. »
  function dernierMotDeLAmi() {
    const a = analyse.trace[analyse.trace.length - 1];
    if (!a || a.auteur !== lui()) return '';
    if (/^[a-h]/.test(a.action)) {
      const s = partie.sans[partie.sans.length - 1];
      return t(s.endsWith('+') ? 'amiAJoueEchec' : 'amiAJoue', { coup: notation(s.replace(/[+#]$/, '')) });
    }
    if (a.action === 'ra') return t('amiAccepte');
    if (a.action === 'rr') return t('amiRefuseReprise');
    if (a.action === 'nr') return t('amiRefuseNulle');
    return '';
  }
  function texteFinAmi(fin) {
    const lePerdant = fin.camp === monCamp;
    switch (fin.type) {
      case 'abandon': return lePerdant ? t('finAbandon') : t('finAbandonAmi');
      case 'accord': return t('finAccord');
      case 'temps': return lePerdant ? t('finTempsMoi') : t('finTempsAmi');
      case 'temps-nulle': return lePerdant
        ? t('finTempsNulleMoi')
        : t('finTempsNulleAmi');
      default: break;
    }
    const texte = fin.type === 'mat' && fin.gagnant !== monCamp ? t('finMatAmi') : texteFin(fin);
    const dit = dernierMotDeLAmi();
    return dit ? `${dit} ${texte}` : texte;
  }
  function majBandeau() {
    if (!connu) { annoncer(t('lecture')); return; }
    const fin = etatFin(partie);
    if (fin) { annoncer(texteFinAmi(fin), 'fin'); return; }
    if (assis && !amiEnLigne) { annoncer(t('amiDeconnecte')); return; }
    if (alerte) { annoncer(alerte); return; }
    if (promo) { annoncer(t('choisisPromo')); return; }
    const d = analyse.demande;
    if (d && d.camp !== monCamp) {
      annoncer(d.type === 'reprise' ? t('amiVeutReprendre') : t('amiProposeNulle'));
      return;
    }
    const attente = !d ? '' : (d.type === 'reprise' ? t('repriseEnvoyee') : t('nulleProposee'));
    if (analyse.trait === monCamp) annoncer([dernierMotDeLAmi() || t('aToi'), attente].filter(Boolean).join(' '));
    else annoncer(attente || dernierMotDeLAmi() || t('amiReflechit'), attente ? '' : 'reflechit');
  }

  // Redessine l'état connu ; `coup` glisse s'il est donné (`glisse: false` :
  // je viens de le déposer moi-même sur son arrivée).
  // Une partie (manche de la salle) commence quand l'ami est assis ; elle finit à son issue.
  let statManche = null;
  function noterStat() {
    const fin = finConnue;
    if (statEnCours && statEnCours.manche !== connu.manche) statAbandon();
    if (!statEnCours && assis && !fin && connu.manche !== statManche) {
      statManche = connu.manche;
      statDebut('ami', String(partage.cadence), connu.manche);
    }
    if (fin && statEnCours && statEnCours.manche === connu.manche) statFin(fin, monCamp);
  }

  function afficher(coup = null, glisse = true) {
    if (!connu) return;
    noterStat();
    const fin = etatFin(partie);
    humainActif = assis && !fin && positionCourante(partie).trait === monCamp;
    if (!humainActif) {
      selection = null;
      if (geste) surPointerCancel({ pointerId: geste.id });
      if (promo) { promo = null; montrer(null); }
    }
    if (fin && !$('ecran-abandon').hidden) montrer(null);
    majLigne();
    majPendules();
    if (coup) poser(coup, { glisse }); else rendu();
    majBandeau();
    const a = document.activeElement;
    const perdu = !a || a === document.body || a.disabled || a.closest('[hidden]') || a.closest('#echiquier');
    if (fin && perdu) {
      if (!$('partie').inert) $('btn-nouvelle').focus({ preventScroll: true });
    } else {
      rendreFocus();
    }
  }

  // Une action dans mon journal. Elle s'affiche dès l'écriture locale
  // (surJournal la rend tout de suite, heure à dater) ; refusée par le
  // serveur, elle disparaît d'elle-même du journal et l'état revient.
  // `sorte` 'temps' : défaite ou réclamation, comptée si refusée.
  function envoyer(a, messageEchec, { sorte = 'action', siRefus = null } = {}) {
    if (envoi) return false;
    envoi = true;
    alerte = '';
    estimee = Net.heureServeur();
    salle.ajouter(a).then(() => {
      envoi = false;
      depose = false;
    }, () => {
      envoi = false;
      depose = false;
      if (moi !== jeton) return;
      if (sorte === 'temps') refusTemps++;
      if (siRefus) siRefus();
      alerte = messageEchec;
      afficher();
    });
    return true;
  }
  // Ma pendule est tombée : à la limite du serveur (début + reste + crédit :
  // les 300 dernières ms affichées à 0 restent jouables).
  const tombee = () => tourne(monCamp) && resteDe(monCamp) <= -CREDIT_MS;
  function tenterAction(fabrique, messageEchec) {
    if (!connu || envoi) return;
    // Pendule tombée : aucune action, ma défaite part à la place.
    if (tombee()) { drapeau(); return; }
    let a;
    try { a = fabrique(); } catch (_) { rendu(); return; }
    envoyer(a, messageEchec);
  }

  reseau = {
    jouer(coup, deposeMain) {
      promo = null;
      selection = null;
      if (!connu || !humainActif || envoi) { rendu(); return; }
      if (tombee()) { drapeau(); rendu(); return; }
      let a;
      try { a = jouerAmi(connu, monCamp, versUCI(coup)); } catch (_) { rendu(); return; }
      focusCase = coup.vers;
      depose = !!deposeMain;
      envoyer(a, t('echecCoup'), { siRefus: () => { focusCase = coup.de; } });
    },
    abandonner() {
      if (!connu || finie(connu)) return;
      tenterAction(() => abandonAmi(connu, monCamp), t('echecAbandon'));
    },
    reprendre() {
      if (!assis) return;
      tenterAction(() => demanderReprise(connu, monCamp), t('echecDemande'));
    },
    nulle() {
      if (!assis) return;
      tenterAction(() => proposerNulle(connu, monCamp), t('echecProposition'));
    },
    repondre(oui) {
      const d = analyse && analyse.demande;
      if (!d || d.camp === monCamp) return;
      tenterAction(() => (d.type === 'nulle' ? repondreNulle(connu, monCamp, oui) : repondreReprise(connu, monCamp, oui)),
        t('echecReponse'));
    },
    // Les deux joueurs peuvent lancer la partie suivante : le second N est ignoré.
    suivante() {
      if (!connu || envoi || !peutContinuer(connu)) return;
      selection = null;
      envoyer(actionSuivante(connu), t('echecSuivante'));
    },
    possibles: () => (connu && analyse && assis ? possibles(analyse, monCamp) : null),
    peutSuivre: () => !!connu && peutContinuer(connu),
    bandeau: () => majBandeau(),
  };

  async function inviter() {
    // Appelée à chaque mise à jour de présence : ne pas reprendre le focus.
    if ($('ecran-invite').hidden) montrer('invite');
    $('lien').value = salle.url;
    $('invite-cadence').textContent = t('inviteCadence', { cadence: nomCadence(partage.cadence) });
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
    if (moi !== jeton) return;
    assis = !!autre;
    amiEnLigne = assis && autre.enLigne !== false;
    nomAmi = assis && typeof autre.pseudo === 'string' ? autre.pseudo.trim().slice(0, 20) : '';
    // Tant que l'ami n'est pas assis, l'invitation reste à l'écran — y
    // compris pour un hôte qui a rafraîchi sa page avant son arrivée.
    if (!assis) inviter();
    else if (!$('ecran-invite').hidden || !$('ecran-attente').hidden) montrer(null);
    if (connu) afficher(); else { majLigne(); majBandeau(); }
  });

  // Les journaux : remote.replier rejoue tout ; ici, l'affichage.
  salle.surJournal((entrees) => {
    if (moi !== jeton) return;
    const { etat: e, analyse: a } = replier(entrees, partage);
    const cle = `${e.manche}|${e.actions.join(' ')}|${e.heures.join(' ')}`;
    if (connu && cle === cleConnue) return;
    const premier = !connu;
    // Un seul coup de plus, dans la même partie : il glisse (sauf mon coup
    // déposé à la main). Sinon (premier état, nouvelle partie, reprise, coup
    // arrivé après le drapeau, plusieurs actions à la fois) : redessiné tel quel.
    let coup = null;
    let glisse = true;
    const der = e.actions[e.actions.length - 1];
    if (!premier && e.manche === connu.manche && e.actions.length === connu.actions.length + 1 && /^[a-h]/.test(der)
        && !a.trace[e.actions.length - 1].tardive) {
      coup = depuisUCI(positionCourante(partie), der);
      if (a.trace[e.actions.length - 1].auteur === campDuSiege(e, siege) && depose) glisse = false;
    }
    const autrePartie = premier || e.manche !== connu.manche;
    connu = e;
    cleConnue = cle;
    prendre(e, a);
    noterAncre();
    if (autrePartie) { selection = null; focusCase = focusDefaut(); }
    afficher(coup, glisse);
  });
}

function lancerAmi(code, cadence = 0) {
  amiEnCours = true;
  const tentative = partieAmi(code, cadence);
  const moi = jeton;                 // posé par partieAmi, de façon synchrone
  tentative.catch((e) => {
    // Une tentative abandonnée qui échoue plus tard ne touche à rien.
    if (moi !== jeton) return;
    jeton++;
    reseau = null;
    partie = null;
    humainActif = false;
    if (salleOuverte) { salleOuverte.fermer(); salleOuverte = null; }
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
  const fond = g.createRadialGradient(200, 110, 20, 260, 180, 520);
  fond.addColorStop(0, '#5E2826'); fond.addColorStop(.5, '#4A1D1C'); fond.addColorStop(1, '#2C1010');
  g.fillStyle = fond; g.fillRect(0, 0, 640, 400);

  const { F, S, T } = GEO;
  const cote = 356, X = 26, Y = 22, k = cote / T;
  // Une Italienne, après 7. Fg5 : le dernier coup est c1–g5.
  const pos = depuisFEN('r1bq1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 b - - 1 7');
  const dernier = [2, 38];
  g.save();
  g.translate(X, Y); g.scale(k, k);
  g.shadowColor = 'rgba(20,4,4,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 18;
  g.fillStyle = BOIS.cadre; g.beginPath(); g.roundRect(0, 0, T, T, 10); g.fill();
  g.shadowColor = 'transparent';
  for (let dr = 0; dr < 8; dr++) {
    for (let dc = 0; dc < 8; dc++) {
      const x = F + dc * S, y = F + dr * S;
      g.fillStyle = (dr + dc) % 2 === 0 ? BOIS.erable : BOIS.noyer;
      g.fillRect(x, y, S, S);
      // Le veinage : quelques fils, dans un sens ou dans l'autre.
      g.strokeStyle = 'rgba(70,35,10,0.12)'; g.lineWidth = 1.3;
      const sens = (dr + dc) % 4 < 2;
      for (let t = 6; t < S; t += 11) {
        g.beginPath();
        if (sens) { g.moveTo(x + t, y); g.bezierCurveTo(x + t + 2, y + 35, x + t - 2, y + 70, x + t + 1, y + S); }
        else { g.moveTo(x, y + t); g.bezierCurveTo(x + 35, y + t + 2, x + 70, y + t - 2, x + S, y + t + 1); }
        g.stroke();
      }
      const i = (7 - dr) * 8 + dc;
      if (dernier.includes(i)) { g.fillStyle = 'rgba(201,162,39,0.42)'; g.fillRect(x, y, S, S); }
    }
  }
  g.strokeStyle = BOIS.laiton; g.lineWidth = 2.5;
  g.strokeRect(F - 3, F - 3, 8 * S + 6, 8 * S + 6);
  g.fillStyle = BOIS.laiton; g.font = '600 21px Fraunces, Georgia, serif, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let q = 0; q < 8; q++) {
    g.fillText('abcdefgh'[q], F + q * S + S / 2, T - F / 2 + 1);
    g.fillText(String(8 - q), F / 2, F + q * S + S / 2 + 1);
  }
  const chemins = {};
  for (const [l, p] of Object.entries(PIECES)) chemins[l] = { corps: new Path2D(p.corps), details: p.details ? new Path2D(p.details) : null };
  pos.cases.forEach((lettre, i) => {
    if (!lettre) return;
    const blanc = lettre === lettre.toUpperCase();
    const c = chemins[lettre.toLowerCase()];
    g.save();
    g.translate(F + (i & 7) * S, F + (7 - (i >> 3)) * S);
    g.fillStyle = 'rgba(20,10,4,0.3)'; g.beginPath(); g.ellipse(50, 90, 29, 5, 0, 0, 7); g.fill();
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = blanc ? BOIS.encre : BOIS.filet; g.lineWidth = blanc ? 5 : 4.5;
    g.stroke(c.corps);
    const grad = g.createLinearGradient(20, 10, 80, 90);
    if (blanc) { grad.addColorStop(0, '#FFF9EA'); grad.addColorStop(.55, BOIS.ivoire); grad.addColorStop(1, BOIS.ivoireOmbre); }
    else { grad.addColorStop(0, BOIS.ebeneReflet); grad.addColorStop(.5, BOIS.ebene); grad.addColorStop(1, '#120C09'); }
    g.fillStyle = grad; g.fill(c.corps);
    if (c.details) { g.lineWidth = 3; g.globalAlpha = blanc ? 0.75 : 0.6; g.stroke(c.details); g.globalAlpha = 1; }
    g.restore();
  });
  g.restore();

  const cx = 26 + cote + (640 - 26 - cote) / 2;
  g.fillStyle = BOIS.ivoire; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '600 64px Fraunces, Georgia, serif, system-ui, sans-serif';
  const titre = {"fr": "Échecs", "en": "Chess", "es": "Ajedrez", "de": "Schach", "pt": "Xadrez", "it": "Scacchi", "ru": "Шахматы", "zh": "国际象棋", "ar": "الشطرنج", "bn": "দাবা", "hy": "Շախմատ", "ur": "شطرنج"};
  g.fillText(titre[(document.documentElement.lang || 'fr').split('-')[0]] || titre.fr, cx, 196, 640 - 26 - cote - 30);
  // Le filet du menu : huit cases cerclées de laiton.
  const fw = 160, fx = cx - fw / 2, fy = 222;
  g.fillStyle = BOIS.laiton; g.fillRect(fx - 3.5, fy - 3.5, fw + 7, 18);
  g.fillStyle = BOIS.cadre; g.fillRect(fx - 2, fy - 2, fw + 4, 15);
  for (let q = 0; q < 8; q++) { g.fillStyle = q % 2 ? BOIS.noyer : BOIS.erable; g.fillRect(fx + q * 20, fy, 20, 11); }
  window.__vignette = () => toile.toDataURL('image/png');
}

// ----------------------------------------------------------------- départ
async function demarrer() {
  const params = new URLSearchParams(location.search);
  if (params.get('vignette') === '1') {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([
          document.fonts.load('600 64px Fraunces'),
          document.fonts.load('600 21px Fraunces'),
        ]).catch(() => {}),
        pause(1500),
      ]);
    }
    vignette();
    return;
  }

  echiquier = creerEchiquier($('echiquier'));
  echiquier.dessiner(depuisFEN(FEN_INITIALE));

  for (const r of document.querySelectorAll('input[name="niveau"]')) {
    r.addEventListener('change', () => ecrire(CLE_NIVEAU, r.value));
  }
  for (const r of document.querySelectorAll('input[name="couleur"]')) {
    r.addEventListener('change', () => ecrire(CLE_COULEUR, r.value));
  }
  $('btn-jouer').addEventListener('click', () => {
    const niv = document.querySelector('input[name="niveau"]:checked')?.value;
    const coul = document.querySelector('input[name="couleur"]:checked')?.value;
    const n = NIVEAUX.includes(niv) ? niv : 'moyen';
    const c = COULEURS.includes(coul) ? coul : 'blancs';
    ecrire(CLE_NIVEAU, n);
    ecrire(CLE_COULEUR, c);
    lancer(n, nouvellePartie({ humain: camp(c) }));
  });

  $('btn-robot').addEventListener('click', () => { majMenu(); montrer('robot', 'btn-jouer'); });
  $('btn-robot-retour').addEventListener('click', () => montrer('menu', 'btn-robot'));
  // Avec un ami : l'hôte choisit la pendule avant de créer la salle.
  $('btn-ami').addEventListener('click', () => {
    const c = String(lireCadence(lire(CLE_CADENCE)));
    for (const r of document.querySelectorAll('input[name="cadence"]')) r.checked = r.value === c;
    montrer('ami', 'btn-creer');
  });
  $('btn-ami-retour').addEventListener('click', () => montrer('menu', 'btn-ami'));
  $('btn-creer').addEventListener('click', () => {
    const v = document.querySelector('input[name="cadence"]:checked')?.value;
    const c = CADENCES.includes(Number(v)) ? Number(v) : 0;
    ecrire(CLE_CADENCE, String(c));
    lancerAmi(null, c);
  });
  $('invite-annuler').addEventListener('click', quitter);
  $('attente-retour').addEventListener('click', quitter);
  $('copier').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('lien').value);
      $('copier').textContent = t('lienCopie');
    } catch (_) {
      $('lien').focus();
      $('lien').select();                                  // copie manuelle
    }
  });

  $('btn-annuler').addEventListener('click', annulerCoup);
  $('btn-fin-annuler').addEventListener('click', annulerCoup);
  $('btn-abandonner').addEventListener('click', demanderAbandon);
  $('btn-reprendre').addEventListener('click', () => { if (reseau && !ecranOuvert()) reseau.reprendre(); });
  $('btn-nulle').addEventListener('click', () => { if (reseau && !ecranOuvert()) reseau.nulle(); });
  $('btn-accepter').addEventListener('click', () => { if (reseau && !ecranOuvert()) reseau.repondre(true); });
  $('btn-refuser').addEventListener('click', () => { if (reseau && !ecranOuvert()) reseau.repondre(false); });
  $('btn-oui').addEventListener('click', abandonnerPartie);
  $('btn-non').addEventListener('click', nePasAbandonner);
  $('btn-nouvelle').addEventListener('click', nouvelle);
  $('btn-menu').addEventListener('click', quitter);
  $('btn-fin-menu').addEventListener('click', quitter);
  for (const b of document.querySelectorAll('.piece-promo')) {
    b.addEventListener('click', () => choisirPromo(b.dataset.promo));
  }
  $('btn-promo-annuler').addEventListener('click', annulerPromo);

  const zone = $('echiquier');
  zone.addEventListener('pointerdown', surPointerDown);
  zone.addEventListener('pointermove', surPointerMove);
  // Tout lâcher sur l'échiquier compte : le click qui suit est ignoré, même
  // si le toucher avait commencé pendant que le robot réfléchissait.
  zone.addEventListener('pointerup', () => { dernierPointeur = performance.now(); });
  // Sur window : un lâcher hors de l'échiquier termine le geste même sans capture.
  window.addEventListener('pointerup', surPointerUp);
  window.addEventListener('pointercancel', surPointerCancel);
  // Seule la perte de capture par l'échiquier lui-même annule le geste.
  zone.addEventListener('lostpointercapture', (e) => { if (e.target === zone) surPointerCancel(e); });
  // Clavier et lecteurs d'écran : un click qui ne suit aucun lâcher.
  zone.addEventListener('click', (e) => {
    if (geste || performance.now() - dernierPointeur < 700) return;
    const b = e.target instanceof Element ? e.target.closest('button.case') : null;
    if (b) toucher(Number(b.dataset.i));
  });
  document.addEventListener('keydown', surTouche);
  // Un toucher hors de l'échiquier désélectionne (sur l'échiquier, le cadre passe par toucher).
  document.addEventListener('pointerdown', (e) => {
    if (geste || !(e.target instanceof Element) || e.target.closest('#echiquier')) return;
    deselectionner();
  });

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
    if (code) { lancerAmi(code); return; }
    // Lien invalide : on retire le paramètre et on démarre comme sans lien,
    // reprise de la partie contre le robot comprise.
    history.replaceState(history.state, '', location.pathname);
  }

  const sauvee = lirePartie(lire(CLE_PARTIE));
  if (sauvee) { lancer(sauvee.niveau, sauvee.partie); return; }
  effacer(CLE_PARTIE);
  montrer('menu');
}

demarrer();
