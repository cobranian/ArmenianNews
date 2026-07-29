/**
 * Bâtit les deux vitrines.
 *
 *   npm run build
 *
 * Un build Vite par site (le bundle diffère par sa langue de démarrage, pas
 * par son code), puis dérivation des pages supplémentaires du .org : /hy/ et
 * /ru/ partagent exactement le bundle de /, seules leurs métadonnées et leur
 * attribut <html lang> changent. Une copie de fichier HTML suffit donc — pas
 * de multi-entrée Rollup, pas d'assets dupliqués.
 *
 * Sortie : dist/ch/ et dist/org/, chacun prêt pour sa cible Firebase.
 */
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// LANGS vient de sites.config.js, PAS de src/i18n.jsx : Node ne sait pas
// parser .jsx (ERR_UNKNOWN_FILE_EXTENSION), et ce script tourne sous Node.
// C'est la raison pour laquelle la liste a été déplacée à Task 1.
import { SITES, ALL_LANGS, LANGS } from '../sites.config.js'
import { replaceMeta } from './lib/site-meta.mjs'
import { sitemapFor, robotsFor } from './lib/sitemap.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Invariant : chaque langue de l'interface doit vivre à exactement une URL.
// Sans cette assertion, ajouter une cinquième langue à LANGS la rendrait
// traduite partout et joignable nulle part — en silence.
{
  const declared = Object.values(SITES).flatMap((s) => s.pages.map((p) => p.lang))
  const known = LANGS.map((l) => l.code)
  const missing = known.filter((l) => !declared.includes(l))
  const extra = declared.filter((l) => !known.includes(l))
  if (missing.length || extra.length) {
    console.error(
      `sites.config.js et LANGS divergent — sans page : [${missing}] ; sans traduction : [${extra}]`,
    )
    process.exit(1)
  }
  if (new Set(declared).size !== declared.length) {
    console.error(`une langue est servie à deux adresses : [${declared}]`)
    process.exit(1)
  }
  if (declared.length !== ALL_LANGS.length) {
    console.error(`ALL_LANGS (${ALL_LANGS.length}) ne couvre pas les pages (${declared.length})`)
    process.exit(1)
  }
}

// `vite build` dans un processus fils, avec SITE_ID dans son environnement.
// Un processus par site plutôt que l'API JS : la config de Vite est mise en
// cache par processus, et deux builds successifs en lisant une seule ferait
// produire au second les métadonnées du premier — silencieusement.
function viteBuild(siteId) {
  const outDir = path.join('dist', siteId)
  console.log(`\n▸ build ${siteId} → ${outDir}`)
  const res = spawnSync(
    process.execPath,
    [path.join('node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', outDir, '--emptyOutDir'],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, SITE_ID: siteId, VITE_SITE_ID: siteId },
    },
  )
  if (res.status !== 0) {
    console.error(`build ${siteId} en échec (code ${res.status})`)
    process.exit(res.status ?? 1)
  }
}

// Les pages non-racine d'un site : même bundle, métadonnées régénérées.
//
// On repart du HTML BÂTI (dist/<id>/index.html), pas du HTML source : lui seul
// porte les hachages d'assets posés par Vite. C'est pour cela que le bloc de
// métadonnées est encadré de sentinelles — replaceMeta échange ce qu'il y a
// entre elles sans toucher au reste. Rebâtir une fois par page coûterait deux
// builds Vite de plus pour un résultat identique.
async function derivePages(site) {
  const dist = path.join(root, 'dist', site.id)
  const built = await readFile(path.join(dist, 'index.html'), 'utf-8')

  for (const page of site.pages) {
    if (page.path === '/') continue
    const dir = path.join(dist, page.path.replace(/^\/|\/$/g, ''))
    await mkdir(dir, { recursive: true })
    const html = replaceMeta(built, { siteId: site.id, lang: page.lang })
    await writeFile(path.join(dir, 'index.html'), html, 'utf-8')
    console.log(`  → dist/${site.id}${page.path}index.html (${page.lang})`)
  }
}

// Pages autonomes : un HTML complet par vitrine, hors du bundle React (carte de
// liens à partager sur les réseaux, etc.). Une par site et par langue :
// `pages/<nom>.<siteId>.html` → `dist/<siteId>/<nom>.html`.
//
// ELLES NE PEUVENT PAS VIVRE DANS public/. Vite copie ce dossier tel quel dans
// les DEUX dist/, donc la carte française atterrirait aussi sur
// armenianews.org — une page en français, sous un domaine anglais, que rien ne
// signalerait. C'est exactement le piège de la carte de partage (og:image)
// avant qu'elle ne devienne propre à chaque vitrine.
//
// L'absence du fichier est une ERREUR DURE, pas un avertissement : une carte
// manquante se déploierait en silence, et Firebase répondrait à son URL par
// index.html en 200 — donc l'application entière au lieu d'un 404 franc.
const STANDALONE = ['lien']

async function copyStandalone(site) {
  for (const name of STANDALONE) {
    const src = path.join(root, 'pages', `${name}.${site.id}.html`)
    const dst = path.join(root, 'dist', site.id, `${name}.html`)
    try {
      await copyFile(src, dst)
    } catch {
      console.error(`pages/${name}.${site.id}.html introuvable — build interrompu.`)
      process.exit(1)
    }
    console.log(`  → dist/${site.id}/${name}.html`)
  }
}

// lastmod = l'horodatage du dernier SCRAPE, jamais celui du build.
// Voir l'avertissement en tête de scripts/lib/sitemap.mjs.
async function lastmod() {
  try {
    const meta = JSON.parse(await readFile(path.join(root, 'src/data/meta.json'), 'utf-8'))
    if (meta.generatedAt) return meta.generatedAt
    console.error('src/data/meta.json ne porte pas de generatedAt.')
  } catch {
    console.error('src/data/meta.json introuvable ou illisible.')
  }
  // Échec dur plutôt que sitemaps absents en silence : sans generatedAt on ne
  // peut pas dater les sitemaps, et un déploiement sans sitemap ne se voit que
  // des semaines plus tard, dans Search Console. `npm run scrape` régénère
  // meta.json ; il est aussi versionné, donc un dépôt sain en a toujours un.
  console.error('Impossible de dater les sitemaps — build interrompu.')
  process.exit(1)
}

async function writeSeoFiles(site, stamp) {
  const dist = path.join(root, 'dist', site.id)
  await writeFile(path.join(dist, 'sitemap.xml'), sitemapFor(site.id, stamp), 'utf-8')
  console.log(`  → dist/${site.id}/sitemap.xml`)
  await writeFile(path.join(dist, 'robots.txt'), robotsFor(site.id), 'utf-8')
  console.log(`  → dist/${site.id}/robots.txt`)
}

const stamp = await lastmod()

for (const site of Object.values(SITES)) {
  viteBuild(site.id)
  await derivePages(site)
  await copyStandalone(site)
  await writeSeoFiles(site, stamp)
}

console.log(
  `\n✓ ${Object.keys(SITES).length} vitrines bâties : ` +
    Object.values(SITES)
      .map((s) => `${s.id} (${s.pages.map((p) => p.lang).join('/')})`)
      .join(', '),
)
