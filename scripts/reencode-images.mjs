/**
 * LOCAL-ONLY : ré-encode en WebP les images DÉJÀ bundlées.
 *
 * Aucun accès réseau. Les images sont sur le disque ; re-récolter 1 448 posts
 * prendrait des heures et risquerait un blocage Instagram pour des fichiers
 * qu'on possède déjà.
 *
 * Ce script n'est PAS un jetable. Le jour où la cible change — 640px si le
 * poids redevient un souci, 1040 si l'audience passe au bureau — c'est lui
 * qu'on relance.
 *
 *   node scripts/reencode-images.mjs --dry              # compte et pèse, n'écrit rien
 *   node scripts/reencode-images.mjs --sample <dossier> # écrit ailleurs, ne touche à rien
 *   node scripts/reencode-images.mjs                    # convertit sur place
 *   node scripts/reencode-images.mjs --width 640 --quality 75
 *
 * Il traite les `.webp` autant que les `.jpg`, et c'est délibéré. Écrit pour les
 * seuls JPEG il serait idempotent — agréable — mais INUTILISABLE une seconde
 * fois : après la migration il ne reste plus un seul `.jpg`, et le relancer à
 * 640 ne ferait rien du tout, en silence.
 *
 * Deux conséquences assumées. Un second passage ré-encode du WebP vers du WebP
 * et perd donc un peu de qualité : acceptable pour un changement de cible
 * délibéré, pas pour une routine. Et `encode()` n'agrandissant jamais, relancer
 * à 1040 après une migration à 800 NE REND PAS les pixels perdus — il faudrait
 * re-récolter. Ce script réduit, il ne restaure pas.
 */
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TARGET_QUALITY, TARGET_WIDTH, encode } from './lib/image.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const DRY = process.argv.includes('--dry')
const opt = (nom) => {
  const i = process.argv.indexOf(`--${nom}`)
  return i === -1 ? null : process.argv[i + 1]
}
const nombre = (nom, def) => {
  const v = opt(nom)
  if (v === null) return def
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) {
    console.log(`✗ --${nom} attend un nombre positif, reçu « ${v} »`)
    process.exit(1)
  }
  return n
}

const WIDTH = nombre('width', TARGET_WIDTH)
const QUALITY = nombre('quality', TARGET_QUALITY)
const LIMIT = nombre('limit', Infinity)
const SAMPLE = opt('sample')

const IMAGE = /\.(jpe?g|png|webp)$/i
const DOSSIERS = ['src/data/ig', 'src/data/fb']

console.log(
  `→ cible ${WIDTH}px q${QUALITY}${DRY ? ' (à sec)' : ''}${SAMPLE ? ` → ${SAMPLE}` : ''}`,
)

let avant = 0
let apres = 0
let n = 0
let echecs = 0

for (const rel of DOSSIERS) {
  const dir = path.join(root, rel)
  const fichiers = (await readdir(dir)).filter((f) => IMAGE.test(f)).sort()
  const aFaire = fichiers.slice(0, LIMIT === Infinity ? undefined : LIMIT)
  console.log(`\n${rel} : ${aFaire.length}/${fichiers.length} fichier(s)`)

  const sortie = SAMPLE ? path.join(root, SAMPLE, path.basename(rel)) : dir
  if (SAMPLE) await mkdir(sortie, { recursive: true })

  for (const f of aFaire) {
    const src = path.join(dir, f)
    const cible = path.join(sortie, f.replace(IMAGE, '.webp'))
    try {
      const buf = await readFile(src)
      const out = await encode(buf, { width: WIDTH, quality: QUALITY })
      avant += buf.length
      apres += out.length
      n++
      if (DRY) continue
      await writeFile(cible, out)
      // Ne supprimer que si on a bien écrit AILLEURS que sur la source : en mode
      // --sample l'original ne doit pas bouger, et une conversion sur place a
      // déjà écrasé le fichier quand les deux noms coïncident (.webp → .webp).
      if (!SAMPLE && path.resolve(cible) !== path.resolve(src)) await unlink(src)
    } catch (err) {
      echecs++
      console.log(`  ✗ ${f} : ${err.message} — laissé tel quel`)
    }
  }
}

const mo = (b) => (b / 1048576).toFixed(1)
console.log(`\n${n} image(s) encodée(s)${echecs ? `, ${echecs} échec(s)` : ''}`)
console.log(`  avant : ${mo(avant)} Mo  (moyenne ${(avant / n / 1024).toFixed(0)} ko)`)
console.log(`  après : ${mo(apres)} Mo  (moyenne ${(apres / n / 1024).toFixed(0)} ko)`)
console.log(`  réduction : ${(100 - (100 * apres) / avant).toFixed(1)} %`)

// facebook.json se clave sur le NOM DE FICHIER complet (Social.jsx : `fbImg[p.image]`),
// contrairement au pool Instagram qui se clave sur le shortcode. Renommer les
// fichiers sans réécrire ce champ laisserait les dix-huit tuiles Facebook
// retomber sur leur motif — un JSON valide, un mur muet, et rien pour le dire.
if (!DRY && !SAMPLE) {
  const P = path.join(root, 'src/data/facebook.json')
  const fb = JSON.parse(await readFile(P, 'utf-8'))
  let touches = 0
  fb.posts = fb.posts.map((p) => {
    if (!p.image || !IMAGE.test(p.image) || p.image.endsWith('.webp')) return p
    touches++
    return { ...p, image: p.image.replace(IMAGE, '.webp') }
  })
  await writeFile(P, JSON.stringify(fb, null, 2) + '\n')
  console.log(`✓ facebook.json : ${touches} champ(s) image mis à jour`)

  // Le fichier annoncé doit exister sur le disque. C'est le seul contrôle qui
  // attrape un renommage à moitié fait.
  let manquants = 0
  for (const p of fb.posts) {
    if (!p.image) continue
    try {
      await stat(path.join(root, 'src/data/fb', p.image))
    } catch {
      manquants++
      console.log(`  ✗ ${p.image} annoncé par facebook.json, absent de src/data/fb/`)
    }
  }
  if (manquants) {
    console.log(`✗ ${manquants} image(s) annoncée(s) et absente(s) — le mur Facebook serait troué`)
    process.exit(1)
  }
}
