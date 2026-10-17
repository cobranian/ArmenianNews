// Le saut de station des boutons ⏮ / ⏭ de l'écran de verrouillage
// (Media Session, `Radio.jsx`). Sans réseau : seule la règle est testée.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepStation } from '../src/radioCycle.js'

const S = [
  { id: 'a' },
  { id: 'b', offAir: true },
  { id: 'c' },
  { id: 'd' },
]

test('suivant : la station d’après dans l’ordre de la liste', () => {
  assert.equal(stepStation(S, 'c', 1), 'd')
})

test('précédent : la station d’avant', () => {
  assert.equal(stepStation(S, 'd', -1), 'c')
})

test('une station hors antenne est sautée, dans les deux sens', () => {
  assert.equal(stepStation(S, 'a', 1), 'c')
  assert.equal(stepStation(S, 'c', -1), 'a')
})

test('la liste boucle aux deux bouts', () => {
  assert.equal(stepStation(S, 'd', 1), 'a')
  assert.equal(stepStation(S, 'a', -1), 'd')
})

test('une station inconnue : ⏭ donne la première, ⏮ la dernière', () => {
  assert.equal(stepStation(S, 'zzz', 1), 'a')
  assert.equal(stepStation(S, 'zzz', -1), 'd')
})

test('si rien d’autre n’est à l’antenne, on reste sur place', () => {
  const seule = [{ id: 'x' }, { id: 'y', offAir: true }]
  assert.equal(stepStation(seule, 'x', 1), 'x')
  assert.equal(stepStation([{ id: 'y', offAir: true }], 'y', 1), 'y')
})
