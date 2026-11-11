// Client des salles multijoueur — la SEULE porte des jeux vers Firebase.
// Chargé par import() dynamique depuis les jeux (URL absolue /play/net/
// salle.js), donc uniquement quand un mode réseau est demandé : une partie
// solo ou contre le robot ne télécharge jamais le SDK.
//
// Modèle (spec 2026-09-20) : le joueur au trait est autoritaire ; ce module
// ne connaît AUCUNE règle de jeu, il transporte des objets opaques.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  getAuth, signInAnonymously, connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  getDatabase, ref, update, onValue, onDisconnect, serverTimestamp, runTransaction,
  goOffline, goOnline, connectDatabaseEmulator,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js';
import { FIREBASE_CONFIG } from './config.js';
import { message } from './messages.js';
// Aucun nouvel import de protocole.js ici : un onglet ancien qui a déjà
// chargé l'ancien protocole.js puis importe ce salle.js recevrait l'ancien
// module (même URL), et un nom manquant ferait échouer tout l'import.
import { genererCode, codeValide, estPerimee, urlSalle } from './protocole.js';

let contexte = null;

// Recette locale contre les émulateurs Firebase : seulement sur localhost ET
// avec ?emu=1 dans l'adresse. Jamais vrai en ligne (lokolok.com).
export function emulateurDemande(hostname, search) {
  return hostname === 'localhost' && new URLSearchParams(search || '').get('emu') === '1';
}

// Heure serveur (spec 2026-10-30, étape 1). HEURE se place dans une écriture
// ({ heures: { 3: HEURE } }) : le serveur la remplace par son heure, et les
// règles exigent « === now » pour les champs d'heure. heureServeur() est
// l'heure locale corrigée du décalage mesuré par Firebase
// (.info/serverTimeOffset, suivi à chaque connexion) : POUR L'AFFICHAGE
// SEULEMENT — un verdict ne s'appuie que sur des heures écrites par le serveur.
export const HEURE = serverTimestamp();
let decalage = 0;
export function heureServeur() { return Date.now() + decalage; }

export function connecter() {
  if (!contexte) {
    if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.databaseURL) {
      return Promise.reject(new Error('Multijoueur pas encore configuré — voir assets/net/config.js '
        + 'et la checklist « Realtime Database » du README du portail.'));
    }
    contexte = (async () => {
      const app = initializeApp(FIREBASE_CONFIG);
      const auth = getAuth(app);
      const db = getDatabase(app);
      // Recette locale : http://localhost:…/?emu=1 parle aux émulateurs
      // (auth 9099, database 9000), jamais au vrai projet. Inactif en ligne.
      if (emulateurDemande(location.hostname, location.search)) {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        connectDatabaseEmulator(db, '127.0.0.1', 9000);
      }
      const cred = await signInAnonymously(auth);
      onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
        const v = snap.val();
        decalage = typeof v === 'number' && Number.isFinite(v) ? v : 0;
      });
      return { app, db, uid: cred.user.uid };
    })();
    // Un échec (réseau, auth) ne doit pas empoisonner la mémo : le prochain
    // appel retentera une connexion propre.
    contexte.catch(() => { contexte = null; });
  }
  return contexte;
}

function chemin(jeu, code) { return 'salles/' + jeu + '/' + code; }

// Refus des règles RTDB (permission_denied) : le SDK rejette la transaction
// avec ce mot dans le message (et parfois dans `code`).
export function refusParRegles(err) {
  return /permission[_ ]denied/i.test(String((err && (err.code || err.message)) || err));
}

// Cinq essais de code : avec 32^6 combinaisons et des salles éphémères, le
// premier passe quasi toujours ; la boucle n'existe que pour l'honnêteté.
// Un code que les règles refusent (salle gelée sans creeLe, ancien siège 2
// qui retombe sur son code…) passe au suivant au lieu d'échouer.
export async function creerSalle(jeu, donneesInitiales) {
  const ctx = await connecter();
  const { db, uid } = ctx;
  for (let essai = 0; essai < 5; essai++) {
    const code = genererCode();
    let resultat;
    try {
      resultat = await runTransaction(ref(db, chemin(jeu, code)), (salle) => {
        if (salle !== null && !estPerimee(salle.creeLe, Date.now())) return; // occupée
        return {
          jeu,
          creeLe: serverTimestamp(),
          manche: 1,
          joueurs: { [uid]: { siege: 1, pseudo: '', enLigne: true } },
          ...(donneesInitiales || {}),
        };
      });
    } catch (e) {
      if (refusParRegles(e)) continue;
      throw e;
    }
    if (resultat.committed) return ouvrir(jeu, code, 1, ctx);
  }
  throw new Error(message('creation'));
}

export async function rejoindreSalle(jeu, code) {
  if (!codeValide(code)) throw new Error(message('invalide'));
  const ctx = await connecter();
  const { db, uid } = ctx;
  const resultat = await runTransaction(ref(db, chemin(jeu, code)), (salle) => {
    // Premier passage : le cache local est vide (null) même si la salle existe.
    // Rendre undefined ANNULERAIT la transaction sans consulter le serveur ;
    // rendre null laisse le serveur répondre, puis Firebase relance avec la
    // vraie salle. Salle réellement absente : commit de null, snapshot vide.
    if (salle === null) return null;
    const joueurs = salle.joueurs || {};
    if (joueurs[uid]) return salle;                       // déjà assis : reprise
    // Siège 2 réservé par son uid : les règles RTDB ne savent pas compter
    // les enfants, elles vérifient seulement que siege2 était libre.
    if (salle.siege2 || Object.keys(joueurs).length >= 2) return; // pleine
    joueurs[uid] = { siege: 2, pseudo: '', enLigne: true };
    salle.joueurs = joueurs;
    salle.siege2 = uid;
    return salle;
  });
  if (!resultat.committed || !resultat.snapshot.exists()
      || !resultat.snapshot.child('joueurs').child(uid).exists()) {
    throw new Error(message('absenteOuPleine'));
  }
  const siege = resultat.snapshot.child('joueurs').child(uid).child('siege').val();
  return ouvrir(jeu, code, siege, ctx);
}

function ouvrir(jeu, code, siege, ctx) {
  const { db, uid } = ctx;
  const base = chemin(jeu, code);
  const moi = ref(db, base + '/joueurs/' + uid);
  const desabonnements = [];
  // Le code dans l'adresse, hôte compris : un refresh passe alors par le
  // lien d'invitation et reprend le même siège (rejoindreSalle reconnaît
  // l'uid). Sans ça, l'hôte qui rafraîchissait perdait la partie et l'ami
  // attendait pour rien. fermer() retire le code.
  const url = urlSalle(location.origin, jeu, code);
  if (location.pathname === '/play/' + jeu + '/') history.replaceState(history.state, '', url);
  // Présence. Un onDisconnect ne vaut que pour UNE connexion : après une
  // coupure réseau, le serveur l'a consommé (enLigne = false) et plus rien
  // ne remettait enLigne à true — l'ami voyait « déconnecté » pour de bon.
  // Motif Firebase standard : à chaque (re)connexion, réarmer onDisconnect
  // PUIS se déclarer en ligne.
  const enLigne = ref(db, base + '/joueurs/' + uid + '/enLigne');
  desabonnements.push(onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() !== true) return;
    onDisconnect(enLigne).set(false).then(() => update(moi, { enLigne: true }));
  }));
  // Quitter la page (fermeture, navigation, mise en cache « précédent ») :
  // couper proprement pour que le serveur applique onDisconnect tout de
  // suite. Sans ça, une page gardée dans le bfcache garde sa socket et le
  // joueur paraît en ligne indéfiniment ; une fermeture sale attendait le
  // délai du serveur (10 à 60 s). Retour par « précédent » : on se reconnecte
  // et .info/connected ci-dessus refait le reste.
  const cacher = () => goOffline(db);
  const montrer = (e) => { if (e.persisted) goOnline(db); };
  addEventListener('pagehide', cacher);
  addEventListener('pageshow', montrer);
  desabonnements.push(() => {
    removeEventListener('pagehide', cacher);
    removeEventListener('pageshow', montrer);
  });
  return {
    code, uid, siege, jeu,
    url,
    heureServeur,
    ecrire(valeurs) { return update(ref(db, base), valeurs); },
    sur(sousChemin, cb) {
      const cible = ref(db, sousChemin ? base + '/' + sousChemin : base);
      const off = onValue(cible, (snap) => cb(snap.val()));
      desabonnements.push(off);
      return off;
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

// Le générateur vendorisé est un script classique (global `qrcode`) : on
// l'injecte à la demande, jamais au chargement du jeu.
let qrPret = null;
export async function genererQR(url) {
  if (!qrPret) {
    qrPret = window.qrcode ? Promise.resolve() : new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/play/net/qrcode.js';
      s.onload = res;
      s.onerror = () => { qrPret = null; rej(new Error('Générateur QR introuvable (/play/net/qrcode.js).')); };
      document.head.appendChild(s);
    });
  }
  await qrPret;
  const qr = window.qrcode(0, 'M'); // 0 : plus petite version qui contient l'URL
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2 });
}
