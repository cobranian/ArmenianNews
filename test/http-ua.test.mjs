import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UA } from '../scripts/lib/http.mjs'

// Le User-Agent des scrapers ne doit PAS se faire passer pour un navigateur
// versionné. Le 9 septembre 2026, Cloudflare s'est mis à répondre 403 à
// Armenpress, CivilNet et NEWS.am (puis 403 par intermittence au Worker
// ArmRadio) pour tout UA qui annonce « Chrome/… » sans avoir l'empreinte TLS
// de Chrome — Node (undici comme node:https) n'a pas cette empreinte. Un UA
// qui ne réclame aucun navigateur passe partout, et sur les onze hôtes du
// dépôt (mesuré le 22 septembre 2026, les deux clients).
//
// Rien d'autre ne garde cela : un UA « Chrome » passe le lint, les tests, le
// build, et le backfill masque ensuite les 403 en resservant l'instantané
// précédent. Le site a affiché treize jours de dépêches figées avant qu'un
// lecteur ne le voie.
test('le User-Agent n annonce aucun moteur de navigateur versionné', () => {
  assert.match(UA, /^Mozilla\/5\.0 /, 'préfixe conventionnel attendu')
  assert.doesNotMatch(UA, /\b(Chrome|Chromium|Firefox|Safari|Edg|OPR)\/\d/i)
})

test('le User-Agent dit qui il est et où écrire', () => {
  assert.match(UA, /ArmenieInfo/)
  assert.match(UA, /\+https:\/\/armenieinfo\.ch/)
})
