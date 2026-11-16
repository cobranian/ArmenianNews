// La file des Shorts à mettre en ligne sur YouTube, src/data/youtube-queue.json :
//   { version: 1, items: [{ slug, lang, asset, title, description, addedAt }] }
//
// video.yml la remplit (scripts/video-publish.mjs) ; l'envoi la vide. Un
// slug×lang n'y entre qu'une fois, et jamais s'il est déjà en ligne
// (culture-videos.json) : YouTube ne dédoublonne pas, un doublon partirait
// tel quel sur la chaîne.
import { readFile } from 'node:fs/promises'

export const EMPTY_QUEUE = Object.freeze({ version: 1, items: Object.freeze([]) })

// Un fichier absent vaut une file vide ; illisible, c'est une erreur (le
// réécrire vide perdrait ce qui attendait).
export async function readQueue(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return structuredClone(EMPTY_QUEUE)
    throw e
  }
}

// `adds` : [{ slug, lang, asset, title, description }]. Rend une NOUVELLE file
// (l'entrée n'est pas mutée), les ajouts à la fin, dans l'ordre d'arrivée.
export function enqueue(queue, adds, now, { videos = {} } = {}) {
  if (queue?.version !== 1 || !Array.isArray(queue.items)) throw new Error(`youtube-queue.json : version ${queue?.version} inattendue (1)`)
  const items = structuredClone(queue.items)
  const key = (s, l) => `${s}/${l}`
  const seen = new Set(items.map((i) => key(i.slug, i.lang)))
  const addedAt = now.toISOString()
  for (const { slug, lang, asset, title, description } of adds) {
    if (seen.has(key(slug, lang)) || videos?.[slug]?.[lang]) continue
    seen.add(key(slug, lang))
    items.push({ slug, lang, asset, title, description, addedAt })
  }
  return { version: 1, items }
}
