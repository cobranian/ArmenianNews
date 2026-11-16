// Ajoute le crédit musical (♪ …) à la description de chaque méta
// out/youtube/<slug>-<lang>.json pas encore publiée sur YouTube. Une vidéo déjà
// en ligne (présente dans culture-videos.json) garde sa description : la
// modifier ici ne changerait rien sur YouTube.
// Usage : node scripts/credit-pending.mjs [--dry]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { musicCredit } from './music.mjs'

const LANGS = ['fr', 'en', 'hy', 'ru', 'de', 'it', 'es']
const META = /^(.+)-(fr|en|hy|ru|de|it|es)\.json$/

// Idempotent : une description qui porte déjà « ♪ » est rendue telle quelle.
export const withCredit = (description, slug) =>
  description.includes('♪ ') ? description : `${description}\n\n${musicCredit(slug)}`

function main() {
  const dry = process.argv.includes('--dry')
  const dir = new URL('../out/youtube/', import.meta.url)
  const published = JSON.parse(
    readFileSync(new URL('../../src/data/culture-videos.json', import.meta.url), 'utf8'),
  )
  let n = 0
  for (const f of readdirSync(dir).sort()) {
    const m = META.exec(f)
    if (!m || !LANGS.includes(m[2])) continue
    const [, slug, lang] = m
    if (published[slug]?.[lang]) continue
    const path = fileURLToPath(new URL(f, dir))
    const meta = JSON.parse(readFileSync(path, 'utf8'))
    if (typeof meta.description !== 'string') continue
    const next = withCredit(meta.description, slug)
    if (next === meta.description) continue
    n++
    console.log(`${dry ? '[dry] ' : ''}${slug}-${lang}`)
    if (!dry) writeFileSync(path, JSON.stringify(meta, null, 2) + '\n')
    if (!dry) {
      meta.description = next
      writeFileSync(path, JSON.stringify(meta, null, 2) + '\n')
    }
  }
  console.log(`${n} couple(s)${dry ? ' (dry)' : ''}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
