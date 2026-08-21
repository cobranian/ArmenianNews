/**
 * Auto-héberge les polices du site — à l'IDENTIQUE de ce que Google Fonts
 * servait.
 *
 *   npm run fonts-sync        # local, réseau ; à relancer si FONTS_CSS2 change
 *
 * Pourquoi. La feuille `fonts.googleapis.com/css2?…` était une ressource
 * BLOQUANTE et cross-origin : DNS + TLS + aller-retour avant le premier rendu,
 * puis les .woff2 depuis un second hôte. Lighthouse mobile lui imputait
 * ~800 ms sur l'accueil (mesuré le 21 août 2026 : premier rendu à 1,7 s même
 * JavaScript désactivé). Servies depuis le domaine, les polices partent sur la
 * connexion déjà ouverte, et les deux ou trois fichiers du premier écran
 * peuvent être préchargés par langue (scripts/lib/site-meta.mjs).
 *
 * Ce que fait ce script. Il demande la feuille à Google avec un UA Chrome (la
 * même que le navigateur recevait), télécharge chaque .woff2 unique dans
 * public/fonts/, et réécrit src/styles/fonts.css avec les MÊMES blocs
 * @font-face (famille, style, graisse, unicode-range, font-display: swap),
 * pointés vers /fonts/. Les glyphes sont donc strictement ceux d'avant : seul
 * le chemin change. Il écrit aussi src/styles/fonts.json, le manifeste que
 * site-meta.mjs lit pour choisir les fichiers à précharger par langue.
 *
 * À NE PAS FAIRE : éditer fonts.css à la main (il est régénéré), ou remettre le
 * <link> Google dans index.html « pour une famille de plus » — ajoutez-la à
 * FONTS_CSS2 et relancez. Les fichiers sont versionnés par Google (v38…) et
 * nommés d'après l'identifiant de leur URL : un changement de version chez
 * Google donne un nouveau nom, jamais un fichier écrasé en silence.
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(root, 'public', 'fonts')
const CSS_OUT = path.join(root, 'src', 'styles', 'fonts.css')
const MANIFEST_OUT = path.join(root, 'src', 'styles', 'fonts.json')

// Le casting — trois rôles × trois écritures — est documenté dans
// src/styles/global.css (section « Familles ») et dans CLAUDE.md. Ici, juste
// la liste des fichiers à obtenir : familles, axes et graisses utilisés.
export const FONTS_CSS2 =
  'https://fonts.googleapis.com/css2' +
  '?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,600' +
  '&family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400' +
  '&family=Space+Mono:ital,wght@0,400;0,700;1,400' +
  '&family=Noto+Serif+Armenian:wght@400;500;600;700' +
  '&family=Noto+Sans+Armenian:wght@400;500;600;700' +
  '&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700' +
  '&family=Golos+Text:wght@400..700' +
  '&family=IBM+Plex+Mono:ital,wght@0,400;0,700;1,400' +
  '&display=swap'

// Un UA de Chrome récent : Google sert alors des woff2 découpés par
// unicode-range, avec les axes variables. Un UA inconnu reçoit du TTF entier.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Analyse les blocs « /* subset */ @font-face { … } » de la feuille Google.
export function parseGoogleCss(css) {
  return [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([\s\S]*?)\}/g)].map((m) => {
    const body = m[2]
    const get = (re) => body.match(re)?.[1]?.trim()
    const block = {
      subset: m[1],
      family: get(/font-family: '([^']+)'/),
      style: get(/font-style: (\w+)/),
      weight: get(/font-weight: ([^;]+)/),
      stretch: get(/font-stretch: ([^;]+)/),
      src: get(/url\(([^)]+)\)/),
      range: get(/unicode-range: ([^;]+)/),
    }
    for (const k of ['family', 'style', 'weight', 'src', 'range']) {
      if (!block[k]) throw new Error(`bloc @font-face incomplet (${k}) : ${body.slice(0, 120)}`)
    }
    return block
  })
}

// Nom local d'un fichier : famille lisible + identifiant Google (stable par
// version de police), pour qu'un même fichier partagé par plusieurs graisses
// ne soit téléchargé qu'une fois.
export function localName(block) {
  const id = block.src.split('/').pop().replace(/\.woff2$/, '')
  return `${slug(block.family)}-${id}.woff2`
}

export function renderCss(blocks) {
  const lines = [
    '/* GÉNÉRÉ par scripts/fonts-sync.mjs — ne pas éditer à la main.',
    '   Les mêmes @font-face que servait Google Fonts pour FONTS_CSS2, fichiers',
    '   auto-hébergés dans public/fonts/. Voir le commentaire du script. */',
    '',
  ]
  for (const b of blocks) {
    lines.push(
      `/* ${b.family} ${b.style} ${b.weight} — ${b.subset} */`,
      '@font-face {',
      `  font-family: '${b.family}';`,
      `  font-style: ${b.style};`,
      `  font-weight: ${b.weight};`,
      ...(b.stretch ? [`  font-stretch: ${b.stretch};`] : []),
      '  font-display: swap;',
      `  src: url(/fonts/${localName(b)}) format('woff2');`,
      `  unicode-range: ${b.range};`,
      '}',
      '',
    )
  }
  return lines.join('\n')
}

// Le manifeste : un fichier par entrée, avec la famille, le style, le
// sous-ensemble et les graisses qu'il sert — ce que site-meta.mjs lit pour
// précharger le premier écran de chaque langue. Une police variable (Fraunces,
// Hanken…) sert toutes ses graisses depuis UN fichier ; une police statique
// (Space Mono, IBM Plex Mono) en a un par graisse. D'où la clé sur le fichier,
// pas sur le triplet famille/style/sous-ensemble.
export function renderManifest(blocks) {
  const files = {}
  for (const b of blocks) {
    const file = localName(b)
    files[file] ??= { family: b.family, style: b.style, subset: b.subset, weights: [], file }
    if (!files[file].weights.includes(b.weight)) files[file].weights.push(b.weight)
  }
  return { source: FONTS_CSS2, fonts: Object.values(files) }
}

async function main() {
  console.log('▸ feuille Google Fonts…')
  const res = await fetch(FONTS_CSS2, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`Google Fonts : ${res.status}`)
  const blocks = parseGoogleCss(await res.text())
  const unique = new Map(blocks.map((b) => [b.src, b]))
  console.log(`  ${blocks.length} @font-face, ${unique.size} fichiers uniques`)

  await mkdir(OUT_DIR, { recursive: true })
  // On repart d'un dossier vide : un fichier d'une ancienne version de police
  // resterait sinon dans public/ (donc dans les deux dist/) sans être référencé.
  for (const f of await readdir(OUT_DIR)) if (f.endsWith('.woff2')) await rm(path.join(OUT_DIR, f))

  let total = 0
  for (const b of unique.values()) {
    const r = await fetch(b.src, { headers: { 'user-agent': UA } })
    if (!r.ok) throw new Error(`${b.src} : ${r.status}`)
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 1000) throw new Error(`${b.src} : ${buf.length} octets, pas une police`)
    await writeFile(path.join(OUT_DIR, localName(b)), buf)
    total += buf.length
    process.stdout.write('.')
  }
  console.log(`\n  ${(total / 1024).toFixed(0)} ko dans public/fonts/`)

  await writeFile(CSS_OUT, renderCss(blocks), 'utf-8')
  await writeFile(MANIFEST_OUT, JSON.stringify(renderManifest(blocks), null, 2) + '\n', 'utf-8')
  console.log(`  → src/styles/fonts.css (${blocks.length} blocs), src/styles/fonts.json`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
