/**
 * Génère la brève du jour hors du scrape, sur le news.json actuel.
 *
 *   npm run brief                 # les langues dues (7 h à Erevan passé)
 *   npm run brief -- --force      # ignore l'heure (jamais un fichier existant)
 *   npm run brief -- --dry        # n'écrit rien : affiche la brève en console
 *
 * La clé vient de OPENROUTER_API_KEY ou du .env local.
 */
import { readFile, mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateBriefs } from './lib/brief-generate.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  // pas de .env : la variable d'environnement suffit
}
const force = process.argv.includes('--force')
const dry = process.argv.includes('--dry')
const news = JSON.parse(await readFile(path.join(root, 'src/data/news.json'), 'utf-8'))
const dir = dry ? await mkdtemp(path.join(tmpdir(), 'brief-')) : path.join(root, 'src/data/briefs')
const done = await generateBriefs({ news, dir, force })
if (dry)
  for (const lang of done)
    for (const f of await readdir(path.join(dir, lang)))
      console.log(`\n── ${lang}/${f}\n` + (await readFile(path.join(dir, lang, f), 'utf-8')))
