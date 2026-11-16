// Rend en lot tous les Shorts (avec musique) : 22 articles × 7 langues + 7 Garni.
// Usage : node scripts/render-all.mjs [--lang xx] [--slug s]
// Seules les langues dont le Short a un texte (src/shorts/data/<slug>.json,
// écrit par sync.mjs) sont rendues : Root.tsx ne déclare que celles-là.
// Chaque rendu est suivi d'un contrôle : moins de 10 Mo et un flux audio. Un
// rendu qui échoue au contrôle est EFFACÉ : video.yml publie tout MP4 présent.
// Un échec est noté, la suite continue, le résumé final liste les échecs.
import { readdirSync, readFileSync, statSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const LANGS = ['fr', 'en', 'hy', 'ru', 'de', 'it', 'es']
const GARNI = 'temple-paien-de-garni'
const MAX_BYTES = 10 * 1024 * 1024
const ROOT = fileURLToPath(new URL('..', import.meta.url))

// « fr » -> « Fr » : même règle que src/Root.tsx.
const cap = (l) => l[0].toUpperCase() + l[1]

const DATA = new URL('../src/shorts/data/', import.meta.url)
const slugs = () =>
  readdirSync(DATA)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort()
const hasLang = (slug, lang) => lang in JSON.parse(readFileSync(new URL(`${slug}.json`, DATA), 'utf8'))

// Pure : aucune E/S de rendu, importable sans lancer le main.
// `has(slug, lang)` : le Short a-t-il un texte dans cette langue ?
export function jobs({ langs = LANGS, slugs: only, has = hasLang } = {}) {
  const out = []
  for (const lang of langs) {
    for (const slug of slugs()) {
      if (only && !only.includes(slug)) continue
      if (!has(slug, lang)) continue
      out.push({ composition: `${cap(lang)}-${slug}`, out: `out/${lang}/${slug}.mp4` })
    }
    if (!only || only.includes(GARNI)) {
      out.push({ composition: `Garni${cap(lang)}`, out: `out/${lang}/${GARNI}.mp4` })
    }
  }
  return out
}

const hasAudio = (file) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file], {
    encoding: 'utf8',
  })
  return r.status === 0 && r.stdout.split(/\s+/).includes('audio')
}

function run(job) {
  mkdirSync(dirname(`${ROOT}${job.out}`), { recursive: true })
  const r = spawnSync('npx', ['remotion', 'render', job.composition, job.out, '--crf', '30'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  })
  const why = check(r.status, `${ROOT}${job.out}`)
  if (why) rmSync(`${ROOT}${job.out}`, { force: true })
  return why
}

function check(status, file) {
  if (status !== 0) return 'remotion a échoué'
  const size = statSync(file).size
  if (size >= MAX_BYTES) return `trop lourd (${(size / 1048576).toFixed(1)} Mo)`
  if (!hasAudio(file)) return 'pas de flux audio'
  return null
}

function main() {
  const arg = (name) => {
    const i = process.argv.indexOf(name)
    return i > -1 ? process.argv[i + 1] : undefined
  }
  const lang = arg('--lang')
  const slug = arg('--slug')
  const list = jobs({ langs: lang ? [lang] : undefined, slugs: slug ? [slug] : undefined })
  const failed = []
  for (const [i, job] of list.entries()) {
    console.log(`\n[${i + 1}/${list.length}] ${job.composition}`)
    const why = run(job)
    if (why) {
      failed.push(`${job.composition} : ${why}`)
      console.log(`ÉCHEC ${job.composition} : ${why}`)
    }
  }
  console.log(`\n${list.length - failed.length} OK, ${failed.length} échec(s)`)
  for (const f of failed) console.log(`  - ${f}`)
  if (failed.length) process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
