/**
 * Recopie les vignettes d'une source sur NOS domaines, au moment du scrape.
 *
 * Pourquoi : depuis le 17 octobre 2026, thecaliforniacourier.com sert ses
 * images derrière un défi Cloudflare (`cf-mitigated: challenge`, 403) à tout
 * navigateur — et à wsrv.nl, et au CDN de WordPress (i0.wp.com). Une balise
 * <img> ne résout pas un défi : chaque carte retombait sur son motif. Les IP
 * des runners GitHub, elles, reçoivent l'image en 200 (sonde diag.yml). Le
 * seul chemin est donc de la télécharger dans la CI et de la servir nous-mêmes.
 *
 * Les fichiers vivent dans `public/<dossier>/`, commités par le job horaire :
 * un push sur `main` rebâtit SANS scraper, et des images générées au seul
 * scrape disparaîtraient au déploiement suivant.
 *
 * Depuis un poste résidentiel, le téléchargement échoue (même défi) : un scrape
 * local garde donc les images déjà recopiées et met `null` aux nouvelles —
 * la carte prend son motif, rien ne casse.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { UA } from './http.mjs'

// Nom stable dérivé de l'URL d'origine : une image déjà recopiée n'est jamais
// re-téléchargée, et deux articles qui partagent une vignette partagent le fichier.
export function mirrorName(url) {
  return `${createHash('sha1').update(url).digest('hex').slice(0, 16)}.webp`
}

async function fetchImage(url, timeout = 20000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // Un défi Cloudflare répond en text/html : sans ce contrôle, la page
    // HTML partirait au décodage et l'erreur parlerait de format, pas de blocage.
    const type = res.headers.get('content-type') || ''
    if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'no content-type'})`)
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Remplace `image` (URL distante) par `/<dossier>/<nom>.webp` sur chaque
 * article. Une URL déjà locale (article resservi par le backfill) est laissée
 * telle quelle. Un échec met `image: null` — jamais l'URL distante, qui ne
 * s'affiche plus chez personne.
 *
 * `encode` est passé par l'appelant (scripts/lib/image.mjs) : c'est aussi lui
 * qui VALIDE l'image — sharp refuse de décoder ce qui n'en est pas une.
 */
export async function mirrorImages(articles, { dir, prefix, encode, width = 640, fetchImg = fetchImage, log = console }) {
  mkdirSync(dir, { recursive: true })
  let copied = 0
  let failed = 0
  for (const a of articles) {
    if (!a?.image || !/^https?:\/\//.test(a.image)) continue
    const name = mirrorName(a.image)
    const file = join(dir, name)
    if (!existsSync(file)) {
      try {
        writeFileSync(file, await encode(await fetchImg(a.image), { width }))
        copied++
      } catch (err) {
        log.warn(`  ✗ image ${a.image}: ${err.message}`)
        a.image = null
        failed++
        continue
      }
    }
    a.image = `${prefix}${name}`
  }
  return { copied, failed }
}

// Supprime les fichiers du dossier qu'aucun article ne référence plus — sans
// quoi `public/<dossier>/` grossirait à chaque article, et partirait en entier
// dans les deux dist/ à chaque déploiement.
export function pruneMirror(articles, { dir, prefix }) {
  if (!existsSync(dir)) return 0
  const keep = new Set(
    articles
      .map((a) => a?.image)
      .filter((u) => typeof u === 'string' && u.startsWith(prefix))
      .map((u) => u.slice(prefix.length)),
  )
  let removed = 0
  for (const f of readdirSync(dir))
    if (!keep.has(f)) {
      unlinkSync(join(dir, f))
      removed++
    }
  return removed
}
