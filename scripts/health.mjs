// Contrôle de santé de l'instantané (scripts/lib/health.mjs). N'échoue jamais :
// le job horaire lit `problems=N` dans $GITHUB_OUTPUT et ouvre ou referme
// l'issue `[sources-down]`. `--out fichier` écrit le rapport Markdown.
import { readFile, readdir, writeFile, appendFile } from 'node:fs/promises'
import { ALL_LANGS } from '../sites.config.js'
import { checkNews, checkBriefs, checkAgenda, checkClassify, checkSteps, healthReport } from './lib/health.mjs'

const root = new URL('../src/data/', import.meta.url)
const json = async (f) => JSON.parse(await readFile(new URL(f, root), 'utf-8'))
const now = new Date()

const dates = {}
for (const l of ALL_LANGS) {
  const files = await readdir(new URL(`briefs/${l}/`, root)).catch(() => [])
  dates[l] = files.map((f) => f.replace(/\.json$/, ''))
}

const news = await json('news.json')
const problems = [
  ...checkNews(news, now),
  ...checkClassify(news, await json('rubric-cache.json').catch(() => ({}))),
  // Posé par le job (hourly.yml) depuis steps.screenshot.outcome.
  ...checkSteps({ screenshot: process.env.SCREENSHOT_OUTCOME }),
  ...checkBriefs(dates, now),
  ...checkAgenda(await json('agenda.json'), now),
]
const { ok, markdown } = healthReport({ problems })
console.log(ok ? '✓ santé : tout est frais' : `✗ santé : ${problems.length} problème(s)\n${markdown}`)

const i = process.argv.indexOf('--out')
if (i > 0) await writeFile(process.argv[i + 1], markdown + '\n', 'utf-8')
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `problems=${problems.length}\n`)
