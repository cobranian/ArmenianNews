// Crochets de chargement Node (module.register) : font tourner le VRAI
// public/play/net/salle.js (et salle2.js), avec le VRAI SDK Firebase de gstatic (même version
// que la production), contre l'émulateur RTDB. Aucun paquet npm.
//
// - firebase-app.js et firebase-database.js sont téléchargés une fois depuis
//   gstatic, puis gardés dans un cache (dossier temporaire du système).
// - Chaque client de test importe `salle.js?client=<uid>` : une copie à part
//   du module, donc sa propre connexion et son propre uid. Ses imports
//   gstatic reçoivent le même `?client=<uid>` et tombent sur de minces
//   enveloppes :
//     firebase-app      initializeApp nommé <uid> (plusieurs apps par processus) ;
//     firebase-auth     factice : signInAnonymously rend { user: { uid } } ;
//     firebase-database getDatabase se raccorde TOUT DE SUITE à l'émulateur,
//                       avec un jeton factice (mockUserToken) pour <uid> :
//                       aucune requête ne peut partir vers le vrai projet.
//                       connectDatabaseEmulator ne fait que noter l'appel,
//                       pour vérifier que salle.js le fait bien sur ?emu=1.
//
// Arménie Info : public/play/net/config.js est écrit à la main et reste vide
// tant que Nareg ne l'a pas rempli (salle.js refuse alors de se connecter).
// Les champs VIDES y sont complétés pour les tests (apiKey factice,
// databaseURL de la base armenie-info) ; un champ rempli est gardé tel quel,
// donc un databaseURL qui viserait une autre base ferait échouer les tests SDK.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const VERSION = '12.3.0';
const BASE = `https://www.gstatic.com/firebasejs/${VERSION}/`;
const CACHE = join(tmpdir(), `armenie-info-firebasejs-${VERSION}`);

let emulateur = '127.0.0.1:9000';
let databaseURL = '';
export function initialize(donnees) {
  if (donnees && donnees.emulateur) emulateur = donnees.emulateur;
  if (donnees && donnees.databaseURL) databaseURL = donnees.databaseURL;
}

async function sourceReelle(nom) {
  const fichier = join(CACHE, nom);
  try { return await readFile(fichier, 'utf8'); } catch { /* pas encore en cache */ }
  const rep = await fetch(BASE + nom);
  if (!rep.ok) throw new Error(`Téléchargement de ${BASE + nom} : HTTP ${rep.status}`);
  const texte = await rep.text();
  await mkdir(CACHE, { recursive: true });
  await writeFile(fichier, texte);
  return texte;
}

function clientDe(url) {
  const m = /[?&]client=([^&]+)/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : null;
}

export async function resolve(specifier, context, suivant) {
  if (specifier.startsWith(BASE)) {
    // Importé par salle.js?client=X : l'enveloppe du client X. Importé par
    // une enveloppe ou par le SDK lui-même : le module réel, partagé.
    const parent = context.parentURL || '';
    const client = parent.startsWith(BASE) ? null : clientDe(parent);
    const url = client ? `${specifier}?client=${encodeURIComponent(client)}` : specifier;
    return { url, shortCircuit: true };
  }
  // salle2.js?client=X importe './salle.js' : la copie du même client (et du
  // même onglet), pour partager sa connexion au lieu d'une copie commune.
  const parent = context.parentURL || '';
  if (specifier === './salle.js' && parent.startsWith('file:') && clientDe(parent)) {
    const r = await suivant(specifier, context);
    return { ...r, url: r.url.split('?')[0] + '?' + parent.split('?')[1], shortCircuit: true };
  }
  return suivant(specifier, context);
}

const CONFIG = /\/public\/play\/net\/config\.js(\?|$)/;

export async function load(url, context, suivant) {
  if (url.startsWith('file:') && CONFIG.test(url)) {
    const r = await suivant(url, context);
    const source = String(r.source) + `
      if (!FIREBASE_CONFIG.apiKey) FIREBASE_CONFIG.apiKey = 'cle-de-test';
      if (!FIREBASE_CONFIG.databaseURL) FIREBASE_CONFIG.databaseURL = ${JSON.stringify(databaseURL)};
      if (!FIREBASE_CONFIG.appId) FIREBASE_CONFIG.appId = 'app-de-test';
    `;
    return { ...r, source, shortCircuit: true };
  }
  if (!url.startsWith(BASE)) return suivant(url, context);
  const nom = url.slice(BASE.length).split('?')[0];
  const client = clientDe(url);
  const lit = JSON.stringify;
  let source;
  if (nom === 'firebase-auth.js') {
    source = `
      export function getAuth(app) { return { app, uid: ${lit(client || 'anonyme')} }; }
      export async function signInAnonymously(auth) { return { user: { uid: auth.uid } }; }
      export function connectAuthEmulator() { (globalThis.__emuAppels ||= []).push({ quoi: 'auth', client: ${lit(client)} }); }
    `;
  } else if (!client) {
    source = await sourceReelle(nom);
  } else if (nom === 'firebase-app.js') {
    source = `
      import * as R from ${lit(BASE + nom)};
      export * from ${lit(BASE + nom)};
      let n = 0;
      export function initializeApp(options) { return R.initializeApp(options, ${lit(client)} + '#' + (++n)); }
    `;
  } else if (nom === 'firebase-database.js') {
    const [hote, port] = emulateur.split(':');
    source = `
      import * as R from ${lit(BASE + nom)};
      export * from ${lit(BASE + nom)};
      const raccordees = new WeakSet();
      export function getDatabase(app, url) {
        const db = R.getDatabase(app, url);
        if (!raccordees.has(db)) {
          raccordees.add(db);
          R.connectDatabaseEmulator(db, ${lit(hote)}, ${Number(port)}, { mockUserToken: { sub: ${lit(client)} } });
        }
        return db;
      }
      export function connectDatabaseEmulator(db, hote, port) {
        (globalThis.__emuAppels ||= []).push({ quoi: 'database', client: ${lit(client)}, hote, port });
      }
    `;
  } else {
    throw new Error('Module Firebase inattendu : ' + url);
  }
  return { format: 'module', source, shortCircuit: true };
}
