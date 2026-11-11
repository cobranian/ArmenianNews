// Salles v2 « par siège » (spec 2026-10-30, étape 2) — chargé par import()
// dynamique depuis les jeux migrés (URL absolue /play/net/salle2.js).
// salle.js reste en place, inchangé dans son interface : les jeux pas encore
// migrés et les onglets anciens continuent de s'en servir.
//
// Une salle v2 :
//   salles/<jeu>/<code>/
//     v: 2, jeu, creeLe          écrits à la création, immuables
//     siege1                     uid de l'hôte (création)
//     siege2                     uid de l'invité, écrit une seule fois, par lui
//     partage: { … }             création seulement (niveau, graine…)
//     joueurs/<uid>              { siege, pseudo, enLigne }, écrit par <uid> seul
//     s1/etat, s2/etat           le nœud de chaque siège, écrit par lui seul :
//        { manche, statut, prog, pret?, fin?, liste? }
// Les règles (database.rules.json) garantissent, pour s<S>/etat :
//   - seul le siège S l'écrit, et personne ne l'efface ;
//   - manche ne fait que +1 ;
//   - pret et fin valent l'heure du serveur à leur écriture (HEURE), et ne
//     changent plus dans la manche ; fin exige pret ;
//   - une fois fin posée, statut, prog et liste ne changent plus dans la manche.
// Et pour les journaux s<S>/j/<n> = { a, t } (jeux au tour par tour) : une
// entrée s'écrit une fois, par S seul, avec t = heure du serveur, et ne
// s'efface pas. La fusion des deux journaux est dans journal.js.
// Ce module ne connaît aucune règle de jeu : il transporte ces nœuds.

import {
  ref, get, set, update, onValue, onDisconnect, runTransaction,
  goOffline, goOnline,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js';
import { connecter, HEURE, heureServeur, genererQR, refusParRegles } from './salle.js';
import { message } from './messages.js';
import { genererCode, codeValide, estPerimee, urlSalle } from './protocole.js';
import { lireJournal, fusionner } from './journal.js';

export { connecter, HEURE, heureServeur, genererQR };

const chemin = (jeu, code) => 'salles/' + jeu + '/' + code;

function erreur(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// Transaction sur la salle, qui n'aboutit que si elle est absente ou
// périmée (les règles refusent tout le reste). `mien` : le premier nœud du
// siège 1 (HEURE accepté dedans, ex. pret).
export async function creerSalle(jeu, { partage = null, mien = null } = {}) {
  const ctx = await connecter();
  const { db, uid } = ctx;
  for (let essai = 0; essai < 5; essai++) {
    const code = genererCode();
    let resultat;
    try {
      resultat = await runTransaction(ref(db, chemin(jeu, code)), (salle) => {
        if (salle !== null && !estPerimee(salle.creeLe, Date.now())) return; // occupée
        const neuve = {
          v: 2, jeu, creeLe: HEURE, siege1: uid,
          joueurs: { [uid]: { siege: 1, pseudo: '', enLigne: true } },
        };
        if (partage) neuve.partage = partage;
        if (mien) neuve.s1 = { etat: mien };
        return neuve;
      });
    } catch (e) {
      if (refusParRegles(e)) continue;
      throw e;
    }
    if (resultat.committed) return ouvrir(jeu, code, 1, ctx, partage);
  }
  throw new Error(message('creation'));
}

// err.code : 'invalide' | 'absente' | 'pleine' | 'ancienne' (salle créée par
// un jeu d'avant la migration : l'appelant propose d'en créer une nouvelle).
export async function rejoindreSalle(jeu, code) {
  if (!codeValide(code)) throw erreur('invalide', message('invalide'));
  const ctx = await connecter();
  const { db, uid } = ctx;
  const snap = await get(ref(db, chemin(jeu, code)));
  const salle = snap.val();
  if (!salle || typeof salle !== 'object' || estPerimee(salle.creeLe, Date.now())) {
    throw erreur('absente', message('absente'));
  }
  if (salle.v !== 2) {
    throw erreur('ancienne', message('ancienne'));
  }
  const partage = salle.partage && typeof salle.partage === 'object' ? salle.partage : null;
  if (salle.siege1 === uid) return ouvrir(jeu, code, 1, ctx, partage);   // reprise
  if (salle.siege2 === uid) return ouvrir(jeu, code, 2, ctx, partage);   // reprise
  if (salle.siege2) throw erreur('pleine', message('pleine'));
  try {
    // Un seul envoi : les règles n'admettent siege2 qu'une fois, si bien que
    // de deux invités simultanés, un seul entre ; l'autre est refusé en bloc.
    await update(ref(db, chemin(jeu, code)), {
      siege2: uid,
      ['joueurs/' + uid]: { siege: 2, pseudo: '', enLigne: true },
    });
  } catch (e) {
    if (refusParRegles(e)) throw erreur('pleine', message('pleine'));
    throw e;
  }
  return ouvrir(jeu, code, 2, ctx, partage);
}

// Un objet ordinaire, ou null.
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

function ouvrir(jeu, code, siege, ctx, partage) {
  const { db, uid } = ctx;
  const base = chemin(jeu, code);
  const autre = siege === 1 ? 2 : 1;
  const desabonnements = [];
  const url = urlSalle(location.origin, jeu, code);
  // Le code dans l'adresse : un rechargement repasse par le lien et reprend
  // le même siège (rejoindreSalle reconnaît l'uid). fermer() le retire.
  if (location.pathname === '/play/' + jeu + '/') history.replaceState(history.state, '', url);

  // Présence (même motif que salle.js) : à chaque (re)connexion, réarmer
  // onDisconnect puis se déclarer en ligne ; quitter la page coupe tout de
  // suite, un retour par « précédent » reconnecte.
  const moi = ref(db, base + '/joueurs/' + uid);
  const enLigne = ref(db, base + '/joueurs/' + uid + '/enLigne');
  desabonnements.push(onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() !== true) return;
    onDisconnect(enLigne).set(false).then(() => update(moi, { enLigne: true })).catch(() => {});
  }));
  const cacher = () => goOffline(db);
  const montrer = (e) => { if (e.persisted) goOnline(db); };
  addEventListener('pagehide', cacher);
  addEventListener('pageshow', montrer);
  desabonnements.push(() => {
    removeEventListener('pagehide', cacher);
    removeEventListener('pageshow', montrer);
  });

  function abonner(sousChemin, cb) {
    const off = onValue(ref(db, base + '/' + sousChemin), (snap) => cb(snap.val()));
    desabonnements.push(off);
    return off;
  }

  // Journaux : abonnés à la première demande. `bruts` garde la dernière
  // valeur reçue de chacun ; `provisoires`, les n de mes entrées que le
  // serveur n'a pas encore confirmées (heure encore estimée).
  const bruts = { 1: null, 2: null };
  const provisoires = new Set();
  const ecouteurs = new Set();
  let journauxPrets = null;
  function diffuser() {
    const entrees = fusionner(bruts[1], bruts[2], { monSiege: siege, provisoires });
    for (const cb of ecouteurs) cb(entrees);
  }
  function suivreJournaux() {
    if (!journauxPrets) {
      journauxPrets = Promise.all([1, 2].map((s) => new Promise((resolu) => {
        abonner('s' + s + '/j', (v) => { bruts[s] = v; resolu(); diffuser(); });
      })));
    }
    return journauxPrets;
  }

  return {
    code, uid, siege, jeu, url,
    partage: objet(partage),
    heureServeur,
    // Mon nœud s<siege>/etat. `remplacer` : set (nouvelle manche : les champs
    // de la manche d'avant disparaissent) ; sinon update (progression, fin).
    // HEURE accepté pour pret et fin. La promesse se résout quand le serveur
    // a accepté l'écriture, et échoue s'il la refuse.
    ecrireMien(valeurs, { remplacer = false } = {}) {
      const cible = ref(db, base + '/s' + siege + '/etat');
      return remplacer ? set(cible, valeurs) : update(cible, valeurs);
    },
    // Ajoute une action à mon journal, à la suite de mes entrées connues.
    // Se résout avec { n } quand le serveur l'a acceptée. Si le numéro est
    // déjà pris (mon autre onglet a écrit entre-temps), on réessaie au
    // suivant ; tout autre refus fait échouer la promesse.
    async ajouter(action) {
      await suivreJournaux();
      for (let essai = 0; essai < 3; essai++) {
        const n = lireJournal(bruts[siege], siege).length;
        provisoires.add(n);
        try {
          await set(ref(db, base + '/s' + siege + '/j/' + n), { a: String(action), t: HEURE });
          provisoires.delete(n);
          diffuser();
          return { n };
        } catch (e) {
          provisoires.delete(n);
          diffuser();
          if (!refusParRegles(e) || essai === 2) throw e;
          await get(ref(db, base + '/s' + siege + '/j'));   // relire avant de réessayer
        }
      }
      throw new Error(message('action'));
    },
    // cb(entrees) à chaque changement des journaux : [{ siege, n, a, t,
    // provisoire }] triées par (t, siège, n), chaque journal coupé à son
    // premier trou. Rend la fonction de désabonnement.
    surJournal(cb) {
      ecouteurs.add(cb);
      suivreJournaux().then(() => { if (ecouteurs.has(cb)) cb(fusionner(bruts[1], bruts[2], { monSiege: siege, provisoires })); });
      return () => ecouteurs.delete(cb);
    },
    // Mon nœud tel que la base le voit (mes écritures en attente comprises,
    // avec une heure ESTIMÉE pour HEURE tant que le serveur n'a pas répondu).
    surMien(cb) { return abonner('s' + siege + '/etat', (v) => cb(objet(v))); },
    surAmi(cb) { return abonner('s' + autre + '/etat', (v) => cb(objet(v))); },
    // { moi, ami } : { siege, pseudo, enLigne } ou null (ami pas encore assis).
    surJoueurs(cb) {
      return abonner('joueurs', (v) => {
        const j = objet(v) || {};
        let ami = null;
        for (const k of Object.keys(j)) if (k !== uid && objet(j[k])) ami = j[k];
        cb({ moi: objet(j[uid]), ami });
      });
    },
    poserPseudo(pseudo) {
      return update(moi, { pseudo: String(pseudo || '').slice(0, 20) });
    },
    fermer() {
      for (const off of desabonnements.splice(0)) off();
      if (/[?&]room=/.test(location.search)) history.replaceState(history.state, '', location.pathname);
    },
  };
}

