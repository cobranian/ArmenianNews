// Garde d'alphabet des traductions Culture (scripts/lib/brief-script.mjs,
// `translationScriptProblem`). Depuis le 2 nov. 2026, une traduction peut venir
// d'un modèle de secours gratuit, qui glisse du latin dans l'arménien : la
// garde la refuse. Et elle ne doit refuser AUCUNE des traductions publiées.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { translationScriptProblem, MAX_FOREIGN_SHARE } from '../scripts/lib/brief-script.mjs'

test('une traduction propre passe, noms propres latins compris', () => {
  assert.equal(translationScriptProblem('Կոմիտասը (Komitas) հայ երգահան է, ով հավաքել է հազարավոր ժողովրդական երգեր Հայաստանի գյուղերում և քաղաքներում, դրանք գրի առել ու մշակել երգչախմբի համար։', 'hy'), null)
  assert.equal(translationScriptProblem('Комитас — армянский композитор, собравший тысячи песен.', 'ru'), null)
  assert.equal(translationScriptProblem('Komitas was an Armenian composer ([source](https://hy.wikipedia.org/wiki/Կոմիտաս)).', 'en'), null)
})

test('trop de latin dans l’arménien → refusée', () => {
  assert.match(translationScriptProblem('Կոմիտաս was an Armenian composer who collected songs', 'hy'), /hors de l'alphabet/)
})

test('un mot qui mêle deux alphabets → refusé', () => {
  assert.match(translationScriptProblem('Երգահան Մասսudz հավաքել է երգեր և պարեր շատ գյուղերում։', 'hy'), /mêlant/)
})

test('seuil : 10 %', () => assert.equal(MAX_FOREIGN_SHARE, 0.1))

test('aucune traduction publiée n’est refusée', () => {
  const dir = 'src/data/culture'
  let n = 0
  for (const slug of readdirSync(dir)) {
    for (const lang of ['en', 'de', 'it', 'es', 'hy', 'ru']) {
      const f = `${dir}/${slug}/${lang}.md`
      if (!existsSync(f)) continue
      n++
      assert.equal(translationScriptProblem(readFileSync(f, 'utf8'), lang), null, `${slug}/${lang}`)
    }
  }
  assert.ok(n > 0)
})
