// Les images Instagram que le bundle EMBARQUE : celles des posts du tirage
// (instagram-feed.json), pas tout src/data/ig/.
//
// Social.jsx les chargeait par un `import.meta.glob` du dossier entier : Vite
// émettait alors chaque fichier dans les deux dist/, qu'une tuile l'affiche ou
// non — 3 734 images, ~238 Mo par vitrine, pour 90 tuiles (25 octobre 2026).
// Le plugin `igFeedImages()` (vite.config.js) sert ce module virtuel à la place.
//
// Le tirage change chaque heure, et chaque build relit le sien : le bundle suit.
// Une image absente du dossier n'est pas importée — sa tuile retombe sur son
// motif, comme avant.

// jpg ET webp, définitivement : un .jpg survivant à une conversion incomplète
// doit encore s'afficher (voir Social.jsx).
export const IG_EXT = /\.(jpg|webp)$/

export const shortcodeOf = (url) => String(url ?? '').match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1] || null

export function feedImageFiles(feed, files) {
  const wanted = new Set((feed?.posts ?? []).map((p) => shortcodeOf(p.url)).filter(Boolean))
  return files.filter((f) => IG_EXT.test(f) && wanted.has(f.replace(IG_EXT, '')))
}

// Le source du module virtuel : un import `?url` par fichier (Vite l'émet et
// rend son URL hachée), exporté par shortcode.
export function igImagesModule(files, dir) {
  const base = dir.replace(/\\/g, '/').replace(/\/$/, '')
  const imports = files.map((f, i) => `import i${i} from ${JSON.stringify(`${base}/${f}?url`)}`)
  const map = `{${files.map((f, i) => `${JSON.stringify(f.replace(IG_EXT, ''))}:i${i}`).join(',')}}`
  return `${imports.join('\n')}\nexport default ${map}\n`
}
