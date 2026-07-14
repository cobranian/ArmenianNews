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

const shortcode = (url) => url.match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1] || url

// Instagram blocks scraping from CI, so the pool is harvested locally by
// `npm run ig-scrape` (and may be hand-edited). Each snapshot just re-randomises
// which posts are shown and in what order — a fresh random "chronology" hourly.
//
// The wall has two strands, and each account declares which it belongs to via
// `group` (institutions | personnalites), so we pick `limit` posts per group
// rather than `limit` overall — otherwise the bigger group would crowd the other
// off its own carousel.
export async function selectInstagram(limit = 30) {
  const src = JSON.parse(await readFile(join(DATA_DIR, 'instagram.json'), 'utf-8'))

  const byGroup = new Map()
  for (const acc of src.accounts || []) {
    const group = acc.group || 'institutions'
    const list = byGroup.get(group) || []
    for (const p of acc.posts || []) {
      list.push({ url: p.url, date: p.date || null, handle: acc.handle, name: acc.name, group })
    }
    byGroup.set(group, list)
  }

  // A COLLAB post lives on both partners' grids under the SAME shortcode, so
  // harvesting two collaborators (nemrabandofficial + van.nemra) yields the same
  // photo twice. Deduplicate, or the carousel shows it side by side with itself.
  const seen = new Set()
  const posts = []
  for (const [group, list] of byGroup) {
    let taken = 0
    for (const p of shuffle(list)) {
      if (taken >= limit) break
      const code = shortcode(p.url)
      if (seen.has(code)) continue
      seen.add(code)
      posts.push(p)
      taken++
    }
    console.log(`  ✓ instagram/${group} (${taken} random posts)`)
  }
  return posts
}
