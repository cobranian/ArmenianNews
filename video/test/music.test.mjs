// Garde : la musique des Shorts est lisible par Node, chaque Short a sa piste,
// et le crédit ajouté aux descriptions l'est une seule fois. La piste d'un
// article se lit dans SON short.fr.json (là où elle se choisit), jamais dans
// une copie de music.json qui a pu vieillir — et un slug sans piste connue est
// une erreur, pas « otar » en silence (revue du 20 nov. 2026 : quatre articles
// récents recevaient le crédit et la licence d'otar dans reels:add).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { musicCredit, musicFor } from '../scripts/music.mjs'
import { withCredit } from '../scripts/credit-pending.mjs'

const music = JSON.parse(readFileSync(new URL('../src/shorts/music.json', import.meta.url)))

// Un dossier d'articles jetable : <slug>/short.fr.json.
function culture(shorts) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'music-'))
  for (const [slug, s] of Object.entries(shorts)) {
    mkdirSync(path.join(dir, slug))
    writeFileSync(path.join(dir, slug, 'short.fr.json'), JSON.stringify(s))
  }
  return pathToFileURL(`${dir}${path.sep}`)
}

test('musicCredit nomme la piste du slug', () => {
  const c = musicCredit('ani')
  assert.ok(c.includes('SERGO.TEL') && c.includes('CC BY 3.0'))
  assert.ok(c.startsWith('♪ '))
})

test('la piste vient de short.fr.json, même pour un slug absent de music.json#BY_SLUG', () => {
  const dir = culture({ 'tout-nouveau': { music: 'mazia' } })
  assert.equal(music.BY_SLUG['tout-nouveau'], undefined)
  assert.equal(musicFor('tout-nouveau', { culture: dir }), 'mazia')
  assert.ok(musicCredit('tout-nouveau', { culture: dir }).includes('I. Mazia'))
})

test('short.fr.json l’emporte sur une copie BY_SLUG périmée', () => {
  const dir = culture({ ani: { music: 'otar' } })
  assert.equal(music.BY_SLUG.ani, 'sergo')
  assert.equal(musicFor('ani', { culture: dir }), 'otar')
})

test('un slug inconnu, ou une piste inconnue, est une erreur — plus de repli sur otar', () => {
  assert.throws(() => musicCredit('inconnu', { culture: culture({}) }), /aucune piste/)
  assert.throws(() => musicFor('x', { culture: culture({ x: { music: 'faux' } }) }), /music « faux » inconnue/)
})

test('un slug sans short.fr.json (Garni) garde sa piste écrite à la main', () => {
  assert.equal(musicFor('temple-paien-de-garni', { culture: culture({}) }), 'sergo')
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
