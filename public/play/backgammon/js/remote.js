// Backgammon, mode ami — format réseau et arbitre. Pur, testé par test.remote.js.
//
// Salle v2 (lokolok/play/net/salle2.js) : chaque joueur n'écrit que son
// propre journal, s<siège>/j/<n> = { a, t }, et le serveur date chaque entrée.
// Les règles RTDB garantissent qu'une entrée s'écrit une fois, par son siège,
// à l'heure du serveur, et ne s'efface pas. Les deux journaux arrivent ici
// fusionnés, triés par (heure, siège, numéro) ; `replier` les rejoue depuis
// le début de la salle, dés compris. Une entrée illégale à sa place (format,
// règle, mauvais auteur, réclamation trop tôt) est ignorée : deux clients qui
// ont les mêmes entrées ont le même état, il n'y a rien à réconcilier.
//
// Siège 1 (l'hôte) joue Blanc ('b'), siège 2 (l'invité) Noir ('n').
// Partage (écrit à la création, immuable) : { longueur, videau, engage } —
// `engage` est l'engagement SHA-256 du premier secret de l'hôte.
//
// Une entrée `a` est :
//   - une action de match, en JSON : { a, s?, e?, c?, t? } (table : voir etape) ;
//   - N<m> : commencer le match m (le match m−1 est fini, sans réclamation),
//     par l'un ou l'autre ; le second N est ignoré.
//
// Dés (protocole v2) : le lanceur publie une contribution `c` en clair ; c'est
// l'autre joueur qui révèle ensuite (`'V'`) le secret `s` qu'il avait engagé
// (`engage`, SHA-256) avant que `c` n'existe. Le lanceur ne connaît donc pas
// ses dés quand il choisit de lancer ou de doubler, et le révélateur ne peut
// plus changer son secret. Chaque étape doit venir du bon siège.
//
// Un ami qui ne joue plus : celui qui attend peut réclamer la victoire ('F')
// quand l'heure serveur de sa réclamation dépasse de 3 min celle de la
// dernière action acceptée. Une action de l'absent datée avant la
// réclamation passe d'abord (la réclamation devient alors trop tôt) ; une
// action datée après arrive dans une salle finie et ne compte pas.

import { adversaire } from './rules.js';
import {
  nouveauMatch, ouverture, lancer, jouerTour, doubler, accepter, refuser, mancheSuivante, abandon,
} from './match.js';
import { HEX32, HEX64, engagement, desEquitables } from './hasard.js';

export const MAX_ACTIONS = 4000;      // par match
export const MATCH_MAX = 9999;
export const MAX_ENTREE = 400;        // longueur d'une entrée de journal (règles RTDB)
const GARDES = 4; // secrets retenus dans la clé

export const DELAI_ABSENCE_MS = 3 * 60 * 1000;

// Champs permis (et exigés) pour chaque action ; aucun autre n'est accepté.
const CHAMPS = {
  I: ['e', 'c'], O: ['c'], L: ['c'], V: ['s', 'e'],
  D: [], A: [], R: [], J: ['t'], S: [], F: [],
};
const RE_MATCH = /^N([1-9]\d{0,3})$/;

const objet = (v) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};
const entier = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const absent = (v) => v === undefined || v === null;
const hex32 = (v) => typeof v === 'string' && HEX32.test(v);
const hex64 = (v) => typeof v === 'string' && HEX64.test(v);

function geler(x) {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) geler(v);
  }
  return x;
}

// ---------- Format ----------

function lirePas(p) {
  if (!objet(p) || !cles(p, ['depuis', 'vers', 'de'])) return null;
  const { depuis, vers, de } = p;
  if (depuis !== 'barre' && !entier(depuis, 1, 24)) return null;
  if (vers !== 'sortie' && !entier(vers, 1, 24)) return null;
  if (!entier(de, 1, 6)) return null;
  return { depuis, vers, de };
}

// Les clés de `o` sont exactement `exigees` et `permises` (les premières sont obligatoires).
function cles(o, exigees, permises = []) {
  const k = Object.keys(o);
  return exigees.every((x) => k.includes(x)) && k.every((x) => exigees.includes(x) || permises.includes(x));
}

const FORMATS = { s: hex32, e: hex64, c: hex32 };

// Copie stricte d'une action : exactement les champs de son type, bien formés.
export function lireAction(brut) {
  if (!objet(brut) || typeof brut.a !== 'string' || !Object.hasOwn(CHAMPS, brut.a)) return null;
  const champs = CHAMPS[brut.a];
  if (!cles(brut, ['a'], champs)) return null;
  const r = { a: brut.a };
  for (const k of ['s', 'e', 'c']) {
    if (absent(brut[k])) {
      if (champs.includes(k)) return null;
      continue;
    }
    if (!champs.includes(k) || !FORMATS[k](brut[k])) return null;
    r[k] = brut[k];
  }
  if (!absent(brut.t)) {
    if (r.a !== 'J' || !Array.isArray(brut.t) || brut.t.length > 4) return null;
    const t = brut.t.map(lirePas);
    if (t.includes(null)) return null;
    r.t = t;
  } else if (r.a === 'J') r.t = []; // tour vide (« ne peut pas jouer »)
  return r;
}

// Action de match → texte d'une entrée de journal. Lève si l'action est mal formée.
export function encoderAction(action) {
  const act = lireAction(action);
  if (!act) throw new Error('Action mal formée');
  const texte = JSON.stringify(act);
  if (texte.length > MAX_ENTREE) throw new Error('Action trop longue');
  return texte;
}

// Texte d'une entrée → action de match, ou null.
export function decoderAction(texte) {
  if (typeof texte !== 'string' || texte.length > MAX_ENTREE || texte[0] !== '{') return null;
  let brut;
  try { brut = JSON.parse(texte); } catch { return null; }
  return lireAction(brut);
}

export const actionMatch = (m) => 'N' + m;

// Le partage de la salle : { longueur, videau, engage }, ou null.
export function lirePartage(brut) {
  if (!objet(brut) || !cles(brut, ['longueur', 'videau', 'engage'])) return null;
  if (![1, 3, 5].includes(brut.longueur)) return null;
  if (typeof brut.videau !== 'boolean' || (brut.videau && brut.longueur === 1)) return null;
  if (!hex64(brut.engage)) return null;
  return { longueur: brut.longueur, videau: brut.videau, engage: brut.engage };
}

export function partageInitial({ longueur, videau }, engageHote) {
  const p = lirePartage({ longueur, videau: longueur > 1 && Boolean(videau), engage: engageHote });
  if (!p) throw new Error('Match invalide');
  return p;
}

// ---------- Arbitre ----------

const exigerPhase = (p, phase) => {
  if (p.phase !== phase) throw new Error(`Phase « ${p.phase} » : « ${phase} » attendue`);
};

// Applique l'action `act` (d'index `i` dans le match) à `st` = { partie,
// engage, attente }, en place, et rend son acteur. Lève si l'action est illégale.
//
//  a    exigé                                   acteur                 champs
//  'I'  match 1, i = 0, engage.n nul            'n'                    e, c
//  'O'  ouverture, sans attente, après 'I'      'n'                    c
//  'L'  lancer, sans attente                    le trait               c
//  'V'  une attente                             adversaire(lanceur)    s, e
//  'D'  lancer, sans attente, peutDoubler       le trait               —
//  'A' 'R' double                               adversaire(trait)      —
//  'J'  deplacer                                le trait               t
//  'S'  fin-manche                              l'un ou l'autre (null) —
//  'F'  partie en cours, i > 0                  l'adversaire de celui qui
//       doit agir : victoire par abandon (le délai se juge dans `appliquer`)
function etape(st, act, i, match) {
  const p = st.partie;
  const { a } = act;
  const debut = match === 1 && i === 0;
  if (a === 'F' && i === 0) throw new Error('Rien à réclamer au départ');
  if (abandonne(p)) throw new Error('Salle terminée par abandon');
  if ((a === 'I') !== debut) throw new Error(debut ? '« I » attendu' : '« I » hors de place');
  if (a !== 'F' && (a === 'V') !== (st.attente !== null)) throw new Error(a === 'V' ? 'Aucun lancer en attente' : 'Révélation attendue');
  switch (a) {
    case 'I':
      if (st.engage.n !== null) throw new Error('Noir déjà engagé');
      st.engage.n = act.e;
      st.attente = { lanceur: 'n', c: act.c, index: i, ouverture: true };
      return 'n';
    case 'O':
      exigerPhase(p, 'ouverture');
      if (st.engage.n === null) throw new Error('« I » attendu');
      st.attente = { lanceur: 'n', c: act.c, index: i, ouverture: true };
      return 'n';
    case 'L':
      exigerPhase(p, 'lancer');
      st.attente = { lanceur: p.trait, c: act.c, index: i, ouverture: false };
      return p.trait;
    case 'V': {
      const { lanceur, c, index, ouverture: ouv } = st.attente;
      const revelateur = adversaire(lanceur);
      if (engagement(act.s) !== st.engage[revelateur]) throw new Error('Secret non engagé');
      const [d1, d2] = desEquitables({
        secret: act.s, apport: c, match, manche: p.manche, numero: index, ouverture: ouv,
      });
      st.partie = ouv ? ouverture(p, d1, d2) : lancer(p, d1, d2);
      st.engage[revelateur] = act.e;
      st.attente = null;
      return revelateur;
    }
    case 'D':
      st.partie = doubler(p);
      return p.trait;
    case 'A':
    case 'R':
      exigerPhase(p, 'double');
      st.partie = a === 'A' ? accepter(p) : refuser(p);
      return adversaire(p.trait);
    case 'J':
      exigerPhase(p, 'deplacer');
      st.partie = jouerTour(p, act.t);
      return p.trait;
    case 'S':
      st.partie = mancheSuivante(p);
      return null;
    case 'F': {
      // Réclamation : l'acteur est celui qui attend, l'absent celui qui devait agir.
      const loin = attendu(st);
      if (loin !== 'b' && loin !== 'n') throw new Error('Personne à attendre');
      const gagnant = adversaire(loin);
      st.partie = abandon(p, gagnant);
      st.attente = null;
      return gagnant;
    }
    default:
      throw new Error(`Action inconnue : ${a}`);
  }
}

// Jeu = { match, longueur, videau, partie, registre: { engage: { b, n } },
//         attente, nb, tDerniere } — gelé. `nb` : actions acceptées dans le
// match ; `tDerniere` : heure serveur de la dernière (null au départ).
export function debutSalle(partage) {
  const p = lirePartage(partage);
  if (!p) return null;
  return geler({
    match: 1, longueur: p.longueur, videau: p.videau,
    partie: nouveauMatch({ longueur: p.longueur, videau: p.videau }),
    registre: { engage: { b: p.engage, n: null } },
    attente: null, nb: 0, tDerniere: null,
  });
}

const couleurDuSiege = (s) => (s === 1 ? 'b' : s === 2 ? 'n' : null);

// Une entrée { siege, a, t } appliquée au Jeu → { jeu, acteur, act } ou null
// si elle est illégale à cette place (format, règle, auteur, délai).
export function appliquer(jeu, entree) {
  const couleur = couleurDuSiege(entree && entree.siege);
  if (!jeu || !couleur || typeof entree.a !== 'string') return null;
  const t = typeof entree.t === 'number' && Number.isFinite(entree.t) ? entree.t : null;
  const m = RE_MATCH.exec(entree.a);
  if (m) {
    if (Number(m[1]) !== jeu.match + 1 || jeu.partie.phase !== 'fin-match' || abandonne(jeu.partie)) return null;
    return {
      jeu: geler({
        match: jeu.match + 1, longueur: jeu.longueur, videau: jeu.videau,
        partie: nouveauMatch({ longueur: jeu.longueur, videau: jeu.videau }),
        registre: { engage: { ...jeu.registre.engage } },
        attente: null, nb: 0, tDerniere: t,
      }),
      acteur: null,
      act: { a: 'N', m: jeu.match + 1 },
    };
  }
  const act = decoderAction(entree.a);
  if (!act || jeu.nb >= MAX_ACTIONS) return null;
  if (act.a === 'F' && (t === null || jeu.tDerniere === null || t - jeu.tDerniere < DELAI_ABSENCE_MS)) return null;
  const st = {
    partie: jeu.partie,
    engage: { ...jeu.registre.engage },
    attente: jeu.attente ? { ...jeu.attente } : null,
  };
  let acteur;
  try {
    acteur = etape(st, act, jeu.nb, jeu.match);
  } catch {
    return null;
  }
  if (acteur !== null && acteur !== couleur) return null;
  return {
    jeu: geler({
      match: jeu.match, longueur: jeu.longueur, videau: jeu.videau,
      partie: st.partie, registre: { engage: st.engage }, attente: st.attente,
      nb: jeu.nb + 1, tDerniere: t,
    }),
    acteur,
    act,
  };
}

// Mémo du dernier pli : un journal qui prolonge le précédent (même début,
// entrée pour entrée) n'est rejoué qu'à partir de la première différence.
let memo = null;
const cleEntree = (e) => `${e.siege}|${e.n}|${e.t}|${e.provisoire ? 1 : 0}|${e.a}`;

// entrees : la fusion des deux journaux (salle.surJournal). Rend
//   { jeu, pas, ignorees, provisoire } :
//   jeu        le Jeu courant (null si le partage est illisible) ;
//   pas        les actions acceptées du match courant, dans l'ordre :
//              [{ act, acteur, avant, apres, provisoire }] (avant/apres : Jeux) ;
//   ignorees   le nombre d'entrées écartées ;
//   provisoire une de mes entrées pas encore confirmée compte dans le Jeu.
export function replier(entrees, partage) {
  const liste = Array.isArray(entrees) ? entrees : [];
  const depart = debutSalle(partage);
  if (!depart) return { jeu: null, pas: [], ignorees: liste.length, provisoire: false };
  const clePartage = JSON.stringify(lirePartage(partage));
  let k = 0;
  let suite = [];      // suite[i] = { cle, jeu, pas } après l'entrée i (pas null : ignorée)
  if (memo && memo.partage === clePartage) {
    while (k < liste.length && k < memo.suite.length && memo.suite[k].cle === cleEntree(liste[k])) k++;
    suite = memo.suite.slice(0, k);
  }
  let jeu = k > 0 ? suite[k - 1].jeu : depart;
  for (let i = k; i < liste.length; i++) {
    const e = liste[i];
    const r = appliquer(jeu, e);
    let pas = null;
    if (r) {
      pas = { act: r.act, acteur: r.acteur, avant: jeu, apres: r.jeu, provisoire: !!e.provisoire };
      jeu = r.jeu;
    }
    suite.push({ cle: cleEntree(e), jeu, pas });
  }
  memo = { partage: clePartage, suite };
  let ignorees = 0;
  let provisoire = false;
  for (const s of suite) {
    if (!s.pas) ignorees++;
    else if (s.pas.provisoire) provisoire = true;
  }
  const pas = [];
  for (let i = suite.length - 1; i >= 0; i--) {
    const p = suite[i].pas;
    if (!p) continue;
    if (p.act.a === 'N') break;
    pas.push(p);
  }
  pas.reverse();
  return { jeu, pas, ignorees, provisoire };
}

export function acteurAttendu(jeu) {
  return attendu({ partie: jeu.partie, engage: jeu.registre.engage, attente: jeu.attente });
}

function attendu({ partie: p, engage, attente }) {
  if (attente) return adversaire(attente.lanceur);
  if (engage.n === null) return 'n'; // 'I' attendu
  switch (p.phase) {
    case 'ouverture': return 'n';
    case 'lancer':
    case 'deplacer': return p.trait;
    case 'double': return adversaire(p.trait);
    default: return 'deux';
  }
}

// La réclamation 'F' met fin à la salle : rien ne la suit, ni manche ni match.
export const abandonne = (p) => Boolean(p && p.resultat && p.resultat.abandon === true);

// Puis-je (`moi`) réclamer la victoire ? `maintenant` : heure serveur
// estimée (salle.heureServeur()) ; l'arbitre rejuge avec l'heure de l'entrée.
export function peutReclamer(jeu, moi, maintenant) {
  if (!jeu || !jeu.partie || (moi !== 'b' && moi !== 'n')) return false;
  if (jeu.nb === 0 || jeu.tDerniere === null || !Number.isFinite(maintenant)) return false;
  if (abandonne(jeu.partie) || ['fin-manche', 'fin-match'].includes(jeu.partie.phase)) return false;
  if (acteurAttendu(jeu) !== adversaire(moi)) return false;
  return maintenant - jeu.tDerniere >= DELAI_ABSENCE_MS;
}

// ---------- Miroir (plateau retourné de l'invité) ----------

const autre = (j) => (j === 'b' || j === 'n' ? adversaire(j) : j);
const zero = (v) => (v === 0 ? 0 : v); // évite -0

export function miroirPartie(p) {
  const pos = p.position;
  return {
    ...p,
    score: { b: p.score.n, n: p.score.b },
    cube: { valeur: p.cube.valeur, proprietaire: autre(p.cube.proprietaire) },
    position: {
      points: pos.points.map((_, i) => zero(-pos.points[23 - i])),
      barre: { b: pos.barre.n, n: pos.barre.b },
      sortis: { b: pos.sortis.n, n: pos.sortis.b },
    },
    trait: autre(p.trait),
    des: p.des ? p.des.slice() : null,
    resultat: p.resultat ? { ...p.resultat, gagnant: autre(p.resultat.gagnant) } : null,
  };
}

const miroirPoint = (x) => (typeof x === 'number' ? 25 - x : x);

export const miroirTour = (tour) =>
  tour.map((pas) => ({ depuis: miroirPoint(pas.depuis), vers: miroirPoint(pas.vers), de: pas.de }));

// ---------- Clé des dés ----------
// Cle = { secrets: { <engage>: <secret> } }, les 4 derniers. Les anciennes
// clés rangeaient aussi `etat`, `c` et `activite` : seuls les secrets en sont relus.

const garder = (entrees) => ({ secrets: Object.fromEntries(entrees.slice(-GARDES)) });

export function lireCle(texte) {
  let brut;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { secrets: {} };
  }
  if (!objet(brut) || !objet(brut.secrets) || !cles(brut, ['secrets'], ['etat', 'c', 'activite'])) return { secrets: {} };
  return garder(Object.entries(brut.secrets).filter(([e, s]) => hex64(e) && hex32(s) && engagement(s) === e));
}

export const ecrireCle = (cle) => JSON.stringify({ secrets: cle.secrets });

export function retenirSecret(cle, secret) {
  if (!hex32(secret)) throw new Error('Secret invalide');
  const e = engagement(secret);
  return garder([...Object.entries(cle.secrets).filter(([k]) => k !== e), [e, secret]]);
}

export function elaguerCle(cle, engages) {
  const liste = Array.isArray(engages) ? engages : [];
  return garder(Object.entries(cle.secrets).filter(([e]) => liste.includes(e)));
}

export function secretPour(cle, engage) {
  if (!cle || !objet(cle.secrets) || typeof engage !== 'string') return null;
  return Object.hasOwn(cle.secrets, engage) ? cle.secrets[engage] : null;
}
