// Échecs, mode ami — format réseau et rejeu. Pur, testé par test.remote.js
// et test.convergence.js.
//
// Salle v2 (lokolok/play/net/salle2.js) : `partage = { cadence }`, écrit à
// la création ; chaque joueur n'écrit que son propre journal d'actions, et le
// serveur date chaque entrée (`t`). Les deux journaux arrivent fusionnés,
// triés par (heure, siège, numéro) ; `replier` les rejoue depuis la partie 1
// et ignore toute action illégale à sa place, ou écrite par le mauvais siège.
// Deux clients qui ont les mêmes entrées ont donc le même état.
//
// L'état d'une partie (calculé, jamais écrit) :
//   { v: 3, manche: 1..9999, blancs: 1 | 2, cadence, actions: string[], heures: number[] }
// `heures[i]` est l'heure serveur de l'entrée qui a apporté `actions[i]` ;
// `null` tant que c'est mon entrée pas encore confirmée (« à dater »).
// La pendule se calcule à partir de ces heures : les deux clients obtiennent
// la même chose à la milliseconde.
//
// Les actions ; leur auteur (le camp) se déduit du rejeu et doit être celui
// du siège qui a écrit l'entrée :
//   e2e4, e7e8q      coup du camp au trait
//   rd               demande de reprise, par celui qui vient de jouer
//   ra, rr           reprise acceptée (le dernier coup est retiré) ou refusée,
//                    par le camp au trait
//   nd               proposition de nulle, par le camp au trait
//   na, nr           nulle acceptée ou refusée, par l'autre camp
//   xw, xb           abandon des blancs, des noirs
//   tw, tb           temps écoulé des blancs, des noirs, publié par le perdant
//   tw!, tb!         temps écoulé réclamé par l'adversaire : valable
//                    seulement si son heure serveur dépasse la limite du perdant
//   N<m>             lancer la partie m (la précédente doit être finie et
//                    datée) ; le second N, quand les deux la lancent, est ignoré
// La fin de partie n'est jamais transmise : chacun la recalcule (finDe).

import { depuisUCI } from './rules.js';
import { nouvellePartie, jouerCoup, etatFin, positionCourante } from './partie.js';
import { CADENCES, CREDIT_MS, peutMater, verdictPendule } from './pendule.js';

const MANCHE_MAX = 9999;
const MAX_ACTIONS = 2400;      // 2 000 coups au plus (partie.js), plus les demandes
const MAX_REPRISES = 3;        // par joueur et par partie
const ECART_NULLE = 10;        // coups du proposant entre deux propositions
const RE_COUP = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const RE_AUTRE = /^(ra|rd|rr|nd|na|nr|xw|xb|tw|tb|tw!|tb!)$/;
const RE_N = /^N([1-9]\d{0,3})$/;
const autre = (c) => (c === 'w' ? 'b' : 'w');

export function etatInitial(cadence = 0) {
  if (!CADENCES.includes(cadence)) throw new Error('Cadence inconnue');
  return { v: 3, manche: 1, blancs: 1, cadence, actions: [], heures: [] };
}

// `partage` de la salle → { cadence }, ou null s'il est illisible.
export function lirePartage(brut) {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  if (Object.keys(brut).length !== 1 || !CADENCES.includes(brut.cadence)) return null;
  return { cadence: brut.cadence };
}

const retirerDernier = (p) => ({
  ...p, positions: p.positions.slice(0, -1), coups: p.coups.slice(0, -1), sans: p.sans.slice(0, -1),
});

// ------------------------------------------------------------------ rejeu
// Le rejeu se fait action par action : `depart(cadence)`, puis `etape(s,
// action, heure)` (lève à la première action illégale), puis `conclure`.
// Chaque étape rend un nouvel objet : `replier` garde ses étapes et reprend
// de la dernière quand une entrée s'ajoute.
function depart(cadence) {
  return {
    C: cadence * 1000,
    p: nouvellePartie({ humain: 'w' }),
    reste: { w: cadence * 1000, b: cadence * 1000 },
    reprises: { w: 0, b: 0 },
    joues: { w: 0, b: 0 },
    nulle: { w: null, b: null },      // joues[camp] à sa dernière proposition
    demande: null,                    // { type: 'reprise' | 'nulle', camp }
    issue: null,                      // { type: 'abandon' | 'temps', camp } | { type: 'accord' }
    cle: 0,                           // 1 + indice de la dernière action qui a changé le trait
    debut: null,                      // heure serveur de cette action
    trace: [],                        // { action, auteur, trait, tourne, avant, tardive }
  };
}

function etape(s0, a, h) {
  if (s0.trace.length >= MAX_ACTIONS) throw new Error('Journal trop long');
  if (s0.issue || etatFin(s0.p)) throw new Error('Partie terminée');
  const s = {
    ...s0, reste: { ...s0.reste }, reprises: { ...s0.reprises }, joues: { ...s0.joues }, nulle: { ...s0.nulle },
  };
  const i = s0.trace.length;
  const trait = positionCourante(s.p).trait;
  // La pendule d'un joueur part à son premier coup : celle des blancs quand
  // les noirs ont joué le leur. Les deux premiers coups sont donc gratuits.
  const tourne = s.C > 0 && s.p.coups.length >= 2;
  const avant = { w: s.reste.w, b: s.reste.b };
  // L'action est datée après la limite du camp au trait (début du tour +
  // temps restant + crédit de latence) : son drapeau était déjà tombé.
  const tardive = tourne && h !== null && s.debut !== null && h - s.debut > s.reste[trait] + CREDIT_MS;
  const pAvant = s.p;
  // Le temps consommé par le camp au trait, à la fin de son tour.
  const temps = () => {
    if (tourne && h !== null && s.debut !== null) s.reste[trait] = Math.max(0, s.reste[trait] - Math.max(0, h - s.debut - CREDIT_MS));
  };
  const repriseEnCours = () => s.demande && s.demande.type === 'reprise' && s.demande.camp === autre(trait);
  let auteur;
  if (RE_COUP.test(a)) {
    auteur = trait;
    const coup = depuisUCI(positionCourante(s.p), a);
    if (!coup) throw new Error('Coup illégal');
    temps();
    s.p = jouerCoup(s.p, coup);
    s.joues[trait]++;
    // Un coup fait expirer la demande de l'autre ; la nulle proposée par
    // l'auteur du coup reste ouverte.
    if (s.demande && s.demande.camp !== trait) s.demande = null;
    s.cle = i + 1;
    s.debut = h;
  } else {
    switch (a) {
      case 'ra':
        auteur = trait;
        if (!repriseEnCours()) throw new Error('Aucune reprise demandée');
        temps();
        s.p = retirerDernier(s.p);
        s.demande = null;
        s.cle = i + 1;
        s.debut = h;
        break;
      case 'rd':
        auteur = autre(trait);
        if (s.demande || s.p.coups.length === 0 || s.reprises[auteur] >= MAX_REPRISES) throw new Error('Reprise impossible');
        s.reprises[auteur]++;
        s.demande = { type: 'reprise', camp: auteur };
        break;
      case 'rr':
        auteur = trait;
        if (!repriseEnCours()) throw new Error('Aucune reprise demandée');
        s.demande = null;
        break;
      case 'nd':
        auteur = trait;
        if (s.demande) throw new Error('Demande en cours');
        if (s.nulle[trait] !== null && s.joues[trait] - s.nulle[trait] < ECART_NULLE) throw new Error('Nulle trop tôt');
        s.nulle[trait] = s.joues[trait];
        s.demande = { type: 'nulle', camp: trait };
        break;
      case 'na':
      case 'nr':
        if (!s.demande || s.demande.type !== 'nulle') throw new Error('Aucune nulle proposée');
        auteur = autre(s.demande.camp);
        s.demande = null;
        if (a === 'na') s.issue = { type: 'accord' };
        break;
      case 'xw':
      case 'xb':
        auteur = a[1];
        s.demande = null;
        s.issue = { type: 'abandon', camp: auteur };
        break;
      case 'tw':
      case 'tb':
      case 'tw!':
      case 'tb!': {
        // `tX` : écrit par X lui-même, à son trait, pendule en marche.
        // `tX!` : réclamé par l'adversaire, valable seulement après la limite
        // de X (une heure encore inconnue, la mienne en cours, est admise).
        const x = a[1];
        auteur = a.length === 3 ? autre(x) : x;
        if (!tourne || x !== trait) throw new Error('Pendule à l’arrêt');
        if (a.length === 3 && h !== null && !tardive) throw new Error('Réclamation trop tôt');
        s.reste[x] = 0;
        s.demande = null;
        s.issue = { type: 'temps', camp: x };
        break;
      }
      default:
        throw new Error('Action inconnue');
    }
  }
  if (tardive) {
    // L'action reste dans le journal (son auteur compte, pour la
    // validation), mais la partie était déjà perdue au temps.
    s.p = pAvant;
    s.reste[trait] = 0;
    s.demande = null;
    s.issue = { type: 'temps', camp: trait };
  }
  s.trace = [...s0.trace, { action: a, auteur, trait, tourne, avant, tardive }];
  return s;
}

function conclure(s, cadence) {
  const trait = positionCourante(s.p).trait;
  const enCours = !s.issue && !etatFin(s.p);
  return {
    partie: s.p, cadence, reste: s.reste, demande: s.demande, reprises: s.reprises, joues: s.joues,
    nulle: s.nulle, issue: s.issue, cle: s.cle, trace: s.trace, trait, debut: s.debut,
    tourne: enCours && s.C > 0 && s.p.coups.length >= 2,
  };
}

// Le rejeu d'un état. Lève à la première action illégale. Rend la partie
// (positions, coups), les temps restants, la demande en cours, les compteurs,
// l'issue hors échiquier (abandon, temps, accord), `debut` (l'heure serveur
// du début du tour en cours, null si pas encore datée), et une trace par
// action : { action, auteur, trait, tourne, avant, tardive }.
const cacheAnalyses = new Map();
const TAILLE_CACHE = 8;
const cleAnalyse = (e) => `${e.manche}|${e.cadence}|${e.actions.join(' ')}|${e.heures.join(' ')}`;
function memoriser(cle, a) {
  if (cacheAnalyses.has(cle)) return;
  if (cacheAnalyses.size >= TAILLE_CACHE) cacheAnalyses.delete(cacheAnalyses.keys().next().value);
  cacheAnalyses.set(cle, a);
}
export function analyser(e) {
  const cle = cleAnalyse(e);
  const deja = cacheAnalyses.get(cle);
  if (deja) return deja;
  let s = depart(e.cadence);
  for (let i = 0; i < e.actions.length; i++) s = etape(s, e.actions[i], e.heures[i] === undefined ? null : e.heures[i]);
  const a = conclure(s, e.cadence);
  memoriser(cle, a);
  return a;
}

// La fin : abandon, temps (nulle si le gagnant ne peut pas mater), accord,
// sinon les fins de l'échiquier.
export function finDe(a) {
  const is = a.issue;
  if (is) {
    if (is.type === 'accord') return { type: 'accord', gagnant: null };
    if (is.type === 'abandon') return { type: 'abandon', gagnant: autre(is.camp), camp: is.camp };
    const g = autre(is.camp);
    return peutMater(positionCourante(a.partie), g)
      ? { type: 'temps', gagnant: g, camp: is.camp }
      : { type: 'temps-nulle', gagnant: null, camp: is.camp };
  }
  return etatFin(a.partie);
}

export const finie = (e) => finDe(analyser(e)) !== null;

// La clé du tour en cours : elle change quand le trait change (coup, reprise
// acceptée) ou à la partie suivante.
export const cleTour = (e, a = analyser(e)) => `${e.manche}:${a.cle}`;

export const campDuSiege = (e, siege) => (e.blancs === siege ? 'w' : 'b');

// ----------------------------------------------------------------- heures
// Mes heures pas encore datées : remplacées par `h` (une estimation, pour
// l'affichage ; ou l'heure du serveur simulé des tests).
export const dater = (e, h) => (e.heures.includes(null)
  ? { ...e, heures: e.heures.map((x) => (x === null ? h : x)) } : e);
export const enAttente = (e) => e.heures.includes(null);

// Que doit faire la pendule maintenant ? `maintenant` : l'heure serveur
// estimée (heureServeur) ; `estimee` : celle de mon écriture en cours ;
// `ecoule` : borne basse du temps écoulé depuis le début du tour, mesurée à
// l'horloge locale depuis la RÉCEPTION de l'heure de ce début (null si pas
// encore reçue). Rend 'drapeau' (ma limite serveur est dépassée : début +
// reste + crédit ; je publie ma défaite), 'reclamer' (le temps
// de l'ami est sûrement épuisé à l'heure serveur) ou null.
export function verdictTemps(e, camp, { maintenant, estimee = maintenant, ecoule = null }) {
  if (e.cadence === 0) return null;
  const a = analyser(e);
  if (!a.tourne) return null;
  if (a.trait !== camp && (a.debut === null || ecoule === null)) return null;   // pas encore d'ancre
  const vue = analyser(dater(e, estimee));
  const reste = vue.reste[vue.trait] - (maintenant - vue.debut);
  return verdictPendule({ trait: a.trait, moi: camp, reste, ecoule, resteTour: a.reste[a.trait], marge: CREDIT_MS });
}

// --------------------------------------------------------- actions locales
// L'action à écrire dans mon journal ; lève si elle est illégale ou
// n'appartient pas à `camp`. On n'agit que sur un état entièrement daté
// (main.js n'a qu'une action en vol à la fois).
function action(e, a, camp) {
  if (enAttente(e)) throw new Error('Action précédente pas encore datée');
  const apres = { ...e, actions: [...e.actions, a], heures: [...e.heures, null] };
  const r = analyser(apres);
  if (r.trace[r.trace.length - 1].auteur !== camp) throw new Error('Pas ton action');
  return a;
}
export const jouerAmi = (e, camp, uci) => action(e, uci, camp);
export function abandonAmi(e, camp) {
  if (camp !== 'w' && camp !== 'b') throw new Error('Camp invalide');
  return action(e, 'x' + camp, camp);
}
export const demanderReprise = (e, camp) => action(e, 'rd', camp);
export const repondreReprise = (e, camp, oui) => action(e, oui ? 'ra' : 'rr', camp);
export const proposerNulle = (e, camp) => action(e, 'nd', camp);
export const repondreNulle = (e, camp, oui) => action(e, oui ? 'na' : 'nr', camp);
// Mon temps est écoulé : je publie ma défaite.
export const tomberDrapeau = (e, camp) => action(e, 't' + camp, camp);
// Le temps de l'ami est épuisé (verdictTemps → 'reclamer') : je le réclame.
export const reclamerTemps = (e, camp) => action(e, `t${autre(camp)}!`, camp);

// La partie suivante : seulement une fois la fin datée par le serveur.
// Pas de partie après MANCHE_MAX. Les blancs changent de main.
export const peutContinuer = (e) => e.manche < MANCHE_MAX && finie(e) && !enAttente(e);
export function partieSuivante(e) {
  if (!finie(e)) throw new Error('Partie en cours');
  if (enAttente(e)) throw new Error('Fin pas encore confirmée');
  if (e.manche >= MANCHE_MAX) throw new Error('Dernière manche');
  return { v: 3, manche: e.manche + 1, blancs: 3 - e.blancs, cadence: e.cadence, actions: [], heures: [] };
}
export const actionSuivante = (e) => 'N' + (e.manche + 1);

// Ce que `camp` peut faire, pour les boutons.
export function possibles(a, camp) {
  const enCours = finDe(a) === null;
  const d = a.demande;
  const repondre = enCours && d && d.camp !== camp ? d.type : null;
  const nulleOk = a.nulle[camp] === null || a.joues[camp] - a.nulle[camp] >= ECART_NULLE;
  return {
    reprendre: enCours && !d && a.trait !== camp && a.partie.coups.length > 0 && a.reprises[camp] < MAX_REPRISES,
    nulle: enCours && !d && a.trait === camp && nulleOk,
    repondre,
  };
}

// ----------------------------------------------------------------- replier
// entrees : la fusion des deux journaux (salle.surJournal), { siege, n, a, t,
// provisoire }. partage : { cadence } (lirePartage). → { etat, analyse,
// ignorees, provisoire } : l'état de la partie en cours, son rejeu, le nombre
// d'entrées écartées, et si l'état compte une de mes entrées pas encore
// confirmée.
//
// Incrémental : les étapes de la dernière fusion sont gardées ; si les
// nouvelles entrées commencent par les mêmes (à l'identique, drapeau
// provisoire compris), le rejeu reprend après elles.
const memeEntree = (x, y) => !!y && x.siege === y.siege && x.n === y.n && x.a === y.a
  && x.t === y.t && x.provisoire === y.provisoire;
let dernierPli = null;   // { cadence, entrees, pas: [état après 0, 1, … entrées] }

function plier(pas, entree) {
  const { etat: e, s } = pas;
  const ignorer = { ...pas, ignorees: pas.ignorees + 1 };
  if (!entree || (entree.siege !== 1 && entree.siege !== 2) || typeof entree.a !== 'string') return ignorer;
  const a = entree.a;
  const provisoire = pas.provisoire || entree.provisoire === true;
  const n = RE_N.exec(a);
  if (n) {
    if (Number(n[1]) !== e.manche + 1 || !peutContinuer(e)) return ignorer;
    const suivant = partieSuivante(e);
    return { etat: suivant, s: depart(suivant.cadence), ignorees: pas.ignorees, provisoire };
  }
  if (!RE_COUP.test(a) && !RE_AUTRE.test(a)) return ignorer;
  const h = entree.provisoire === true || typeof entree.t !== 'number' ? null : entree.t;
  let s2;
  try { s2 = etape(s, a, h); } catch { return ignorer; }
  if (s2.trace[s2.trace.length - 1].auteur !== campDuSiege(e, entree.siege)) return ignorer;
  const etat = { ...e, actions: [...e.actions, a], heures: [...e.heures, h] };
  return { etat, s: s2, ignorees: pas.ignorees, provisoire };
}

export function replier(entrees, partage) {
  const liste = Array.isArray(entrees) ? entrees : [];
  const cadence = partage.cadence;
  let k = 0;
  if (dernierPli && dernierPli.cadence === cadence) {
    const ancien = dernierPli.entrees;
    while (k < ancien.length && k < liste.length && memeEntree(ancien[k], liste[k])) k++;
  }
  const pas = k > 0
    ? dernierPli.pas.slice(0, k + 1)
    : [{ etat: etatInitial(cadence), s: depart(cadence), ignorees: 0, provisoire: false }];
  for (let i = k; i < liste.length; i++) pas.push(plier(pas[pas.length - 1], liste[i]));
  dernierPli = { cadence, entrees: liste.map((x) => ({ ...x })), pas };
  const fin = pas[pas.length - 1];
  const analyse = conclure(fin.s, cadence);
  memoriser(cleAnalyse(fin.etat), analyse);
  return { etat: fin.etat, analyse, ignorees: fin.ignorees, provisoire: fin.provisoire };
}
