// La purge horaire des salles (scripts/salles-purge.mjs) contre l'émulateur :
// les vraies requêtes REST (orderBy creeLe + endAt, shallow, creeLe salle par
// salle, PATCH à null), avec les règles du dépôt — donc avec leur
// `.indexOn`. « Bearer owner » tient lieu du jeton OAuth2 du compte de
// service (administrateur de l'émulateur). Sauté sans émulateur, comme le
// reste de ce dossier.

const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { before } = require('node:test');
const { test, EMU, NS, JOUR, reglesDuDepot, poserRegles, vider, lire, poser, code } = require('./outils.js');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'salles-purge.mjs');
const H = 60 * 60 * 1000;

before(async () => {
  if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) return;
  await poserRegles(reglesDuDepot());
  await vider();
});

const salleV2 = (jeu, creeLe) => ({
  v: 2, jeu, creeLe, siege1: 'hote',
  joueurs: { hote: { siege: 1, pseudo: '', enLigne: true } },
});

// Prépare, pour chaque jeu : une vieille (25 h), une limite (23 h 59), une
// jeune (1 h), une sans creeLe, une à creeLe texte, et un enfant primitif.
async function semer() {
  const maintenant = Date.now();
  const plan = {};
  for (const jeu of ['echecs', 'backgammon']) {
    const p = { vieille: code(), limite: code(), jeune: code(), sans: code(), texte: code(), primitif: code() };
    const ok = async (r) => { if (!r.ok) throw new Error('préparation : ' + JSON.stringify(r.val)); };
    await ok(await poser(`salles/${jeu}/${p.vieille}`, salleV2(jeu, maintenant - 25 * H), 'owner'));
    await ok(await poser(`salles/${jeu}/${p.limite}`, salleV2(jeu, maintenant - JOUR + 60 * 1000), 'owner'));
    await ok(await poser(`salles/${jeu}/${p.jeune}`, salleV2(jeu, maintenant - H), 'owner'));
    const sans = salleV2(jeu, 0); delete sans.creeLe;
    await ok(await poser(`salles/${jeu}/${p.sans}`, sans, 'owner'));
    await ok(await poser(`salles/${jeu}/${p.texte}`, salleV2(jeu, '2026-11-01'), 'owner'));
    await ok(await poser(`salles/${jeu}/${p.primitif}`, 'pas une salle', 'owner'));
    plan[jeu] = p;
  }
  return { maintenant, plan };
}

async function etat(jeu) { return (await lire(`salles/${jeu}`)).val || {}; }

test('purger : efface vieille, sans creeLe et creeLe texte ; garde jeune, 23 h 59 et le primitif', async () => {
  const { purger } = await import(pathToFileURL(SCRIPT).href);
  const { maintenant, plan } = await semer();
  const journal = [];
  const n = await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: (l) => journal.push(l) });
  assert.strictEqual(n, 6, journal.join('\n'));
  for (const [jeu, p] of Object.entries(plan)) {
    const reste = await etat(jeu);
    for (const k of ['vieille', 'sans', 'texte']) assert.ok(!(p[k] in reste), `${jeu} : ${k} non effacée`);
    for (const k of ['limite', 'jeune', 'primitif']) assert.ok(p[k] in reste, `${jeu} : ${k} effacée à tort`);
  }
  // Second passage : plus rien à effacer.
  assert.strictEqual(await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: () => {} }), 0);
  await vider();
});

// Un fetch espion : les URL appelées, dans l'ordre.
function espion() {
  const urls = [];
  const f = (url, init) => { urls.push(`${(init && init.method) || 'GET'} ${new URL(url).pathname}`); return fetch(url, init); };
  return { urls, f };
}

test('purger : aucune salle n’est relue une par une quand l’index est là (jeunes comprises)', async () => {
  const { purger } = await import(pathToFileURL(SCRIPT).href);
  const { maintenant, plan } = await semer();
  const { urls, f } = espion();
  const n = await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: () => {}, fetch: f });
  assert.strictEqual(n, 6);
  assert.ok(urls.length >= 6, 'l’espion n’a rien vu : purger ignore son option fetch');
  const parSalle = urls.filter((u) => /\/creeLe\.json$/.test(u));
  assert.deepStrictEqual(parSalle, [], 'lectures salle par salle : ' + parSalle.join(', '));
  for (const p of Object.values(plan)) {
    assert.ok(!urls.some((u) => u.includes(p.jeune) || u.includes(p.limite)), 'une jeune a été lue à part');
  }
  await vider();
});

test('purger sans index : repli salle par salle, plafonné par passage', async () => {
  const { purger } = await import(pathToFileURL(SCRIPT).href);
  const sansIndex = reglesDuDepot();
  delete sansIndex.rules.salles.$jeu['.indexOn'];
  await poserRegles(sansIndex);
  try {
    const { maintenant, plan } = await semer();
    const journal = [];
    // Plafond de 2 : 5 salles-objets par jeu à relire, 2 seulement par passage.
    const n1 = await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: (l) => journal.push(l), plafond: 2 });
    assert.ok(journal.some((l) => /index creeLe absent/.test(l)), journal.join('\n'));
    assert.ok(journal.some((l) => /restantes au passage suivant/.test(l)), journal.join('\n'));
    assert.ok(n1 <= 4, `plafond dépassé : ${n1} effacées en un passage (2 lectures par jeu au plus)`);
    // Les codes relus sont tirés au hasard : les jeunes, gardées, ne bloquent
    // pas indéfiniment les mêmes places du plafond.
    let total = n1;
    for (let i = 0; i < 60 && total < 6; i++) total += await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: () => {}, plafond: 2 });
    assert.strictEqual(total, 6, 'au fil des passages, les 6 périmées sont effacées');
    for (const [jeu, p] of Object.entries(plan)) {
      const reste = await etat(jeu);
      for (const k of ['limite', 'jeune', 'primitif']) assert.ok(p[k] in reste, `${jeu} : ${k} effacée à tort`);
    }
  } finally {
    await poserRegles(reglesDuDepot());
    await vider();
  }
});

test('le script en ligne de commande : « purge : N salle(s) effacée(s) », code 0', async () => {
  await semer();
  const r = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, SALLES_BASE_URL: 'http://' + EMU, SALLES_NS: NS, SALLES_JETON: 'owner', FIREBASE_SERVICE_ACCOUNT: '' },
  });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^purge : 6 salle\(s\) effacée\(s\)$/m);
  await vider();
});

test('le script en échec : « ✗ purge », code 1, jamais de jeton au log', async () => {
  // L'émulateur prend tout « Bearer » pour un administrateur : l'échec se
  // provoque par une base injoignable (port 1).
  const r = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, SALLES_BASE_URL: 'http://127.0.0.1:1', SALLES_NS: NS, SALLES_JETON: 'jeton-secret-de-test', FIREBASE_SERVICE_ACCOUNT: '' },
  });
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^✗ purge : /m);
  assert.ok(!(r.stdout + r.stderr).includes('jeton-secret-de-test'), 'le jeton a fuité au log');
});
