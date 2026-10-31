// Les résumés des événements de l'agenda, chargés AU PREMIER DÉPLI dans la
// visionneuse, jamais avec la page : `import.meta.glob` non-eager fait un chunk
// par langue, téléchargé seulement quand on le demande. Les fichiers sont
// écrits par le scrape horaire (scripts/lib/agenda-resumes.mjs).
//
// Ne remplacez pas ceci par un import statique : les résumés des sept langues
// partiraient dans le bundle des deux vitrines (test/agenda-resumes-wiring.test.mjs).
const files = import.meta.glob('./data/agenda-resumes/*.json', { import: 'default' })
const byLang = new Map()

export async function loadResume(lang, url) {
  const load = files[`./data/agenda-resumes/${lang}.json`]
  if (!load) return null
  if (!byLang.has(lang)) byLang.set(lang, load().catch(() => null))
  const table = await byLang.get(lang)
  if (!table) byLang.delete(lang) // un échec réseau se retentera au prochain dépli
  return table?.[url] || null
}
