// Étape 0 : vérifications V1 à V4 de la spec (§ 1), avec le VRAI SDK
// gstatic 12.3.0 (celui de salle.js) contre l'émulateur. Ce fichier pose
// ses propres règles minimales, une par point (chaque fichier pose les siennes).
//
// Résultats (émulateur database v4.11.2, 2026-10-30) :
//   V1 serverTimestamp() passe « === now », en transaction comme en update ;
//   V2 supprimer un ENFANT réévalue le .validate du parent (le parent entier
//      supprimé, lui, n'est pas validé) ;
//   V3 une transaction qui rend la valeur inchangée envoie quand même une
//      écriture : elle doit passer les règles (motif « inchangé ou nouveau ») ;
//   V4 onDisconnect est vérifié à l'armement ET à l'exécution.

const assert = require('node:assert');
const { before, after } = require('node:test');
const {
  test, poserRegles, vider, lire, poser, effacer, client, sdk, dbDe, couper, attendre,
} = require('./outils.js');

const REGLES = {
  rules: {
    v1: { $k: { '.read': 'auth != null', '.write': 'auth != null', t: { '.validate': 'newData.val() === now' } } },
    v2: { $k: { '.read': 'auth != null', '.write': 'auth != null', '.validate': "newData.hasChildren(['a', 'b'])" } },
    v3: { '.read': 'auth != null', '.write': false },
    v4: { $uid: { '.read': 'auth != null', '.write': 'auth != null && auth.uid === $uid' } },
  },
};

let net, S, db;
before(async () => {
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) return;
  await poserRegles(REGLES);
  await vider();
  net = await client('verif');
  S = await sdk();
  db = await dbDe(net);
});
after(async () => { if (net) await couper(net); });

test('V1 : serverTimestamp() dans une runTransaction passe « === now »', async () => {
  const r = await S.runTransaction(S.ref(db, 'v1/a'), () => ({ t: S.serverTimestamp() }));
  assert.ok(r.committed);
  const t = (await lire('v1/a/t')).val;
  assert.strictEqual(typeof t, 'number');
  assert.ok(Math.abs(t - Date.now()) < 60000);
  // Témoin : la règle mord bien sur une heure fabriquée par le client.
  await assert.rejects(S.runTransaction(S.ref(db, 'v1/b'), () => ({ t: Date.now() - 5000 })));
});

test('V1 bis : serverTimestamp() dans un update passe « === now »', async () => {
  await S.update(S.ref(db, 'v1/c'), { t: S.serverTimestamp() });
  assert.strictEqual(typeof (await lire('v1/c/t')).val, 'number');
});

test('V2 : supprimer un enfant DÉCLENCHE le .validate du parent (suppression du parent entier : non)', async () => {
  assert.ok((await poser('v2/x', { a: 1, b: 2 }, 'owner')).ok);
  // Le parent reste non nul et son .validate est réévalué : refus.
  assert.ok(!(await effacer('v2/x/a', 'u')).ok, 'enfant supprimé : le parent est validé');
  assert.deepStrictEqual((await lire('v2/x')).val, { a: 1, b: 2 });
  // Le parent entier devient null : aucun .validate n'est évalué.
  assert.ok((await effacer('v2/x', 'u')).ok, 'parent supprimé : pas de .validate');
});

test('V3 : une transaction qui rend la valeur inchangée ÉCRIT quand même (refusée si .write est faux)', async () => {
  assert.ok((await poser('v3/x', { a: 1 }, 'owner')).ok);
  const cible = S.ref(db, 'v3/x');
  // Cache chaud : la transaction voit d'emblée la vraie valeur.
  const off = S.onValue(cible, () => {});
  await S.get(cible);
  await assert.rejects(S.runTransaction(cible, (v) => v), /permission/i);
  off();
  assert.deepStrictEqual((await lire('v3/x')).val, { a: 1 });
});

test('V4 a : onDisconnect est vérifié À L\'ARMEMENT', async () => {
  await assert.rejects(S.onDisconnect(S.ref(db, 'v4/quelquun')).set('x'), /permission/i);
  await S.onDisconnect(S.ref(db, 'v4/verif/ok')).set('armé');
  await S.onDisconnect(S.ref(db, 'v4/verif/ok')).cancel();
});

// Une coupure propre (goOffline, comme salle.js sur pagehide) exécute
// l'opération armée : témoin du cas suivant.
test('V4 b : témoin — une coupure exécute l\'onDisconnect armé', async () => {
  const net2 = await client('verif4b');
  const db2 = await dbDe(net2);
  await S.set(S.ref(db2, 'v4/verif4b'), 'present');
  await S.onDisconnect(S.ref(db2, 'v4/verif4b')).set('parti');
  S.goOffline(db2);
  assert.ok(await attendre(async () => (await lire('v4/verif4b')).val === 'parti', 5000));
});

test('V4 c : onDisconnect est AUSSI revérifié à l\'exécution', async () => {
  const net2 = await client('verif4c');
  const db2 = await dbDe(net2);
  await S.set(S.ref(db2, 'v4/verif4c'), 'present');
  await S.onDisconnect(S.ref(db2, 'v4/verif4c')).set('parti');
  // Les règles changent entre l'armement et la coupure : plus aucune écriture permise.
  await poserRegles({ rules: { v4: { '.read': 'auth != null', '.write': false } } });
  try {
    S.goOffline(db2);
    await new Promise((r) => setTimeout(r, 1500));
    globalThis.__v4c = (await lire('v4/verif4c')).val;
  } finally {
    await poserRegles(REGLES);
  }
  assert.strictEqual(globalThis.__v4c, 'present', 'l\'opération armée est refusée par les nouvelles règles');
});
