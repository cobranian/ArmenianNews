import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(root, rel), 'utf-8')

// Le bloc « changer de station sans revenir sur le site » de /radio/.
// Une clé absente d'un bloc STRINGS retombe en silence sur le français : la
// page russe afficherait un paragraphe français, cuit dans le HTML prérendu.
// On lit i18n.jsx comme du texte (Node n'importe pas le JSX).
const CLES = ['radio.remote.title', 'radio.remote.keys', 'radio.remote.skip', 'radio.remote.icon']

test('les quatre textes du bloc radio.remote existent dans les quatre langues', () => {
  const src = read('src/i18n.jsx')
  for (const cle of CLES) {
    const n = src.split(`'${cle}':`).length - 1
    assert.equal(n, 4, `${cle} déclarée ${n} fois dans src/i18n.jsx, 4 attendues (fr, en, hy, ru)`)
  }
})

test('RadioPage utilise chacune de ces clés', () => {
  const src = read('src/components/RadioPage.jsx')
  for (const cle of CLES) assert.ok(src.includes(`t('${cle}')`), `${cle} absente de RadioPage.jsx`)
})
