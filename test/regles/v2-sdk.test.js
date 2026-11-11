// Recopié de lokolok, sur echecs et backgammon.
// Étape 2 : le VRAI public/play/net/salle2.js, avec le vrai SDK, contre les règles
// du dépôt. Le parcours d'une course : création avec pret, entrée de
// l'invité, pret de l'invité, progression, fin, arrêt, revanche, reprise
// après rechargement, salle pleine, salle ancienne.

const assert = require('node:assert');
const { before, after } = require('node:test');
const {
  test, reglesDuDepot, poserRegles, vider, lire, poser, code, salleNeuve,
  client, client2, couper, attendre,
} = require('./outils.js');

const ouverts = [];
before(async () => {
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) return;
  await poserRegles(reglesDuDepot());
  await vider();
});
after(async () => { for (const n of ouverts) await couper(n).catch(() => {}); });

async function nouveau(uid, onglet) {
  const n = await client2(uid, onglet);
  ouverts.push(n);
  return n;
}
// La dernière valeur reçue par un abonnement, et l'attente d'une condition.
function suivre(abonner) {
  const s = { v: undefined };
  abonner((v) => { s.v = v; });
  s.quand = (fn) => attendre(async () => fn(s.v), 8000);
  return s;
}

test('salle2 : une course de bout en bout', async () => {
  const NetH = await nouveau('h-v2');
  const debut = { manche: 1, statut: 'enCours', prog: 0 };
  const hote = await NetH.creerSalle('echecs', {
    partage: { niveau: 'expert', graine: 42 },
    mien: { ...debut, pret: NetH.HEURE },
  });
  assert.strictEqual(hote.siege, 1);
  assert.deepStrictEqual(hote.partage, { niveau: 'expert', graine: 42 });
  const base = `salles/echecs/${hote.code}`;
  assert.strictEqual((await lire(base + '/v')).val, 2);
  assert.ok(await attendre(async () => (await lire(base + '/joueurs/h-v2/enLigne')).val === true), 'présence de l\'hôte');

  const NetA = await nouveau('a-v2');
  const ami = await NetA.rejoindreSalle('echecs', hote.code);
  assert.strictEqual(ami.siege, 2);
  assert.deepStrictEqual(ami.partage, { niveau: 'expert', graine: 42 });
  await ami.poserPseudo('Ami');
  await ami.ecrireMien({ ...debut, pret: NetA.HEURE }, { remplacer: true });

  const vuParHote = suivre((cb) => hote.surAmi(cb));
  const joueursHote = suivre((cb) => hote.surJoueurs(cb));
  assert.ok(await vuParHote.quand((v) => v && typeof v.pret === 'number'), 'l\'hôte voit le pret de l\'ami');
  assert.ok(await joueursHote.quand((v) => v && v.ami && v.ami.pseudo === 'Ami' && v.moi && v.moi.siege === 1));

  // Progression puis fin : l'heure de fin est celle du serveur.
  await hote.ecrireMien({ prog: 12 });
  await ami.ecrireMien({ prog: 3 });
  await hote.ecrireMien({ fin: NetH.HEURE, statut: 'gagne', prog: 71, liste: 'o5o9' });
  const mienH = (await lire(base + '/s1/etat')).val;
  assert.ok(mienH.fin >= mienH.pret);
  // Une fin ne se réécrit pas : le serveur refuse, la promesse échoue.
  await assert.rejects(hote.ecrireMien({ statut: 'perdu' }));
  // Arrêt de l'ami, puis revanche des deux.
  await ami.ecrireMien({ fin: NetA.HEURE });
  await ami.ecrireMien({ ...debut, manche: 2, pret: NetA.HEURE }, { remplacer: true });
  await hote.ecrireMien({ ...debut, manche: 2, pret: NetH.HEURE }, { remplacer: true });
  const s2 = (await lire(base + '/s2/etat')).val;
  assert.strictEqual(s2.manche, 2);
  assert.strictEqual(s2.fin, undefined);
  // salle2 n'offre aucune écriture hors de son propre nœud.
  assert.strictEqual(hote.ecrire, undefined);

  // Rechargements : même siège, sans écriture.
  const hote2 = await (await nouveau('h-v2', '2')).rejoindreSalle('echecs', hote.code);
  assert.strictEqual(hote2.siege, 1);
  const ami2 = await (await nouveau('a-v2', '2')).rejoindreSalle('echecs', hote.code);
  assert.strictEqual(ami2.siege, 2);
  const mien2 = suivre((cb) => ami2.surMien(cb));
  assert.ok(await mien2.quand((v) => v && v.manche === 2), 'reprise : mon nœud relu');

  // Un troisième : salle pleine.
  await assert.rejects((await nouveau('tiers-v2')).rejoindreSalle('echecs', hote.code), (e) => e.code === 'pleine');
});

test('salle2 : salle absente, code invalide, salle de l\'ancien format', async () => {
  const Net = await nouveau('x-v2');
  await assert.rejects(Net.rejoindreSalle('echecs', 'ABCDE0'), (e) => e.code === 'invalide');
  await assert.rejects(Net.rejoindreSalle('echecs', code()), (e) => e.code === 'absente');
  const c = code();
  // Une salle ancienne encore en cours (créée avant l'étape 4) : préparée en owner.
  assert.ok((await poser(`salles/echecs/${c}`, salleNeuve('echecs', 'vieux', { course: { niveau: 'expert', graine: 1, manche: 1 } }, Date.now() - 1000), 'owner')).ok);
  await assert.rejects(Net.rejoindreSalle('echecs', c), (e) => e.code === 'ancienne');
  // L'ancien salle.js n'y entre plus non plus (étape 4, N+2).
  const Ancien = await client('y-v2');
  ouverts.push(Ancien);
  await assert.rejects(Ancien.rejoindreSalle('echecs', c), /existe pas|pleine|permission/i);
});

test('salle2 : journaux — ajouter, fusion, provisoire, rechargement', async () => {
  const NetH = await nouveau('h-j');
  const hote = await NetH.creerSalle('backgammon', {});
  const ami = await (await nouveau('a-j')).rejoindreSalle('backgammon', hote.code);
  const vuHote = suivre((cb) => hote.surJournal(cb));
  const vuAmi = suivre((cb) => ami.surJournal(cb));
  assert.deepStrictEqual(await hote.ajouter('c4'), { n: 0 });
  assert.deepStrictEqual(await ami.ajouter('c0'), { n: 0 });
  assert.deepStrictEqual(await hote.ajouter('c8'), { n: 1 });
  const fini = (l) => l && l.length === 3 && l.every((e) => !e.provisoire);
  assert.ok(await vuHote.quand(fini) && await vuAmi.quand(fini));
  const sans = (l) => l.map(({ provisoire, ...r }) => r);
  assert.deepStrictEqual(sans(vuHote.v), sans(vuAmi.v), 'même fusion des deux côtés');
  assert.deepStrictEqual(vuHote.v.map((e) => e.siege + e.a), ['1c4', '2c0', '1c8']);
  assert.ok(vuHote.v[0].t <= vuHote.v[1].t && vuHote.v[1].t <= vuHote.v[2].t);
  // Un second onglet du même joueur continue à la suite.
  const hote2 = await (await nouveau('h-j', '2')).rejoindreSalle('backgammon', hote.code);
  assert.deepStrictEqual(await hote2.ajouter('N2'), { n: 2 });
  // Le premier onglet n'a pas encore vu l'entrée 2 ? ajouter passe au numéro suivant.
  assert.deepStrictEqual(await hote.ajouter('c1'), { n: 3 });
});

// ------------------------------------------------------------- socle
// (venus de compat.test.js quand l'ancien format a disparu, 2026-10-31)
test('socle : HEURE, heureServeur() et raccordement à l\'émulateur sur ?emu=1', async () => {
  const Net = await nouveau('socle');
  assert.deepStrictEqual(Net.HEURE, { '.sv': 'timestamp' });
  await Net.connecter();
  assert.ok(Math.abs(Net.heureServeur() - Date.now()) < 60000);
  const s = await Net.creerSalle('backgammon', { mien: { manche: 1, statut: 'attente', prog: 0, pret: Net.HEURE } });
  assert.strictEqual(typeof s.heureServeur, 'function');
  const h = (await lire(`salles/backgammon/${s.code}/s1/etat/pret`)).val;
  assert.ok(Math.abs(h - Date.now()) < 60000, 'HEURE devient l\'heure serveur');
  const appels = (globalThis.__emuAppels || []).filter((x) => x.client === 'socle');
  assert.ok(appels.some((x) => x.quoi === 'database' && x.port === 9000), 'connectDatabaseEmulator');
  assert.ok(appels.some((x) => x.quoi === 'auth'), 'connectAuthEmulator');
});

test('socle : creerSalle passe au code suivant si le premier est occupé (refus des règles)', async () => {
  // Une salle sans creeLe : personne ne peut l'écraser.
  const gelee = { jeu: 'backgammon', manche: 1, joueurs: { autre: { siege: 1, pseudo: '', enLigne: false } } };
  assert.ok((await poser('salles/backgammon/AAAAAA', gelee, 'owner')).ok);
  const Net = await nouveau('gel');
  await Net.connecter();
  const vrai = Math.random;
  let n = 0;
  Math.random = () => (n++ < 6 ? 0 : vrai());   // premier code tiré : AAAAAA
  let s;
  try { s = await Net.creerSalle('backgammon', {}); } finally { Math.random = vrai; }
  assert.ok(n > 6, 'un second code a été tiré');
  assert.notStrictEqual(s.code, 'AAAAAA');
  assert.strictEqual(s.siege, 1);
  assert.deepStrictEqual((await lire('salles/backgammon/AAAAAA')).val, gelee, 'la salle gelée est intacte');
});
