// Le plein écran de la visionneuse (ZoomView.jsx) est branché sur la Lightbox
// par quatre fils, dont aucun ne casse un build s'il manque :
// - le bouton autour de l'image (sans lui, rien n'ouvre le zoom) ;
// - `setZoom(false)` dans `go` (sans lui, ‹ › changeraient l'image SOUS un
//   zoom resté ouvert sur l'ancienne) ;
// - `touch-action: none` sur la couche (sans lui, le pincement zoome la
//   PAGE, qui reste agrandie après fermeture sur iPhone) ;
// - l'écoute clavier en capture avec stopPropagation (sans elle, Échap
//   atteint aussi la Lightbox et ferme tout d'un coup).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const lightbox = read('src/components/Lightbox.jsx')
const zoomView = read('src/components/ZoomView.jsx')
const css = read('src/styles/global.css')

test("la Lightbox ouvre le zoom par un bouton autour de l'image", () => {
  assert.match(lightbox, /import \{ ZoomView \} from '\.\/ZoomView\.jsx'/)
  assert.match(lightbox, /className="lb__zoom"/)
  // Le nom accessible garde ce que montre l'image (l'alt), pas la seule action.
  assert.match(lightbox, /aria-label=\{item\.alt \? `\$\{t\('lb\.zoom'\)\}, \$\{item\.alt\}`/)
})

test("changer d'image referme le zoom", () => {
  const go = lightbox.match(/const go = useCallback\([\s\S]*?\n {2}\)/)
  assert.ok(go, 'go introuvable')
  assert.match(go[0], /setZoom\(false\)/)
})

test('la couche plein écran capte le geste, pas la page', () => {
  const rule = css.match(/\n\.zv \{[^}]*\}/)
  assert.ok(rule, 'règle .zv introuvable')
  assert.match(rule[0], /touch-action: none/)
})

test("Échap ne traverse pas jusqu'à la Lightbox", () => {
  assert.match(zoomView, /window\.addEventListener\('keydown', onKey, true\)/)
  assert.match(zoomView, /stopPropagation\(\)/)
})
