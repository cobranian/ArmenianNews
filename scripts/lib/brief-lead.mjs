// La brève du jour en tête de l'accueil de/it (BriefLead.jsx, via le module
// virtuel `virtual:brief-lead` de vite.config.js). Ces deux langues n'ont pas
// de fil propre — elles lisent le fil français (contentLang) — et la brève
// est le seul contenu écrit dans leur langue : elle passe donc avant le fil.
//
// Ne lève JAMAIS : une brève absente ou cassée retire le bloc, elle ne doit
// pas retenir le build. La date vient du NOM du fichier (celui que la page
// datée sert, brief-pages.mjs), pas du champ `date` du JSON.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { briefUrl } from '../../sites.config.js'

const FILE = /^(\d{4}-\d{2}-\d{2})\.json$/

export async function latestBrief(dir, lang) {
  try {
    const dates = (await readdir(join(dir, lang)))
      .map((f) => FILE.exec(f)?.[1])
      .filter(Boolean)
      .sort()
    const date = dates.at(-1)
    if (!date) return null
    const b = JSON.parse(await readFile(join(dir, lang, `${date}.json`), 'utf-8'))
    if (!Array.isArray(b.topics)) return null
    const topics = b.topics
      .filter((t) => typeof t?.title === 'string' && t.title)
      .slice(0, 3)
      .map((t) => ({ title: t.title }))
    if (!topics.length) return null
    return { date, url: briefUrl(lang, date), intro: typeof b.intro === 'string' ? b.intro : '', topics }
  } catch {
    return null
  }
}
