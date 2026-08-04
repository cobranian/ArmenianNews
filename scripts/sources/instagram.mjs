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
// The wall has five strands, and each account declares which it belongs to via
// `group` (institutions | personnalites | creation | createurs | terre), so we
// draw per group rather than from the whole pool — otherwise the biggest group
// would crowd the others off their own carousel.
//
// WITHIN a group we draw ROUND-ROBIN, one post per account in turn. A flat
// shuffle of the group's reserve gives each account tiles in proportion to how
// many posts it has, which is invisible while every account holds exactly nine
// — and stops being invisible the moment one doesn't. `simonian_jewels` carries
// a capped catalogue (`count: 120`), 120 posts against its three neighbours'
// nine: flat, it would take ~15 of the strand's 18 tiles and "Créateurs
// arméniens" would become one account's wall. This is the same imbalance the
// per-group draw fixes one level up, applied one level down.
export function drawGroup(accounts, limit, seen = new Set()) {
  // One shuffled pile per account, and the ORDER OF THE PILES is shuffled too.
  // Without that second shuffle the same account would always take the spare
  // tile *and* always open the carousel — a fixed rank on a shelf whose whole
  // point is to change.
  const piles = shuffle(
    accounts
      .map((acc) => ({ acc, pile: shuffle(acc.posts || []) }))
      .filter(({ pile }) => pile.length),
  )

  const out = []
  while (out.length < limit) {
    let progressed = false
    for (const { acc, pile } of piles) {
      if (out.length >= limit) break
      while (pile.length) {
        const p = pile.shift()
        progressed = true
        const code = shortcode(p.url)
        if (seen.has(code)) continue
        seen.add(code)
        out.push({
          url: p.url,
          date: p.date || null,
          handle: acc.handle,
          name: acc.name,
          group: acc.group || 'institutions',
        })
        break
      }
    }
    // No pile yielded anything this round — every account is exhausted.
    if (!progressed) break
  }
  return out
}

export async function selectInstagram(limit = 18) {
  const src = JSON.parse(await readFile(join(DATA_DIR, 'instagram.json'), 'utf-8'))

  const byGroup = new Map()
  for (const acc of src.accounts || []) {
    const group = acc.group || 'institutions'
    byGroup.set(group, [...(byGroup.get(group) || []), acc])
  }

  // `seen` spans the groups, not just one: a post shared across two strands
  // would otherwise appear twice on the same page.
  const seen = new Set()
  const posts = []
  for (const [group, accounts] of byGroup) {
    const drawn = drawGroup(accounts, limit, seen)
    posts.push(...drawn)
    console.log(`  ✓ instagram/${group} (${drawn.length} random posts)`)
  }
  return posts
}
