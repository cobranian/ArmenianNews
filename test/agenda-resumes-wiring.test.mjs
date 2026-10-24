import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { ALL_LANGS } from '../sites.config.js'

// Le job horaire ne commite QUE les fichiers qu'il nomme : un fichier de
// résumés absent de sa ligne `git add` serait réécrit à chaque run et jamais
// gardé — les résumés refaits chaque heure, sans aucun signe.
test('le job horaire commite le cache et les fichiers par langue', () => {
  const yml = readFileSync(new URL('../.github/workflows/hourly.yml', import.meta.url), 'utf8')
  const add = yml.split('\n').find((l) => /git add src\/data\/news\.json/.test(l))
  assert.match(add, /src\/data\/agenda-resumes\.json/)
  assert.match(add, /src\/data\/agenda-resumes(\s|$)/)
})

test('un fichier de résumés par langue existe', () => {
  for (const l of ALL_LANGS)
    assert.ok(existsSync(new URL(`../src/data/agenda-resumes/${l}.json`, import.meta.url)), l)
})

// Importé en statique, le cache partirait dans le bundle des deux vitrines.
test('aucun composant n’importe le cache des résumés en statique', () => {
  const files = readdirSync(new URL('../src/', import.meta.url), { recursive: true }).filter((f) =>
    /\.(jsx?|mjs)$/.test(f),
  )
  for (const f of files)
    assert.doesNotMatch(
      readFileSync(new URL('../src/' + f.replaceAll(String.fromCharCode(92), '/'), import.meta.url), 'utf8'),
      /from ['"][^'"]*agenda-resumes/,
      f,
    )
})
