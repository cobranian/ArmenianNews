#!/usr/bin/env node
// npm run jeux:sync — recopie les jeux de Games/ et la couche de salles de
// lokolok dans public/play/, avec les quatre transformations de
// scripts/lib/jeux-sync.mjs, puis écrit public/play/retour.js.
//
// ÉTAPE MANUELLE LOCALE, jamais en CI : Games/ et lokolok sont d'autres
// dépôts. Une mise à jour d'un jeu n'arrive ici que par ce script, suivi d'un
// commit qui cite les commits copiés (affichés à la fin).
//
//   Games/Chess          → public/play/echecs/
//   Games/Backgammon     → public/play/backgammon/
//   lokolok/assets/net/  → public/play/net/   (sauf config.js et classement.js)
//
// public/play/net/config.js est PROPRE à Arménie Info : jamais écrasé ni
// effacé. public/play/vignettes/ n'est pas touché.
//
// Les sources se trouvent à côté du dépôt PRINCIPAL (pas du worktree) :
// <parent de .git commun>/Games et /lokolok. Surcharges : JEUX_GAMES_DIR
// (dossier qui contient Chess/ et Backgammon/) et JEUX_LOKOLOK_DIR.
import { execFileSync } from 'node:child_process'
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APPLIQUER_JS, EXCLUS, retourJs, retourTable, transformer } from './lib/jeux-sync.mjs'

if (process.env.CI) {
  console.error('jeux:sync refuse de tourner en CI : il lit Games/ et lokolok, deux autres dépôts '
    + 'absents du runner. Lancez-le à la main, au poste, puis committez public/play/.')
  process.exit(1)
}

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLAY = join(RACINE, 'public', 'play')

function dossierCommun() {
  const gitDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: RACINE, encoding: 'utf-8',
  }).trim()
  // <...>/ArmenianNews/.git → <...>
  return dirname(dirname(gitDir))
}

const voisins = process.env.JEUX_GAMES_DIR && process.env.JEUX_LOKOLOK_DIR ? null : dossierCommun()
const GAMES = resolve(process.env.JEUX_GAMES_DIR || join(voisins, 'Games'))
const LOKOLOK = resolve(process.env.JEUX_LOKOLOK_DIR || join(voisins, 'lokolok'))

const exclu = (nom) => EXCLUS.some((r) => r.test(nom))

// Copie récursive : les .js et .html passent par transformer(), le reste
// (polices, CSS) est copié octet pour octet.
function copier(src, dst, rel, saute = () => false) {
  mkdirSync(dst, { recursive: true })
  let n = 0
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (exclu(e.name) || saute(e.name)) continue
    const s = join(src, e.name)
    const d = join(dst, e.name)
    const r = `${rel}/${e.name}`
    if (e.isDirectory()) n += copier(s, d, r)
    else if (/\.(js|html)$/.test(e.name)) {
      writeFileSync(d, transformer(r, readFileSync(s, 'utf-8')))
      n++
    } else {
      copyFileSync(s, d)
      n++
    }
  }
  return n
}

// Le dernier commit qui touche CE dossier : Games/ et lokolok/ vivent dans un
// même dépôt parent, dont le HEAD ne dirait rien de la version d'un jeu.
function commit(dir) {
  try {
    const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf-8' }).trim()
    return git('log', '-1', '--format=%h', '--', '.') + (git('status', '--porcelain', '.') ? ' (+ modifs non committées)' : '')
  } catch {
    return '?'
  }
}

// Tout est vérifié AVANT d'effacer quoi que ce soit.
const JEUX = [
  { slug: 'echecs', src: join(GAMES, 'Chess') },
  { slug: 'backgammon', src: join(GAMES, 'Backgammon') },
]
const NET = join(LOKOLOK, 'assets', 'net')
const NET_ATTENDUS = ['salle.js', 'salle2.js', 'protocole.js', 'journal.js', 'messages.js', 'qrcode.js']
for (const j of JEUX) {
  if (!existsSync(join(j.src, 'index.html'))) {
    console.error(`jeux:sync — pas d'index.html dans ${j.src} (JEUX_GAMES_DIR ?)`)
    process.exit(1)
  }
}
for (const f of NET_ATTENDUS) {
  if (!existsSync(join(NET, f))) {
    console.error(`jeux:sync — ${f} manque dans ${NET} (JEUX_LOKOLOK_DIR ?)`)
    process.exit(1)
  }
}

// Les jeux.
for (const j of JEUX) {
  const dst = join(PLAY, j.slug)
  rmSync(dst, { recursive: true, force: true })
  const n = copier(j.src, dst, j.slug)
  if (j.slug === 'echecs') writeFileSync(join(dst, 'js', 'appliquer.js'), APPLIQUER_JS)
  console.log(`jeux:sync — ${j.slug} ← ${j.src} (${n} fichiers)`)
}

// La couche net, sans config.js (le nôtre reste) ni classement.js.
const netDst = join(PLAY, 'net')
mkdirSync(netDst, { recursive: true })
for (const e of readdirSync(netDst)) if (e !== 'config.js') rmSync(join(netDst, e), { recursive: true, force: true })
const nNet = copier(NET, netDst, 'net', (nom) => nom === 'config.js' || nom === 'classement.js')
for (const f of readdirSync(netDst)) {
  if (f !== 'config.js' && !NET_ATTENDUS.includes(f)) console.warn(`jeux:sync — net/${f} est nouveau : vérifier qu'il doit partir en ligne.`)
}
if (!existsSync(join(netDst, 'config.js'))) {
  console.warn('jeux:sync — public/play/net/config.js manque : le mode ami refusera de se connecter (voir README).')
}
console.log(`jeux:sync — net ← ${NET} (${nNet} fichiers)`)

writeFileSync(join(PLAY, 'retour.js'), retourJs(retourTable()))
console.log('jeux:sync — retour.js écrit')

console.log(`\nÀ citer dans le message de commit : Games ${commit(GAMES)} (Chess ${commit(JEUX[0].src)}, `
  + `Backgammon ${commit(JEUX[1].src)}), lokolok ${commit(LOKOLOK)} (assets/net ${commit(NET)}).`)
