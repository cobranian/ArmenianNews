// La purge horaire des salles (scripts/salles-purge.mjs) contre l'émulateur :
// les vraies requêtes REST (orderBy creeLe + endAt + limitToFirst, PATCH à
// null ; shallow et creeLe salle par salle dans le seul repli sans index),
// avec les règles du dépôt — donc avec leur
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

// Le creeLe texte (rangé après les nombres) échappe au lot trié : les règles
// imposent un nombre, seul un administrateur peut en écrire un — accepté.
test('purger : efface vieille et sans creeLe ; garde jeune, 23 h 59 et le primitif', async () => {
  const { purger } = await import(pathToFileURL(SCRIPT).href);
  const { maintenant, plan } = await semer();
  const journal = [];
  const n = await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: (l) => journal.push(l) });
  assert.strictEqual(n, 4, journal.join('\n'));
  for (const [jeu, p] of Object.entries(plan)) {
    const reste = await etat(jeu);
    for (const k of ['vieille', 'sans']) assert.ok(!(p[k] in reste), `${jeu} : ${k} non effacée`);
    for (const k of ['limite', 'jeune', 'primitif', 'texte']) assert.ok(p[k] in reste, `${jeu} : ${k} effacée à tort`);
  }
  // Second passage : plus rien à effacer.
  assert.strictEqual(await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: () => {} }), 0);
  await vider();
});

// Un fetch espion : les requêtes, dans l'ordre, et le corps des réponses.
function espion() {
  const urls = [];
  const corps = [];
  const f = async (url, init) => {
    urls.push(`${(init && init.method) || 'GET'} ${new URL(url).pathname}${new URL(url).search}`);
    const res = await fetch(url, init);
    corps.push(await res.clone().text());
    return res;
  };
  return { urls, corps, f };
}

test('purger : les jeunes salles ne sont pas téléchargées quand l’index est là', async () => {
  const { purger } = await import(pathToFileURL(SCRIPT).href);
  const { maintenant, plan } = await semer();
  const { urls, corps, f } = espion();
  const n = await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: () => {}, fetch: f });
  assert.strictEqual(n, 4);
  // Par jeu : un GET trié, un PATCH — ni shallow, ni lecture salle par salle.
  assert.strictEqual(urls.length, 4, urls.join('\n'));
  assert.ok(urls.every((u) => !/shallow|\/creeLe\.json/.test(u)), urls.join('\n'));
  for (const p of Object.values(plan)) {
    for (const c of corps) assert.ok(!c.includes(p.jeune) && !c.includes(p.limite), 'une jeune a été téléchargée');
  }
  await vider();
});

test('purger : lot trié plafonné, la suite au passage suivant', async () => {
  const { purger } = await import(pathToFileURL(SCRIPT).href);
  const { maintenant } = await semer();
  const journal = [];
  // Plafond de 2 : par jeu, le lot rend 2 des 3 premières (sans, primitif, vieille).
  const n1 = await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: (l) => journal.push(l), plafond: 2 });
  assert.ok(journal.some((l) => /plafond de 2 salles atteint/.test(l)), journal.join('\n'));
  assert.ok(n1 <= 4, `plafond dépassé : ${n1}`);
  let total = n1;
  for (let i = 0; i < 5 && total < 4; i++) total += await purger({ base: 'http://' + EMU, ns: NS, jeton: 'owner', maintenant, journal: () => {}, plafond: 2 });
  assert.strictEqual(total, 4, 'au fil des passages, les 4 périmées sont effacées');
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
    // Relues une par une, les salles à creeLe texte sont effacées aussi (6).
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
  assert.match(r.stdout, /^purge : 4 salle\(s\) effacée\(s\)$/m);
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
