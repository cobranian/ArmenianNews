import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ALL_LANGS, ALL_VIEWS, urlFor } from '../sites.config.js'

// Changer de langue garde la page : /radio/ → /hy/radio/, /agenda/ → /events/.
// Les pages statiques (brève, Culture) le font par langHrefsFor ; le sélecteur
// React doit faire de même. Revenir à LANG_URL renverrait chaque lecteur à
// l'accueil, sans qu'aucun build ni contrôle ne tombe.
// Node ne sait pas importer du JSX : on lit Nav.jsx comme du texte.
test('le sélecteur de langue de Nav.jsx vise la même vue', async () => {
  const src = await readFile(new URL('../src/components/Nav.jsx', import.meta.url), 'utf-8')
  assert.match(src, /href=\{urlFor\(l\.code, view\)\}/)
  assert.doesNotMatch(src, /LANG_URL/)
})

// La condition qui rend ce lien sûr : chaque vue existe dans chaque langue.
// Une vue réservée à certaines langues demanderait un repli, comme langHrefsFor.
test('chaque vue existe dans chaque langue', () => {
  for (const view of ALL_VIEWS) for (const l of ALL_LANGS) assert.ok(urlFor(l, view), `${view}/${l}`)
})
