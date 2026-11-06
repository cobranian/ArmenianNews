// Le manifeste des Reels, src/data/reels.json : { [slug]: { [lang]: { asset, music } } }.
//
// Il fait foi : un Reel n'est publié que s'il y figure (reelItems,
// social.mjs), et Facebook comme Instagram vont chercher la vidéo à
// REEL_BASE + asset, dans la release GitHub `reels-1`. Le MP4 doit donc y être
// AVANT son entrée — c'est l'ordre que suit `npm run reels:add`.
import { readFile } from 'node:fs/promises'

// Le nom du fichier dans la release : les Shorts de toutes les langues y
// partagent un seul dossier, la langue entre donc dans le nom.
export const assetName = (lang, slug) => `${lang}-${slug}.mp4`

// Un manifeste absent vaut « aucun Reel ».
export async function readReels(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return {}
    throw e
  }
}

// Clés triées (slugs, puis langues) : relancer le script ne fait pas bouger
// les lignes du fichier, et un diff ne montre que l'ajout.
function sorted(reels) {
  return Object.fromEntries(
    Object.keys(reels)
      .sort()
      .map((slug) => [slug, Object.fromEntries(Object.keys(reels[slug]).sort().map((l) => [l, reels[slug][l]]))]),
  )
}

// `adds` : [{ slug, lang, asset, music }]. Rend { reels, added } sans muter
// l'entrée. Idempotent : une entrée identique n'est pas recomptée ; une
// musique ou un asset changés la remplacent (le MP4 a été ré-envoyé
// --clobber sous le même nom).
export function addReels(reels, adds) {
  const next = structuredClone(reels ?? {})
  const added = []
  for (const { slug, lang, asset, music } of adds) {
    const want = assetName(lang, slug)
    if (asset !== want) throw new Error(`${slug}/${lang} : asset « ${asset} », attendu « ${want} » (le nom du fichier dans la release reels-1)`)
    if (!music) throw new Error(`${slug}/${lang} : ligne de crédit musique absente`)
    const had = next[slug]?.[lang]
    if (had?.asset === asset && had?.music === music) continue
    ;(next[slug] ??= {})[lang] = { asset, music }
    added.push(`${slug}/${lang}`)
  }
  return { reels: sorted(next), added }
}

// Ce qui part dans la release : ce que le manifeste change, ou — avec
// --force — tout ce qui a été trouvé (un Short re-rendu à musique inchangée
// laisse le manifeste identique mais son MP4 a changé). `added` vient d'addReels.
export function toUpload(found, added, force = false) {
  return force ? found : found.filter((f) => added.includes(`${f.slug}/${f.lang}`))
}
