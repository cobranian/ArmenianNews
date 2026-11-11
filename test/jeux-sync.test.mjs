import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EXCLUS,
  transformer,
  retourTable,
  retourCible,
  retourJs,
  choisirCoin,
} from '../scripts/lib/jeux-sync.mjs'

// La copie des jeux (npm run jeux:sync). Ce qu'aucun autre contrôle ne
// verrait : une copie qui importe encore /assets/net/ (le multijoueur ne
// charge rien, en silence), un script en ligne que la CSP bloque (l'interface
// des échecs jamais traduite, en silence), un bouton de retour dont la table
// a dérivé de sites.config.js (un 404 au retour), et un motif disparu de
// Games/ que le sync aurait recopié tel quel.

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const PLAY = join(RACINE, 'public', 'play')

function fichiers(dir) {
  const out = []
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom)
    if (statSync(p).isDirectory()) out.push(...fichiers(p))
    else out.push(p)
  }
  return out
}

const ECHECS_INDEX = [
  '<!doctype html>',
  '<html lang="fr">',
  '<head>',
  '  <link rel="stylesheet" href="css/style.css">',
  '  <script src="/assets/stats.js"></script>',
  '  <script src="js/i18n.js"></script>',
  '</head>',
  '<body>',
  '  <main id="page"></main>',
  '  <script>LokoI18n.appliquer();</script>',
  '  <script type="module" src="js/main.js"></script>',
  '</body>',
  '</html>',
].join('\r\n')

test('EXCLUS reprend la liste de lokolok/sync-games.js', () => {
  const exclu = (n) => EXCLUS.some((r) => r.test(n))
  for (const n of ['README.md', 'docs', 'tests', 'tools', 'test.html', 'tests.html',
    'test.robot.js', 'aide-salle.js', 'original.html', 'package.json',
    'package-lock.json', '.git', '.gitignore', 'node_modules', 'foot.exe', 'x.swf']) {
    assert.ok(exclu(n), `${n} devrait être exclu`)
  }
  for (const n of ['index.html', 'main.js', 'i18n.js', 'style.css', 'polices.css', 'worker.js']) {
    assert.ok(!exclu(n), `${n} ne devrait pas être exclu`)
  }
})

test('transformer : index.html des échecs, les 4 transformations', () => {
  const out = transformer('echecs/index.html', ECHECS_INDEX)
  assert.ok(!out.includes('/assets/stats.js'), 'stats.js retiré')
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(out), 'plus aucun script en ligne')
  assert.ok(out.includes('<script src="js/appliquer.js"></script>'))
  // La position est gardée : après le contenu, avant le module principal.
  assert.ok(out.indexOf('js/appliquer.js') > out.indexOf('<main'))
  assert.ok(out.indexOf('js/appliquer.js') < out.indexOf('js/main.js'))
  assert.match(out, /<script src="\/play\/retour\.js" defer><\/script>\r?\n<\/body>/)
  // Pas de ligne vide laissée par le retrait.
  assert.ok(!/\n[ \t]*\r?\n[ \t]*<script src="js\/i18n/.test(out))
})

test('transformer : /assets/net/ devient /play/net/', () => {
  const src = "const Net = await import('/assets/net/salle2.js');\n"
  assert.equal(transformer('echecs/js/main.js', src), "const Net = await import('/play/net/salle2.js');\n")
  assert.equal(
    transformer('net/salle.js', "s.src = '/assets/net/qrcode.js';"),
    "s.src = '/play/net/qrcode.js';",
  )
})

test('transformer : un motif attendu absent fait ÉCHOUER le sync', () => {
  assert.throws(() => transformer('echecs/js/main.js', 'const x = 1;\n'), /assets\/net/)
  assert.throws(() => transformer('backgammon/js/main.js', 'const x = 1;\n'), /assets\/net/)
  assert.throws(() => transformer('net/salle.js', 'export {}\n'), /assets\/net/)
  const sansStats = ECHECS_INDEX.replace(/.*assets\/stats\.js.*\r\n/, '')
  assert.throws(() => transformer('echecs/index.html', sansStats), /stats\.js/)
  const sansAppliquer = ECHECS_INDEX.replace('<script>LokoI18n.appliquer();</script>', '')
  assert.throws(() => transformer('echecs/index.html', sansAppliquer), /appliquer/)
  const sansBody = ECHECS_INDEX.replace('</body>', '')
  assert.throws(() => transformer('echecs/index.html', sansBody), /body/)
  // Un nouveau script en ligne (dans n'importe quel jeu) serait bloqué par la CSP.
  const enLigne = ECHECS_INDEX.replace('</main>', '</main>\r\n  <script>autre();</script>')
  assert.throws(() => transformer('echecs/index.html', enLigne), /en ligne/)
})

test('transformer : un fichier sans obligation passe tel quel', () => {
  assert.equal(transformer('echecs/js/rules.js', 'const a = 1;\n'), 'const a = 1;\n')
  assert.equal(transformer('echecs/css/style.css', 'a{}'), 'a{}')
})

test('retourTable : une entrée par langue, tirée de sites.config.js', () => {
  const t = retourTable()
  assert.deepEqual(Object.keys(t).sort(), ['de', 'en', 'es', 'fr', 'hy', 'it', 'ru'])
  assert.deepEqual(t.fr.host, 'https://armenieinfo.ch')
  assert.deepEqual(t.fr.path, '/jeux/')
  assert.deepEqual(t.hy.host, 'https://armenianews.org')
  assert.deepEqual(t.hy.path, '/hy/games/')
  for (const e of Object.values(t)) assert.ok(e.label && e.label.length > 3)
  assert.equal(t.fr.label, 'Retour à Arménie Info')
})

test('retourCible : chemin sur sa vitrine, URL absolue ailleurs, langue de tête hors des 7', () => {
  const t = retourTable()
  assert.equal(retourCible(t, { lang: 'fr', hostname: 'armenieinfo.ch' }), '/jeux/')
  assert.equal(retourCible(t, { lang: 'fr', hostname: 'armenianews.org' }), 'https://armenieinfo.ch/jeux/')
  assert.equal(retourCible(t, { lang: 'pt', hostname: 'armenianews.org' }), '/games/')
  assert.equal(retourCible(t, { lang: 'hy', hostname: 'localhost' }), '/hy/games/')
  assert.equal(retourCible(t, { lang: 'de', hostname: '127.0.0.1' }), '/de/spiele/')
  assert.equal(retourCible(t, { lang: 'pt', hostname: 'armenieinfo.ch' }), '/jeux/')
  assert.equal(retourCible(t, { lang: 'en', hostname: 'armenieinfo.ch' }), 'https://armenianews.org/games/')
  assert.equal(retourCible(t, { lang: 'zh-Hans', hostname: 'www.armenianews.org' }), '/games/')
  assert.equal(retourCible(t, { lang: 'ru', hostname: 'www.armenianews.org' }), '/ru/games/')
  // Hôte inconnu (préversion Firebase…) : jamais un chemin qui y ferait 404.
  assert.equal(retourCible(t, { lang: 'it', hostname: 'armenie-info.web.app' }), 'https://armenieinfo.ch/it/giochi/')
  assert.equal(retourCible(t, { lang: '', hostname: 'exemple.test' }), 'https://armenieinfo.ch/jeux/')
})

// Coins : 0 haut-gauche, 1 haut-droit, 2 bas-gauche, 3 bas-droit.
test('choisirCoin : premier placement, le premier coin libre', () => {
  assert.equal(choisirCoin([0, 0, 0, 0], -1), 0)
  // Backgammon en paysage : le plateau sous haut-gauche et bas-gauche, le score
  // sous haut-droit (mesuré le 11 nov. 2026).
  assert.equal(choisirCoin([12, 4, 15, 0], -1), 3)
})

test('choisirCoin : le coin actuel resté libre est gardé (pas de saut pendant un tour)', () => {
  // Un coin plus haut dans l'ordre s'est libéré (écran de menu fermé…) : on ne bouge pas.
  assert.equal(choisirCoin([0, 0, 0, 0], 3), 3)
  assert.equal(choisirCoin([0, 5, 0, 0], 2), 2)
})

test('choisirCoin : coin actuel occupé, on part vers un coin libre', () => {
  assert.equal(choisirCoin([12, 0, 15, 6], 3), 1)
  assert.equal(choisirCoin([0, 4, 15, 6], 3), 0)
})

test('choisirCoin : aucun coin libre → le MOINS occupé, jamais haut-gauche d office', () => {
  assert.equal(choisirCoin([12, 4, 15, 6], -1), 1)
  assert.equal(choisirCoin([12, 9, 15, 3], 0), 3)
  assert.equal(choisirCoin([3, 3, 9, 3], -1), 0) // à égalité : le premier
  // Le coin actuel occupé ne gagne pas par inertie s'il est pire qu'un autre.
  assert.equal(choisirCoin([12, 9, 15, 3], 1), 3)
})

test('public/play/retour.js est celui que rend la table courante (garde la dérive)', () => {
  const p = join(PLAY, 'retour.js')
  const src = readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
  const m = src.match(/^ {2}var TABLE = (\{.*\});$/m)
  assert.ok(m, 'table introuvable dans retour.js')
  assert.deepEqual(JSON.parse(m[1]), retourTable())
  assert.equal(src, retourJs(retourTable()), 'retour.js périmé : relancer npm run jeux:sync')
  assert.ok(!src.includes('innerHTML'))
  assert.ok(!/^\s*(import|export)\b/m.test(src), 'script classique, pas un module')
})

test('les fichiers copiés de public/play/ ne visent plus lokolok', () => {
  const tous = fichiers(PLAY).filter((p) => /\.(js|html|css)$/.test(p))
  assert.ok(tous.length > 20, 'public/play/ semble vide : npm run jeux:sync')
  for (const p of tous) {
    const s = readFileSync(p, 'utf-8')
    assert.ok(!s.includes('/assets/net/'), `${p} vise encore /assets/net/`)
    // Les commentaires écrivent « lokolok/assets/stats.js » : seule une
    // référence (attribut ou chaîne) compte.
    assert.ok(!/["'(]\/assets\/stats\.js/.test(s), `${p} charge encore /assets/stats.js`)
  }
})

test('chaque index.html de jeu : retour.js, et aucun script en ligne', () => {
  for (const jeu of ['echecs', 'backgammon']) {
    const s = readFileSync(join(PLAY, jeu, 'index.html'), 'utf-8')
    assert.match(s, /<script src="\/play\/retour\.js" defer><\/script>\s*<\/body>/, jeu)
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(s), `${jeu} a un script en ligne`)
  }
  assert.equal(
    readFileSync(join(PLAY, 'echecs', 'js', 'appliquer.js'), 'utf-8').trim(),
    'LokoI18n.appliquer();',
  )
})

test('la couche net est copiée, sans classement.js, avec SA config', () => {
  for (const f of ['salle.js', 'salle2.js', 'protocole.js', 'journal.js', 'messages.js', 'qrcode.js', 'config.js']) {
    assert.ok(existsSync(join(PLAY, 'net', f)), `net/${f} manque`)
  }
  assert.ok(!existsSync(join(PLAY, 'net', 'classement.js')))
  const config = readFileSync(join(PLAY, 'net', 'config.js'), 'utf-8')
  assert.ok(!config.includes('lokolok-com'))
  assert.ok(config.includes("projectId: 'armenie-info'"))
  // databaseURL vide (premier temps) ou celle du projet armenie-info — jamais
  // celle d'un autre projet, qui mettrait les parties chez le voisin.
  const db = config.match(/databaseURL:\s*'([^']*)'/)
  assert.ok(db, 'databaseURL absent de net/config.js')
  assert.ok(db[1] === '' || db[1].includes('armenie-info'), `databaseURL inattendu : ${db[1]}`)
})

test('aucun fichier de src/ ne référence public/play ni /play/net', () => {
  for (const p of fichiers(join(RACINE, 'src'))) {
    if (!/\.(js|jsx|css)$/.test(p)) continue
    const s = readFileSync(p, 'utf-8')
    assert.ok(!s.includes('public/play'), p)
    assert.ok(!s.includes('/play/net'), p)
  }
})
