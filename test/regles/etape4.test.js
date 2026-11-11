// Étape 4 et fermeture de l'ancien régime (spec 2026-10-30 § 5.2 et § 6 ;
// Minigolf et Runeglass passés en v2 le 2026-10-31). L'ancien format (salles
// sans v, écrites par salle.js) n'existe plus pour AUCUN jeu : ni création,
// ni recréation d'une salle périmée, ni entrée, ni écriture, ni effacement
// dans une salle ancienne qui traînerait encore. Pas de conversion entre
// les deux formats. Recopié de lokolok, réduit à echecs et backgammon.

const assert = require('node:assert');
const { before, after } = require('node:test');
const {
  test, JOUR, HEURE, reglesDuDepot, poserRegles, vider,
  lire, poser, fusionner, effacer, code, salleNeuve, salleAgee, client, couper,
} = require('./outils.js');

const JEUX = ['echecs', 'backgammon'];
const salle = (jeu, c) => `salles/${jeu}/${c}`;
const invite = (uid) => ({ siege2: uid, [`joueurs/${uid}`]: { siege: 2, pseudo: '', enLigne: true } });

// Ce qu'écrit creerSalle de salle2.js.
const salleV2 = (jeu, uid) => ({
  v: 2, jeu, creeLe: HEURE, siege1: uid,
  joueurs: { [uid]: { siege: 1, pseudo: '', enLigne: true } },
});

const ouverts = [];
before(async () => {
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) return;
  await poserRegles(reglesDuDepot());
  await vider();
});
after(async () => { for (const n of ouverts) await couper(n).catch(() => {}); });

test('ancien format : aucune création, pour aucun jeu ; la v2 passe', async () => {
  for (const jeu of JEUX) {
    assert.ok(!(await poser(salle(jeu, code()), salleNeuve(jeu, 'vieil-onglet', { etat: { x: 1 } }), 'vieil-onglet')).ok, jeu + ' : ancien format');
    assert.ok((await poser(salle(jeu, code()), salleV2(jeu, 'hote'), 'hote')).ok, jeu + ' : v2');
  }
});

test('ancien format : une salle périmée ne se recrée qu\'en v2', async () => {
  for (const jeu of JEUX) {
    const c = code();
    await salleAgee(jeu, c, 'hote', JOUR + 60000);
    assert.ok(!(await poser(salle(jeu, c), salleNeuve(jeu, 'nouveau'), 'nouveau')).ok, jeu + ' : ancien format');
    assert.ok((await poser(salle(jeu, c), salleV2(jeu, 'nouveau'), 'nouveau')).ok, jeu + ' : v2');
  }
});

test('ancien format : une salle ancienne qui traîne est gelée (entrée, écritures, reprise, effacement)', async () => {
  for (const jeu of JEUX) {
    const c = code();
    await salleAgee(jeu, c, 'hote', 3600000, { etat: { tour: 1 } });
    assert.ok(!(await fusionner(salle(jeu, c), invite('ami'), 'ami')).ok, jeu + ' : entrée de l\'invité');
    assert.ok(!(await fusionner(salle(jeu, c), { etat: { tour: 2 } }, 'hote')).ok, jeu + ' : écriture de l\'hôte');
    assert.ok(!(await poser(salle(jeu, c) + '/joueurs/hote/enLigne', false, 'hote')).ok, jeu + ' : présence');
    const lu = (await lire(salle(jeu, c))).val;
    assert.ok(!(await poser(salle(jeu, c), lu, 'hote')).ok, jeu + ' : reprise (transaction de salle.js)');
    assert.ok(!(await effacer(salle(jeu, c), 'hote')).ok, jeu + ' : effacement par l\'hôte');
    assert.deepStrictEqual((await lire(salle(jeu, c) + '/etat')).val, { tour: 1 }, jeu + ' : intacte');
  }
});

test('ancien format : le vrai salle.js ne crée plus de salle et n\'entre plus dans une salle ancienne', async () => {
  for (const jeu of JEUX) {
    const h = await client('h-ancien-' + jeu);
    ouverts.push(h);
    await assert.rejects(h.creerSalle(jeu, { etat: { x: 1 } }), /Impossible de créer une salle/, jeu);
    const c = code();
    await salleAgee(jeu, c, 'h-ancien-' + jeu, 1000, { etat: { x: 1 } });
    const a = await client('a-ancien-' + jeu);
    ouverts.push(a);
    await assert.rejects(a.rejoindreSalle(jeu, c), /existe pas|pleine|permission/i, jeu + ' : invité');
    await assert.rejects(h.rejoindreSalle(jeu, c), /existe pas|pleine|permission/i, jeu + ' : reprise de l\'hôte');
    assert.strictEqual((await lire(salle(jeu, c) + '/siege2')).val, null, jeu);
  }
});

test('pas de conversion : ancienne → v2 refusée, v2 → ancienne refusée', async () => {
  const c = code();
  await salleAgee('echecs', c, 'hote', 1000);
  assert.ok(!(await fusionner(salle('echecs', c), { v: 2, siege1: 'hote' }, 'hote')).ok, 'ancienne → v2');
  const c2 = code();
  assert.ok((await poser(salle('backgammon', c2), salleV2('backgammon', 'hote'), 'hote')).ok);
  assert.ok(!(await poser(salle('backgammon', c2), salleNeuve('backgammon', 'hote'), 'hote')).ok, 'v2 → ancienne, par son hôte');
  assert.strictEqual((await lire(salle('backgammon', c2) + '/v')).val, 2);
});
