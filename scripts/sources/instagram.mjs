import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'data')

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Instagram blocks scraping (like armradio behind Cloudflare), so the post
// pool is curated by hand in instagram.json. Each snapshot just re-randomises
// which posts are shown and in what order — a fresh random "chronology" hourly.
export async function selectInstagram(limit = 12) {
  const src = JSON.parse(await readFile(join(DATA_DIR, 'instagram.json'), 'utf-8'))
  const all = (src.accounts || []).flatMap((acc) =>
    (acc.permalinks || []).map((url) => ({ url, handle: acc.handle, name: acc.name })),
  )
  const posts = shuffle(all).slice(0, limit)
  console.log(`  ✓ instagram (${posts.length} random posts)`)
  return posts
}
