import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

// Le job horaire ne commite QUE les fichiers qu'il nomme : un dossier de
// résumés absent de sa ligne `git add` serait réécrit chaque heure et jamais
// gardé, sans aucun signe.
test('le job horaire commite le dossier des résumés d’articles', () => {
  const yml = readFileSync(new URL('../.github/workflows/hourly.yml', import.meta.url), 'utf8')
  const add = yml.split('\n').find((l) => /git add src\/data\/news\.json/.test(l))
  assert.match(add, /src\/data\/article-resumes(\s|$)/)
})

// Le quota OpenRouter est partagé : l'étape passe après celle de l'agenda.
test('le scrape résume les articles après l’agenda', () => {
  const s = readFileSync(new URL('../scripts/scrape.mjs', import.meta.url), 'utf8')
  const a = s.indexOf('summarizeAgenda(')
  const b = s.indexOf('summarizeArticles(')
  assert.ok(a > 0 && b > a)
})

// Étape invisible : aucune source du site ne lit encore ces résumés.
test('aucun fichier de src/ ne référence article-resumes', () => {
  const files = readdirSync(new URL('../src/', import.meta.url), { recursive: true }).filter((f) =>
    /\.(jsx?|mjs)$/.test(f),
  )
  for (const f of files)
    assert.doesNotMatch(
      readFileSync(new URL('../src/' + f.replaceAll(String.fromCharCode(92), '/'), import.meta.url), 'utf8'),
      /article-resumes/,
      f,
    )
})
