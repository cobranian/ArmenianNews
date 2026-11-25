// Voix off d'un Short : une requête Gemini par phrase (7 faits + la phrase de fin).
//   node scripts/voice.mjs --slug <slug> --lang <lang>
// Écrit public/voice/<slug>/<lang>/<i>.wav (i = 0..6 faits, 7 = fin), un
// lines.json de contrôle (texte + voix de chaque WAV : le cache n'est réutilisé
// que si les deux concordent) et le bloc `voice` de src/shorts/data/<slug>.json.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { voiceFor, subjectOrdinal } from './voices.mjs'
import { synthesize, PRIMARY, FALLBACK } from './tts.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const GAP_MS = 6500

// Les 8 textes à dire : les `spoken` des faits, puis la phrase de fin de la langue.
export function voiceLines({ data, lang, cta }) {
  const facts = data?.[lang]?.facts ?? []
  const lines = facts.map((f, i) => {
    if (typeof f.spoken !== 'string' || !f.spoken) throw new Error(`voix : le fait ${i} (${lang}) n'a pas de « spoken »`)
    return f.spoken
  })
  const end = cta?.[lang]?.spoken
  if (!end) throw new Error(`voix : pas de phrase de fin pour « ${lang} »`)
  return [...lines, end]
}

export const ffprobeSeconds = (file) =>
  +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim()

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback)

// `dir` = racine du paquet video/. Reprend un run interrompu : une phrase déjà
// synthétisée (même texte, même voix) n'est pas redemandée.
export async function voiceShort({ slug, lang, dir = ROOT, fetch: doFetch, sleep, duration = ffprobeSeconds, ordinal, articles, log = () => {} }) {
  const dataFile = join(dir, 'src/shorts/data', `${slug}.json`)
  const data = readJson(dataFile, null)
  if (!data) throw new Error(`voix : ${dataFile} absent (lancer sync.mjs)`)
  if (!data[lang]) return { skipped: true }
  const cta = readJson(join(dir, 'src/shorts/cta.json'), {})
  const lines = voiceLines({ data, lang, cta })
  const voice = voiceFor({ lang, ordinal: ordinal ?? subjectOrdinal(slug, articles) })
  const out = join(dir, 'public/voice', slug, lang)
  mkdirSync(out, { recursive: true })
  const sidecarFile = join(out, 'lines.json')
  const sidecar = readJson(sidecarFile, {})
  const wait = sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  const results = []
  let needGap = false
  let models = [PRIMARY, FALLBACK] // le secours une fois pris reste pris : pas d'appel perdu sur le principal épuisé
  for (const [i, text] of lines.entries()) {
    const file = join(out, `${i}.wav`)
    const known = sidecar[i]
    let model
    if (existsSync(file) && known?.text === text && known?.voice === voice.name) {
      model = known.model
      log(`  ${i} : cache`)
    } else {
      if (needGap) await wait(GAP_MS)
      const r = await synthesize({ text, voice: voice.name, fetch: doFetch, sleep, models })
      if (r.model === FALLBACK) models = [FALLBACK]
      needGap = true
      writeFileSync(file, r.wav)
      model = r.model
      sidecar[i] = { text, voice: voice.name, model }
      writeFileSync(sidecarFile, JSON.stringify(sidecar, null, 2))
      log(`  ${i} : ${model}`)
    }
    results.push({ file: `voice/${slug}/${lang}/${i}.wav`, seconds: duration(file), model })
  }
  const used = [...new Set(results.map((r) => r.model))]
  data[lang].voice = {
    name: voice.name,
    gender: voice.gender,
    model: used.join('+'),
    lines: results.map(({ file, seconds }) => ({ file, seconds })),
  }
  writeFileSync(dataFile, JSON.stringify(data, null, 2) + '\n')
  return { skipped: false, voice: data[lang].voice, results }
}

// Tous les articles Culture qui ont un fr.md daté.
export function cultureArticles(cultureDir) {
  const out = []
  for (const d of readdirSync(cultureDir, { withFileTypes: true })) {
    const md = join(cultureDir, d.name, 'fr.md')
    if (!d.isDirectory() || !existsSync(md)) continue
    const m = readFileSync(md, 'utf8').match(/^date: "(\d{4}-\d{2}-\d{2})"/m)
    if (m) out.push({ slug: d.name, date: m[1] })
  }
  return out
}

function loadKey() {
  if (process.env.GEMINI_API_KEY) return
  const env = join(ROOT, '..', '.env')
  const m = existsSync(env) && readFileSync(env, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m)
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined }
  const slug = arg('--slug'), lang = arg('--lang')
  if (!slug || !lang) { console.error('usage : node scripts/voice.mjs --slug <slug> --lang <lang>'); process.exitCode = 2; return }
  const data = readJson(join(ROOT, 'src/shorts/data', `${slug}.json`), null)
  if (data && !data[lang]) { console.log(`voix : pas de bloc « ${lang} » pour ${slug}, rien à faire`); return }
  loadKey()
  if (!process.env.GEMINI_API_KEY) { console.error('voix : GEMINI_API_KEY absente'); process.exitCode = 1; return }
  try {
    const articles = cultureArticles(join(ROOT, '../src/data/culture'))
    const r = await voiceShort({ slug, lang, fetch, articles, log: console.log })
    console.log(`${slug}/${lang} : voix ${r.voice.name} (${r.voice.model}), ${r.voice.lines.map((l) => l.seconds.toFixed(2)).join(' ')}`)
  } catch (e) {
    console.error(`ÉCHEC voix ${slug}/${lang} : ${e.message}`)
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
