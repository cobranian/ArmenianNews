// Banc d'essai des règles RTDB du mode ami (database.rules.json), recopié de
// lokolok (tests/regles/) et réduit aux deux jeux d'Arménie Info : echecs et
// backgammon. Node pur, aucun paquet npm : l'API REST de l'émulateur par
// fetch, et le vrai SDK gstatic pour les vérifications qui en ont besoin
// (sdk/crochets.mjs).
//
// Lancement, depuis la racine du dépôt (Java 21 ou plus) — npm run test:regles :
//   npx --yes firebase-tools@15.34.2 emulators:exec --only database \
//     --project demo-armenie-info "node --test --test-concurrency=1 test/regles/*.test.js"
// Sans émulateur (FIREBASE_DATABASE_EMULATOR_HOST absent), chaque test est
// SAUTÉ. `npm test` (node --test test/*.mjs) ne voit pas ce dossier ; ses
// fichiers sont en CommonJS (package.json local), comme chez lokolok.
//
// REGLES_FICHIER=<chemin> fait tourner les tests contre un autre fichier de
// règles (ex. l'ancienne version, pour voir quels tests elle fait échouer).

const nodeTest = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const EMU = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '';
const BASE = 'http://' + EMU;
// Le namespace que vise le SDK : celui de databaseURL dans public/play/net/
// config.js (base armenie-info-default-rtdb, europe-west1). Uniquement dans
// l'émulateur (projet demo-armenie-info) : rien ne touche la prod. Tant que
// config.js est vide, sdk/crochets.mjs y pose DATABASE_URL.
const NS = 'armenie-info-default-rtdb';
const DATABASE_URL = 'https://' + NS + '.europe-west1.firebasedatabase.app';
const JOUR = 24 * 60 * 60 * 1000;

const SANS_EMU = EMU ? false : 'émulateur RTDB absent (FIREBASE_DATABASE_EMULATOR_HOST) — voir test/regles/outils.js';
// En CI, un saut silencieux laisserait passer le déploiement : REGLES_EXIGEES=1
// change l'absence d'émulateur en échec.
if (SANS_EMU && process.env.REGLES_EXIGEES === '1') throw new Error(SANS_EMU);

function test(nom, fn) { return nodeTest.test(nom, { skip: SANS_EMU, timeout: 30000 }, fn); }

const FICHIER = process.env.REGLES_FICHIER
  ? path.resolve(process.env.REGLES_FICHIER)
  : path.join(__dirname, '..', '..', 'database.rules.json');
function reglesDuDepot() { return JSON.parse(fs.readFileSync(FICHIER, 'utf8')); }

// Jeton non signé : l'émulateur l'accepte et en tire auth.uid.
function jeton(uid) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const t = Math.floor(Date.now() / 1000);
  return b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({
    sub: uid, user_id: uid, iat: t, exp: t + 3600, auth_time: t,
    aud: 'armenie-info', iss: 'https://securetoken.google.com/armenie-info',
    provider_id: 'anonymous', firebase: { sign_in_provider: 'anonymous', identities: {} },
  }) + '.';
}

// qui : un uid (chaîne), 'owner' (contourne les règles) ou null (non connecté).
async function rest(methode, chemin, { qui = null, corps, ns = NS } = {}) {
  const entetes = { 'Content-Type': 'application/json' };
  if (qui === 'owner') entetes.Authorization = 'Bearer owner';
  // Un jeton d'utilisateur passe par ?auth= : en « Bearer », l'émulateur le
  // prend pour un jeton d'accès Google, c'est-à-dire un administrateur.
  const url = BASE + '/' + chemin.replace(/^\/+/, '') + '.json?ns=' + ns
    + (qui && qui !== 'owner' ? '&auth=' + jeton(qui) : '');
  const rep = await fetch(url, {
    method: methode, headers: entetes,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await rep.text();
  let val = null;
  try { val = JSON.parse(texte); } catch { val = texte; }
  return { ok: rep.ok, statut: rep.status, val };
}

const lire = (chemin, qui = 'owner') => rest('GET', chemin, { qui });
const poser = (chemin, corps, qui) => rest('PUT', chemin, { qui, corps });
const fusionner = (chemin, corps, qui) => rest('PATCH', chemin, { qui, corps });
const effacer = (chemin, qui) => rest('DELETE', chemin, { qui });

async function poserRegles(regles, ns = NS) {
  const r = await rest('PUT', '.settings/rules', { qui: 'owner', corps: regles, ns });
  if (!r.ok) throw new Error('Règles refusées par l\'émulateur : ' + JSON.stringify(r.val));
}
async function vider(ns = NS) {
  const r = await rest('PUT', '', { qui: 'owner', corps: null, ns });
  if (!r.ok) throw new Error('Impossible de vider la base : ' + JSON.stringify(r.val));
}

// Codes de salle valides et tous différents (alphabet de protocole.js).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let compteur = Math.floor(Math.random() * 1e6);
function code() {
  let n = compteur++, s = '';
  for (let i = 0; i < 6; i++) { s += ALPHABET[n % 32]; n = Math.floor(n / 32); }
  return s;
}

const HEURE = { '.sv': 'timestamp' };

// Ce qu'écrivait creerSalle de l'ancien salle.js (salles sans v), à l'identique.
function salleNeuve(jeu, uid, donneesInitiales, creeLe = HEURE) {
  return {
    jeu, creeLe, manche: 1,
    joueurs: { [uid]: { siege: 1, pseudo: '', enLigne: true } },
    ...(donneesInitiales || {}),
  };
}

// Une salle créée par l'hôte il y a `age` ms (préparée en owner : creeLe arbitraire).
async function salleAgee(jeu, c, hote, age, donnees) {
  const r = await poser(`salles/${jeu}/${c}`, salleNeuve(jeu, hote, donnees, Date.now() - age), 'owner');
  if (!r.ok) throw new Error('préparation : ' + JSON.stringify(r.val));
}

// ---------------------------------------------------------------- SDK
let crochetsPoses = false;
function poserCrochets() {
  if (crochetsPoses) return;
  crochetsPoses = true;
  const { register } = require('node:module');
  const { pathToFileURL } = require('node:url');
  register(pathToFileURL(path.join(__dirname, 'sdk', 'crochets.mjs')).href,
    { data: { emulateur: EMU, databaseURL: DATABASE_URL } });
  // salle.js vit dans une page : les quelques globales qu'il touche.
  globalThis.location = {
    origin: 'http://localhost:8148', hostname: 'localhost',
    pathname: '/play/test/', search: '?emu=1',
  };
  globalThis.history = { state: null, replaceState() {} };
  globalThis.addEventListener ||= () => {};
  globalThis.removeEventListener ||= () => {};
}

const NET = path.join(__dirname, '..', '..', 'public', 'play', 'net');
const SALLE_JS = path.join(NET, 'salle.js');
// Un client = une copie de salle.js avec son propre uid, sa propre app et
// sa propre connexion à l'émulateur.
// `onglet` distingue deux copies pour le même uid (un rechargement de page).
async function client(uid, onglet = '1') {
  poserCrochets();
  const { pathToFileURL } = require('node:url');
  return import(pathToFileURL(SALLE_JS).href + '?client=' + encodeURIComponent(uid)
    + '&onglet=' + encodeURIComponent(onglet));
}
// La même chose pour salle2.js (salles v2) ; il importe le salle.js du même client.
const SALLE2_JS = path.join(NET, 'salle2.js');
async function client2(uid, onglet = '1') {
  poserCrochets();
  const { pathToFileURL } = require('node:url');
  return import(pathToFileURL(SALLE2_JS).href + '?client=' + encodeURIComponent(uid)
    + '&onglet=' + encodeURIComponent(onglet));
}
// Le SDK réel, partagé (ref, runTransaction, onDisconnect…), et la db d'un client.
async function sdk() {
  poserCrochets();
  return import('https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js');
}
async function dbDe(net) {
  const { db } = await net.connecter();
  return db;
}
async function couper(net) {
  const S = await sdk();
  S.goOffline(await dbDe(net));
}

// Attend qu'une condition sur une lecture REST devienne vraie (onDisconnect…).
async function attendre(fn, delai = 5000) {
  const fin = Date.now() + delai;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > fin) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
}

module.exports = {
  test, EMU, NS, DATABASE_URL, JOUR, HEURE, SANS_EMU,
  reglesDuDepot, jeton, rest, lire, poser, fusionner, effacer, poserRegles, vider,
  code, salleNeuve, salleAgee, client, client2, sdk, dbDe, couper, attendre,
};
