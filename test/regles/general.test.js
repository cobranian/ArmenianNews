// Ce que les règles garantissent à toute salle, pour les deux jeux d'Arménie
// Info (echecs, backgammon) — recopié de lokolok, qui en a huit. Toutes les
// salles sont au format v2 (salle2.js) : l'ancien format (salles sans v,
// salle.js) n'existe plus — voir etape4.test.js. Le détail des salles v2
// (sièges, nœuds, journaux) : v2.test.js. Les jeux de lokolok que ce site
// n'héberge pas (minigolf…) sont refusés : test « jeux d'Arménie Info ».

const assert = require('node:assert');
const { before } = require('node:test');
const {
  test, JOUR, HEURE, reglesDuDepot, poserRegles, vider,
  lire, poser, fusionner, rest, code,
} = require('./outils.js');

const JEUX = ['echecs', 'backgammon'];
// Les jeux de lokolok que ce site n'héberge pas, et des voisins de nom.
const ETRANGERS = ['minigolf', 'runeglass', 'morpion', 'quatre-en-ligne', 'demineur', 'solitaire', 'echecs2', 'backgammon-x', 'xechecs'];
const JEU = 'echecs';
const salle = (c, jeu = JEU) => `salles/${jeu}/${c}`;

// Ce qu'écrit creerSalle de salle2.js.
const salleV2 = (jeu, uid, creeLe = HEURE) => ({
  v: 2, jeu, creeLe, siege1: uid,
  joueurs: { [uid]: { siege: 1, pseudo: '', enLigne: true } },
});
// Une salle v2 préparée en owner, créée il y a `age` ms.
async function v2Agee(jeu, c, hote, age) {
  const r = await poser(salle(c, jeu), salleV2(jeu, hote, Date.now() - age), 'owner');
  if (!r.ok) throw new Error('préparation : ' + JSON.stringify(r.val));
}

before(async () => {
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) return;
  await poserRegles(reglesDuDepot());
  await vider();
});

test('création : chaque jeu crée une salle v2, creeLe en heure serveur', async () => {
  for (const jeu of JEUX) {
    const c = code();
    const avant = Date.now();
    const r = await poser(salle(c, jeu), salleV2(jeu, 'hote'), 'hote');
    assert.ok(r.ok, jeu + ' : ' + JSON.stringify(r.val));
    const lu = (await lire(salle(c, jeu))).val;
    assert.ok(Math.abs(lu.creeLe - avant) < 60000, jeu + ' : creeLe ≈ maintenant');
  }
});

test('jeux d\'Arménie Info : une salle minigolf (ou de tout autre jeu) est refusée', async () => {
  // Témoin : la même salle passe sous echecs et backgammon.
  for (const jeu of JEUX) {
    assert.ok((await poser(salle(code(), jeu), salleV2(jeu, 'hote'), 'hote')).ok, jeu);
  }
  for (const jeu of ETRANGERS) {
    const c = code();
    const r = await poser(salle(c, jeu), salleV2(jeu, 'hote'), 'hote');
    assert.ok(!r.ok, jeu + ' : ' + JSON.stringify(r.val));
    assert.strictEqual((await lire(salle(c, jeu))).val, null, jeu + ' : rien d\'écrit');
  }
  // Ni par morceaux : siege2 ou une fiche de joueur sous un jeu étranger.
  const c = code();
  assert.ok(!(await poser(salle(c, 'minigolf') + '/siege2', 'ami', 'ami')).ok, 'minigolf/siege2');
  assert.ok(!(await poser(salle(c, 'minigolf') + '/joueurs/ami', { siege: 1, pseudo: '', enLigne: true }, 'ami')).ok, 'minigolf/joueurs');
});

test('création : refusée à un visiteur non connecté', async () => {
  assert.ok(!(await poser(salle(code()), salleV2(JEU, 'x'), null)).ok);
});

test('création : seule l\'heure serveur est admise pour creeLe', async () => {
  assert.ok(!(await poser(salle(code()), salleV2(JEU, 'hote', Date.now() - 5000), 'hote')).ok, 'heure du client');
  assert.ok(!(await poser(salle(code()), salleV2(JEU, 'hote', Date.now() + JOUR), 'hote')).ok, 'dans le futur');
  const sans = salleV2(JEU, 'hote');
  delete sans.creeLe;
  assert.ok(!(await poser(salle(code()), sans, 'hote')).ok, 'sans creeLe');
});

test('jeu et code : le jeu du chemin, un code de la bonne forme', async () => {
  assert.ok(!(await poser(salle(code()), salleV2('backgammon', 'hote'), 'hote')).ok, 'jeu ≠ chemin');
  for (const mauvais of ['ABCDE0', 'ABCDEI', 'ABCDEO', 'ABCDE1', 'abcdef', 'ABCDE', 'ABCDEFG']) {
    assert.ok(!(await poser(salle(mauvais), salleV2(JEU, 'hote'), 'hote')).ok, 'code ' + mauvais);
  }
  for (const jeu of ['Echecs', 'é', 'a_b', 'x'.repeat(31)]) {
    assert.ok(!(await poser(salle(code(), jeu), salleV2(jeu, 'hote'), 'hote')).ok, 'jeu ' + jeu);
  }
  assert.ok((await poser(salle('AZ29HN', 'backgammon'), salleV2('backgammon', 'hote'), 'hote')).ok);
});

test('salle vivante : personne ne l\'écrase, pas même son hôte', async () => {
  const c = code();
  assert.ok((await poser(salle(c), salleV2(JEU, 'hote'), 'hote')).ok);
  assert.ok(!(await poser(salle(c), salleV2(JEU, 'intrus'), 'intrus')).ok, 'un autre');
  assert.ok(!(await poser(salle(c), salleV2(JEU, 'hote'), 'hote')).ok, 'son hôte');
  assert.strictEqual((await lire(salle(c) + '/siege1')).val, 'hote');
});

test('péremption : après 24 h, n\'importe qui recrée la salle ; à 23 h 59, non', async () => {
  const c = code();
  await v2Agee(JEU, c, 'hote', JOUR + 60000);
  const r = await poser(salle(c), salleV2(JEU, 'nouveau'), 'nouveau');
  assert.ok(r.ok, JSON.stringify(r.val));
  assert.deepStrictEqual(Object.keys((await lire(salle(c))).val.joueurs), ['nouveau']);
  const c2 = code();
  await v2Agee(JEU, c2, 'hote', JOUR - 60000);
  assert.ok(!(await poser(salle(c2), salleV2(JEU, 'nouveau'), 'nouveau')).ok);
});

test('effacement : personne n\'efface une salle, vivante ou périmée', async () => {
  for (const age of [1000, JOUR + 60000]) {
    const c = code();
    await v2Agee(JEU, c, 'hote', age);
    assert.ok(!(await rest('DELETE', salle(c), { qui: 'hote' })).ok, 'son hôte, âge ' + age);
    assert.ok(!(await rest('DELETE', salle(c), { qui: 'passant' })).ok, 'un passant, âge ' + age);
  }
});

test('champs inconnus : refusés à la racine d\'une salle', async () => {
  const c = code();
  assert.ok(!(await poser(salle(code()), { ...salleV2(JEU, 'hote'), etat: { x: 1 } }, 'hote')).ok, 'à la création');
  await v2Agee(JEU, c, 'hote', 1000);
  assert.ok(!(await fusionner(salle(c), { etat: { x: 1 } }, 'hote')).ok, 'etat');
  assert.ok(!(await fusionner(salle(c), { manche: 2 }, 'hote')).ok, 'manche');
});

test('lecture : il faut être connecté ; tout connecté lit une salle', async () => {
  const c = code();
  await v2Agee(JEU, c, 'hote', 1000);
  assert.ok(!(await rest('GET', salle(c), { qui: null })).ok, 'non connecté');
  const r = await rest('GET', salle(c), { qui: 'curieux' });
  assert.ok(r.ok, 'connecté non membre');
  assert.strictEqual(r.val.jeu, JEU);
});

test('hors des salles : rien ne se lit ni ne s\'écrit', async () => {
  assert.ok(!(await rest('GET', '', { qui: 'x' })).ok, 'racine');
  assert.ok(!(await rest('GET', 'salles', { qui: 'x' })).ok, 'liste des salles');
  assert.ok(!(await rest('GET', `salles/${JEU}`, { qui: 'x' })).ok, 'liste d\'un jeu');
  assert.ok(!(await poser('ailleurs', 1, 'x')).ok, 'autre nœud');
});
