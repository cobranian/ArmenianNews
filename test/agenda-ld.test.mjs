import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AGENDA_LD_ATTR, AGENDA_LD_VALUE, stripAgendaLd } from '../scripts/lib/agenda-ld.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(root, rel), 'utf-8')

// Le HTML tel que Vite le produit : le @graph de l'agenda est injecte HORS des
// sentinelles SITE_META, entre les autres blocs ld+json qui, eux, decrivent le
// site et doivent survivre a la copie.
const PAGE = `<!doctype html>
<html lang="fr">
  <head>
    <!--SITE_META:START-->
    <title>x</title>
    <script type="application/ld+json">{"@type":"WebSite"}</script>
    <!--SITE_META:END-->
    <script type="application/ld+json" ${AGENDA_LD_ATTR}="${AGENDA_LD_VALUE}">{"@context":"https://schema.org","@graph":[{"@type":"Event","name":"Concert"},{"@type":"Event","name":"Expo"}]}</script>
  </head>
  <body><div id="root"></div></body>
</html>`

test('stripAgendaLd retire le graphe Event, et rien d autre', () => {
  const out = stripAgendaLd(PAGE)
  assert.equal((out.match(/"@type":"Event"/g) || []).length, 0, 'un Event a survecu')
  assert.ok(out.includes('{"@type":"WebSite"}'), 'le bloc WebSite doit survivre')
  assert.equal((out.match(/application\/ld\+json/g) || []).length, 1)
  assert.ok(out.includes('<!--SITE_META:START-->') && out.includes('<!--SITE_META:END-->'))
  assert.ok(out.includes('<div id="root"></div>'))
})

// L'ordre des attributs appartient au serialiseur de Vite, pas a nous.
test('stripAgendaLd ne presume pas de l ordre des attributs', () => {
  const inverse = PAGE.replace(
    `<script type="application/ld+json" ${AGENDA_LD_ATTR}="${AGENDA_LD_VALUE}">`,
    `<script ${AGENDA_LD_ATTR}="${AGENDA_LD_VALUE}" type="application/ld+json">`,
  )
  assert.equal((stripAgendaLd(inverse).match(/"@type":"Event"/g) || []).length, 0)
})

test('stripAgendaLd est idempotent et sans effet sur une page sans agenda', () => {
  const une = stripAgendaLd(PAGE)
  assert.equal(stripAgendaLd(une), une)
})

// Le marqueur ne sert a rien si le plugin cesse de le poser : le graphe
// repartirait alors dans les quatre pages /radio/ sans qu'aucun test ne bouge,
// puisque derivePages retirerait consciencieusement un bloc qui n'existe plus.
// On lit vite.config.js comme du TEXTE, comme test/source-count.test.mjs lit
// TAB_ORDER — Node ne saurait pas evaluer cette config sans lancer un build.
test('le plugin Vite marque bien le bloc que derivePages retire', () => {
  const cfg = read('vite.config.js')
  assert.match(cfg, /AGENDA_LD_ATTR\]:\s*AGENDA_LD_VALUE/)
  assert.ok(
    cfg.includes("from './scripts/lib/agenda-ld.mjs'"),
    'vite.config.js doit importer la constante, pas la recopier',
  )
})

// Le complement, cote consommateur : derivePages ne doit retirer le graphe que
// des pages de vue. Le retirer de l'accueil ferait perdre le seul balisage de ce
// projet qui produise un resultat enrichi.
test('derivePages ne depouille que les pages de vue', () => {
  const src = read('scripts/build-sites.mjs')
  assert.match(src, /view !== 'home'\s*\)?\s*html = stripAgendaLd\(html\)/)
})
