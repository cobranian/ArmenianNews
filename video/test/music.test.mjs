// Garde : la musique des Shorts est lisible par Node, chaque Short a sa piste,
// et le crédit ajouté aux descriptions l'est une seule fois.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { musicCredit } from '../scripts/music.mjs'
import { withCredit } from '../scripts/credit-pending.mjs'

const music = JSON.parse(readFileSync(new URL('../src/shorts/music.json', import.meta.url)))

test('musicCredit nomme la piste du slug', () => {
  const c = musicCredit('ani')
  assert.ok(c.includes('SERGO.TEL') && c.includes('CC BY 3.0'))
  assert.ok(c.startsWith('♪ '))
})

test('un slug inconnu retombe sur otar', () => {
  assert.ok(musicCredit('inconnu').includes('Ikuzusotnek'))
})

test('chaque Short a une entrée dans BY_SLUG', () => {
  const dir = new URL('../src/shorts/data/', import.meta.url)
  const slugs = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
  slugs.push('temple-paien-de-garni')
  for (const s of slugs) assert.ok(s in music.BY_SLUG, `BY_SLUG sans ${s}`)
  for (const id of Object.values(music.BY_SLUG)) assert.ok(id in music.TRACKS, id)
})

test('withCredit est idempotent', () => {
  const once = withCredit('Texte', 'ani')
  assert.equal(withCredit(once, 'ani'), once)
  assert.ok(once.startsWith('Texte\n\n♪ '))
})
