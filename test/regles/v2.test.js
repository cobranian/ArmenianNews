// Recopié de lokolok (tests/regles/v2.test.js), sur le jeu echecs au lieu de
// demineur : le détail des salles v2 ne dépend pas du jeu.
// Étape 2 : salles v2 « par siège » (public/play/net/salle2.js). Chaque siège
// n'écrit que son nœud s<S>/etat ; pret et fin sont des heures serveur
// posées une fois par manche ; une fin ne s'efface ni ne se réécrit.
// Les salles anciennes (sans v) sont fermées : voir etape4.test.js.

const assert = require('node:assert');
const { before } = require('node:test');
const {
  test, JOUR, HEURE, reglesDuDepot, poserRegles, vider,
  lire, poser, fusionner, effacer, code, salleNeuve, salleAgee,
} = require('./outils.js');

const JEU = 'echecs';
const salle = (c, jeu = JEU) => `salles/${jeu}/${c}`;
const etat = (c, s) => `${salle(c)}/s${s}/etat`;
const entree = (uid) => ({ siege2: uid, [`joueurs/${uid}`]: { siege: 2, pseudo: '', enLigne: true } });
const noeud = (extra = {}) => ({ manche: 1, statut: 'enCours', prog: 0, ...extra });

// Ce qu'écrit creerSalle (salle2.js).
function salleV2(uid, { creeLe = HEURE, partage = { niveau: 'expert', graine: 7 }, mien = noeud({ pret: HEURE }) } = {}) {
  const s = {
    v: 2, jeu: JEU, creeLe, siege1: uid,
    joueurs: { [uid]: { siege: 1, pseudo: '', enLigne: true } },
  };
  if (partage) s.partage = partage;
  if (mien) s.s1 = { etat: mien };
  return s;
}

async function creer(hote = 'hote', opts) {
  const c = code();
  const r = await poser(salle(c), salleV2(hote, opts), hote);
  assert.ok(r.ok, 'création : ' + JSON.stringify(r.val));
  return c;
}
// Salle v2 avec l'hôte et l'invité, chacun prêt pour la manche 1.
async function pleine() {
  const c = await creer();
  let r = await fusionner(salle(c), entree('ami'), 'ami');
  assert.ok(r.ok, 'entrée : ' + JSON.stringify(r.val));
  r = await poser(etat(c, 2), noeud({ pret: HEURE }), 'ami');
  assert.ok(r.ok, 'pret de l\'invité : ' + JSON.stringify(r.val));
  return c;
}
// Une salle v2 préparée par le propriétaire (creeLe arbitraire).
async function v2Agee(age) {
  const c = code();
  const r = await poser(salle(c), salleV2('hote', { creeLe: Date.now() - age, mien: noeud({ pret: Date.now() - age }) }), 'owner');
  assert.ok(r.ok, 'préparation : ' + JSON.stringify(r.val));
  return c;
}

before(async () => {
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) return;
  await poserRegles(reglesDuDepot());
  await vider();
});

// ------------------------------------------------------------- création
test('v2 création : la salle de salle2.js passe', async () => {
  const c = await creer();
  const s = (await lire(salle(c))).val;
  assert.strictEqual(s.v, 2);
  assert.strictEqual(s.siege1, 'hote');
  assert.strictEqual(typeof s.s1.etat.pret, 'number');
  assert.strictEqual(s.s1.etat.pret, s.creeLe, 'pret et creeLe : la même heure serveur');
});

test('v2 création : siege1 est le créateur, v vaut 2, les champs obligatoires sont là', async () => {
  assert.ok(!(await poser(salle(code()), { ...salleV2('hote'), siege1: 'autre' }, 'hote')).ok, 'siege1 d\'un autre');
  assert.ok(!(await poser(salle(code()), { ...salleV2('hote'), v: 3 }, 'hote')).ok, 'v = 3');
  const sansSiege = salleV2('hote'); delete sansSiege.siege1;
  assert.ok(!(await poser(salle(code()), sansSiege, 'hote')).ok, 'sans siege1');
  const sansJoueurs = salleV2('hote'); delete sansJoueurs.joueurs;
  assert.ok(!(await poser(salle(code()), sansJoueurs, 'hote')).ok, 'sans joueurs');
  assert.ok((await poser(salle(code()), salleV2('hote', { partage: null, mien: null }), 'hote')).ok, 'sans partage ni nœud');
});

test('v2 création : ni s2, ni siege2, ni champ inconnu, ni ancien champ', async () => {
  assert.ok(!(await poser(salle(code()), { ...salleV2('hote'), s2: { etat: noeud() } }, 'hote')).ok, 's2 sans siege2');
  assert.ok(!(await poser(salle(code()), { ...salleV2('hote'), siege2: 'ami' }, 'hote')).ok, 'siege2 d\'un autre');
  assert.ok(!(await poser(salle(code()), { ...salleV2('hote'), manche: 1 }, 'hote')).ok, 'manche (ancien format)');
  assert.ok(!(await poser(salle(code()), { ...salleV2('hote'), course: { a: 1 } }, 'hote')).ok, 'course (ancien format)');
  assert.ok(!(await poser(salle(code()), { ...salleV2('hote'), etat: { x: 1 } }, 'hote')).ok, 'etat (ancien format)');
  assert.ok(!(await poser(salle(code()), { ...salleV2('hote'), s1: { etat: noeud(), autre: 1 } }, 'hote')).ok, 's1/autre');
});

test('v2 création : pret à l\'heure du client refusé', async () => {
  assert.ok(!(await poser(salle(code()), salleV2('hote', { mien: noeud({ pret: Date.now() - 5000 }) }), 'hote')).ok);
});

test('v2 création : une salle vivante ne s\'écrase pas, une salle de plus de 24 h si', async () => {
  const vivante = await v2Agee(1000);
  assert.ok(!(await poser(salle(vivante), salleV2('intrus'), 'intrus')).ok, 'vivante');
  const morte = await v2Agee(JOUR + 60000);
  assert.ok((await poser(salle(morte), salleV2('nouveau'), 'nouveau')).ok, 'périmée, en v2');
  // Étape 4 (N+1) : plus de recréation à l'ancien format pour un jeu passé en v2.
  const morte2 = await v2Agee(JOUR + 60000);
  assert.ok(!(await poser(salle(morte2), salleNeuve(JEU, 'nouveau'), 'nouveau')).ok, 'périmée, en ancien format');
  assert.strictEqual((await lire(salle(morte2) + '/v')).val, 2);
});

// ------------------------------------------------------------- entrée
test('v2 entrée : l\'invité entre d\'un seul envoi, un troisième est refusé', async () => {
  const c = await creer();
  assert.ok((await fusionner(salle(c), entree('ami'), 'ami')).ok, 'invité');
  assert.ok(!(await fusionner(salle(c), entree('tiers'), 'tiers')).ok, 'troisième');
  assert.strictEqual((await lire(salle(c) + '/siege2')).val, 'ami');
  assert.strictEqual((await lire(salle(c) + '/joueurs/tiers')).val, null);
});

test('v2 entrée : l\'hôte ne prend pas le siège 2, siege2 ne s\'écrit que pour soi', async () => {
  const c = await creer();
  assert.ok(!(await fusionner(salle(c), entree('hote'), 'hote')).ok, 'hôte en siège 2');
  assert.ok(!(await fusionner(salle(c), entree('ami'), 'hote')).ok, 'l\'hôte assoit quelqu\'un');
  assert.ok(!(await fusionner(salle(c), { siege2: 'x', 'joueurs/ami': { siege: 2, pseudo: '', enLigne: true } }, 'ami')).ok, 'siege2 d\'un autre');
  assert.ok(!(await poser(salle(c) + '/siege2', 'ami', 'ami')).ok, 'siege2 sans joueurs');
});

test('v2 entrée : siege2 ne change plus et ne s\'efface pas', async () => {
  const c = await pleine();
  assert.ok(!(await poser(salle(c) + '/siege2', 'tiers', 'tiers')).ok, 'par un tiers');
  assert.ok(!(await poser(salle(c) + '/siege2', 'hote', 'hote')).ok, 'par l\'hôte');
  assert.ok(!(await effacer(salle(c) + '/siege2', 'ami')).ok, 'effacé par l\'invité');
  assert.ok(!(await effacer(salle(c) + '/siege2', 'hote')).ok, 'effacé par l\'hôte');
  assert.strictEqual((await lire(salle(c) + '/siege2')).val, 'ami');
});

test('v2 entrée : pas d\'entrée dans une salle périmée', async () => {
  const c = await v2Agee(JOUR + 60000);
  assert.ok(!(await fusionner(salle(c), entree('ami'), 'ami')).ok);
});

// ------------------------------------------------------------- la salle
test('v2 membres : rien d\'écrit à la racine de la salle', async () => {
  const c = await pleine();
  for (const qui of ['hote', 'ami']) {
    assert.ok(!(await fusionner(salle(c), { creeLe: HEURE }, qui)).ok, qui + ' : creeLe');
    assert.ok(!(await poser(salle(c) + '/partage/graine', 8, qui)).ok, qui + ' : partage');
    assert.ok(!(await poser(salle(c) + '/partage', { niveau: 'debutant', graine: 1 }, qui)).ok, qui + ' : partage entier');
    assert.ok(!(await poser(salle(c) + '/v', 2, qui)).ok, qui + ' : v');
    assert.ok(!(await poser(salle(c) + '/jeu', JEU, qui)).ok, qui + ' : jeu');
    assert.ok(!(await poser(salle(c) + '/course', { x: 1 }, qui)).ok, qui + ' : course');
    assert.ok(!(await effacer(salle(c), qui)).ok, qui + ' : salle effacée');
    assert.ok(!(await poser(salle(c), salleV2(qui), qui)).ok, qui + ' : salle réécrite');
  }
  assert.strictEqual((await lire(salle(c) + '/partage/graine')).val, 7);
});

test('v2 joueurs : chacun écrit sa fiche, pas celle de l\'autre', async () => {
  const c = await pleine();
  assert.ok((await fusionner(salle(c) + '/joueurs/hote', { pseudo: 'Ana', enLigne: false }, 'hote')).ok, 'sa fiche');
  assert.ok((await poser(salle(c) + '/joueurs/ami/enLigne', false, 'ami')).ok, 'sa présence');
  assert.ok(!(await poser(salle(c) + '/joueurs/ami/pseudo', 'X', 'hote')).ok, 'pseudo de l\'autre');
  assert.ok(!(await poser(salle(c) + '/joueurs/hote/enLigne', true, 'ami')).ok, 'présence de l\'autre');
  assert.ok(!(await poser(salle(c) + '/joueurs/hote/pseudo', 'x'.repeat(21), 'hote')).ok, 'pseudo de 21');
  assert.ok(!(await poser(salle(c) + '/joueurs/hote/enLigne', 'oui', 'hote')).ok, 'enLigne non booléen');
  assert.ok(!(await poser(salle(c) + '/joueurs/hote/siege', 2, 'hote')).ok, 'changer de siège');
  assert.ok(!(await poser(salle(c) + '/joueurs/hote/x', 1, 'hote')).ok, 'champ inconnu');
  assert.ok(!(await effacer(salle(c) + '/joueurs/hote', 'hote')).ok, 'se retirer');
  assert.ok(!(await poser(salle(c) + '/joueurs/tiers', { siege: 2, pseudo: '', enLigne: true }, 'tiers')).ok, 'un tiers');
});

// ------------------------------------------------------------- s<S>/etat
test('v2 etat : chacun son siège', async () => {
  const c = await pleine();
  assert.ok((await fusionner(etat(c, 1), { prog: 5 }, 'hote')).ok, 'hôte → s1');
  assert.ok((await fusionner(etat(c, 2), { prog: 6 }, 'ami')).ok, 'invité → s2');
  assert.ok(!(await fusionner(etat(c, 2), { prog: 0 }, 'hote')).ok, 'hôte → s2');
  assert.ok(!(await fusionner(etat(c, 1), { prog: 0 }, 'ami')).ok, 'invité → s1');
  assert.ok(!(await fusionner(etat(c, 1), { prog: 0 }, 'tiers')).ok, 'tiers → s1');
  assert.ok(!(await effacer(etat(c, 1), 'hote')).ok, 'effacer son nœud');
  assert.ok(!(await effacer(`${salle(c)}/s2`, 'ami')).ok, 'effacer son siège');
});

test('v2 etat : forme imposée', async () => {
  const c = await pleine();
  assert.ok(!(await fusionner(etat(c, 1), { prog: -1 }, 'hote')).ok, 'prog négatif');
  assert.ok(!(await fusionner(etat(c, 1), { prog: 'x' }, 'hote')).ok, 'prog texte');
  assert.ok(!(await fusionner(etat(c, 1), { statut: 'en cours !' }, 'hote')).ok, 'statut hors forme');
  assert.ok(!(await fusionner(etat(c, 1), { liste: 'x'.repeat(25001) }, 'hote')).ok, 'liste trop longue');
  assert.ok((await fusionner(etat(c, 1), { liste: 'o12f3' }, 'hote')).ok, 'liste en cours de manche');
  assert.ok(!(await fusionner(etat(c, 1), { autre: 1 }, 'hote')).ok, 'champ inconnu');
  assert.ok(!(await poser(etat(c, 1), { manche: 1, prog: 0 }, 'hote')).ok, 'sans statut');
  assert.ok(!(await fusionner(etat(c, 1), { prog: null }, 'hote')).ok, 'prog retiré');
});

test('v2 pret : heure serveur, une fois par manche', async () => {
  const c = await creer('hote', { mien: noeud() });
  assert.ok(!(await fusionner(etat(c, 1), { pret: Date.now() - 5000 }, 'hote')).ok, 'heure du client');
  assert.ok((await fusionner(etat(c, 1), { pret: HEURE }, 'hote')).ok, 'heure serveur');
  const pret = (await lire(etat(c, 1) + '/pret')).val;
  assert.ok(!(await fusionner(etat(c, 1), { pret: HEURE }, 'hote')).ok, 'reposé dans la manche');
  assert.ok(!(await fusionner(etat(c, 1), { pret: null }, 'hote')).ok, 'effacé dans la manche');
  assert.ok((await fusionner(etat(c, 1), { pret, prog: 3 }, 'hote')).ok, 'réécrit à l\'identique');
  assert.strictEqual((await lire(etat(c, 1) + '/pret')).val, pret);
});

test('v2 fin : heure serveur, après pret, une fois par manche', async () => {
  const c = await creer('hote', { mien: noeud() });
  assert.ok(!(await fusionner(etat(c, 1), { fin: HEURE }, 'hote')).ok, 'fin sans pret');
  await fusionner(etat(c, 1), { pret: HEURE }, 'hote');
  assert.ok(!(await fusionner(etat(c, 1), { fin: Date.now() - 5000 }, 'hote')).ok, 'heure du client');
  assert.ok((await fusionner(etat(c, 1), { fin: HEURE, statut: 'gagne', prog: 71, liste: 'o3o9' }, 'hote')).ok, 'fin');
  const fin = (await lire(etat(c, 1) + '/fin')).val;
  assert.ok(!(await fusionner(etat(c, 1), { fin: HEURE }, 'hote')).ok, 'fin reposée');
  assert.ok(!(await fusionner(etat(c, 1), { fin: null }, 'hote')).ok, 'fin effacée');
  assert.ok(!(await fusionner(etat(c, 1), { statut: 'perdu' }, 'hote')).ok, 'statut changé');
  assert.ok(!(await fusionner(etat(c, 1), { liste: 'o3' }, 'hote')).ok, 'liste changée');
  assert.ok(!(await fusionner(etat(c, 1), { liste: null }, 'hote')).ok, 'liste effacée');
  assert.ok(!(await fusionner(etat(c, 1), { prog: 70 }, 'hote')).ok, 'prog changée');
  assert.ok(!(await fusionner(etat(c, 1), { pret: null }, 'hote')).ok, 'pret effacé');
  assert.ok(!(await poser(etat(c, 1), { manche: 1, statut: 'enCours', prog: 0 }, 'hote')).ok, 'nœud remis à zéro');
  assert.ok((await fusionner(etat(c, 1), { prog: 71 }, 'hote')).ok, 'réécrit à l\'identique');
  assert.strictEqual((await lire(etat(c, 1) + '/fin')).val, fin);
});

test('v2 manche : +1 seulement, et elle remet le nœud à neuf', async () => {
  const c = await pleine();
  await fusionner(etat(c, 1), { fin: HEURE, statut: 'perdu', prog: 9 }, 'hote');
  assert.ok(!(await poser(etat(c, 1), noeud({ manche: 3, pret: HEURE }), 'hote')).ok, 'saut de deux');
  assert.ok(!(await poser(etat(c, 1), noeud({ manche: 0 }), 'hote')).ok, 'recul');
  assert.ok(!(await poser(etat(c, 1), noeud({ manche: 2, pret: Date.now() - 5000 }), 'hote')).ok, 'pret du client');
  const ancien = (await lire(etat(c, 1) + '/pret')).val;
  assert.ok(!(await poser(etat(c, 1), noeud({ manche: 2, pret: ancien }), 'hote')).ok, 'pret de la manche d\'avant');
  assert.ok((await poser(etat(c, 1), noeud({ manche: 2, pret: HEURE }), 'hote')).ok, 'revanche');
  const s = (await lire(etat(c, 1))).val;
  assert.strictEqual(s.manche, 2);
  assert.strictEqual(s.fin, undefined);
  assert.ok(s.pret > ancien);
});

test('v2 manche : une manche sans fin peut aussi être quittée (+1)', async () => {
  const c = await pleine();
  assert.ok((await poser(etat(c, 2), noeud({ manche: 2 }), 'ami')).ok);
  assert.ok((await fusionner(etat(c, 2), { pret: HEURE }, 'ami')).ok, 'pret posé après');
});

test('v2 : une salle ancienne d\'un jeu v2 est fermée (étape 4, N+2)', async () => {
  const c = code();
  await salleAgee(JEU, c, 'hote', 1000, { course: { niveau: 'expert', graine: 1, manche: 1 } });
  assert.ok(!(await fusionner(salle(c), entree('ami'), 'ami')).ok, 'entrée');
  assert.ok(!(await fusionner(salle(c), { p2: { manche: 1 } }, 'hote')).ok, 'nœud p2');
  assert.ok(!(await fusionner(salle(c), { course: { niveau: 'expert', graine: 2, manche: 2 } }, 'hote')).ok, 'course');
  // Pas de conversion vers v2, ni de nœud v2 dans une salle ancienne.
  assert.ok(!(await poser(salle(c) + '/v', 2, 'hote')).ok, 'v ajouté');
  assert.ok(!(await poser(etat(c, 1), noeud(), 'hote')).ok, 's1/etat');
  assert.ok(!(await poser(salle(c) + '/partage', { a: 1 }, 'hote')).ok, 'partage');
});

// ------------------------------------------------------------- journaux (étape 3)
const jn = (c, s, n) => `${salle(c)}/s${s}/j/${n}`;

test('v2 journal : chacun le sien, une entrée par numéro, à l\'heure du serveur', async () => {
  const c = await pleine();
  assert.ok((await poser(jn(c, 1, 0), { a: 'c4', t: HEURE }, 'hote')).ok, 'hôte → s1/j/0');
  assert.ok((await poser(jn(c, 2, 0), { a: 'c0', t: HEURE }, 'ami')).ok, 'invité → s2/j/0');
  assert.ok(!(await poser(jn(c, 2, 1), { a: 'c1', t: HEURE }, 'hote')).ok, 'hôte → s2');
  assert.ok(!(await poser(jn(c, 1, 1), { a: 'c1', t: HEURE }, 'ami')).ok, 'invité → s1');
  assert.ok(!(await poser(jn(c, 1, 1), { a: 'c1', t: HEURE }, 'tiers')).ok, 'tiers');
  assert.ok(!(await poser(jn(c, 1, 0), { a: 'c8', t: HEURE }, 'hote')).ok, 'réécrite');
  assert.ok(!(await effacer(jn(c, 1, 0), 'hote')).ok, 'effacée');
  assert.ok(!(await effacer(`${salle(c)}/s1/j`, 'hote')).ok, 'journal effacé');
  assert.ok(!(await poser(`${salle(c)}/s1/j`, { 0: { a: 'c8', t: HEURE } }, 'hote')).ok, 'journal réécrit');
  assert.strictEqual((await lire(jn(c, 1, 0) + '/a')).val, 'c4');
});

test('v2 journal : forme d\'une entrée', async () => {
  const c = await pleine();
  assert.ok(!(await poser(jn(c, 1, 0), { a: 'c4', t: Date.now() - 5000 }, 'hote')).ok, 'heure du client');
  assert.ok(!(await poser(jn(c, 1, 0), { a: 'c4' }, 'hote')).ok, 'sans t');
  assert.ok(!(await poser(jn(c, 1, 0), { t: HEURE }, 'hote')).ok, 'sans a');
  assert.ok(!(await poser(jn(c, 1, 0), { a: '', t: HEURE }, 'hote')).ok, 'action vide');
  assert.ok(!(await poser(jn(c, 1, 0), { a: 7, t: HEURE }, 'hote')).ok, 'action pas texte');
  assert.ok(!(await poser(jn(c, 1, 0), { a: 'x'.repeat(401), t: HEURE }, 'hote')).ok, 'action trop longue');
  assert.ok(!(await poser(jn(c, 1, 0), { a: 'c4', t: HEURE, x: 1 }, 'hote')).ok, 'champ en trop');
  for (const n of ['01', '-1', 'a', '100000', '1.5']) {
    assert.ok(!(await poser(jn(c, 1, n), { a: 'c4', t: HEURE }, 'hote')).ok, 'numéro ' + n);
  }
  assert.ok((await poser(jn(c, 1, 99999), { a: 'c4', t: HEURE }, 'hote')).ok, 'numéro 99999 (le trou ne gêne que son auteur)');
});

test('v2 journal : pas de journal dans une salle ancienne, ni avant d\'être assis', async () => {
  const c = code();
  await salleAgee(JEU, c, 'hote', 1000);
  assert.ok(!(await poser(jn(c, 1, 0), { a: 'c4', t: HEURE }, 'hote')).ok, 'salle ancienne');
  const d = await creer();
  assert.ok(!(await poser(jn(d, 2, 0), { a: 'c4', t: HEURE }, 'ami')).ok, 'siège 2 libre');
});
