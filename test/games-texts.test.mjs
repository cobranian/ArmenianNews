// Les textes de la vue Jeux (src/games.js) : un fait affirmé est un fait
// sourcé, et une traduction ne perd pas une phrase.
//
// Même règle que test/stations.test.mjs : un fait introuvable, ou sur lequel
// deux sources se contredisent, est OMIS — jamais approché. Chaque paragraphe
// d'intro déclare dans `facts` les faits qu'il affirme ; un paragraphe qui
// n'en affirme aucun porte `facts: []`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GAMES } from '../src/games.js'
import { ALL_LANGS } from '../sites.config.js'

test('les deux jeux, dans l ordre d affichage, a leur chemin', () => {
  assert.deepEqual(
    GAMES.map((g) => [g.id, g.path]),
    [
      ['echecs', '/play/echecs/'],
      ['backgammon', '/play/backgammon/'],
    ],
  )
})

test('chaque fait a au moins une source https, et un id unique', () => {
  for (const g of GAMES) {
    assert.ok(Array.isArray(g.facts) && g.facts.length > 0, `${g.id} : aucun fait`)
    const ids = g.facts.map((f) => f.id)
    assert.equal(new Set(ids).size, ids.length, `${g.id} : id de fait en double`)
    for (const f of g.facts) {
      assert.match(f.id, /^[a-z0-9-]+$/, `${g.id} : id de fait mal formé`)
      assert.ok(Array.isArray(f.sources) && f.sources.length > 0, `${g.id}.${f.id} : sans source`)
      for (const s of f.sources) assert.match(s, /^https:\/\//, `${g.id}.${f.id} : source non https`)
    }
  }
})

test('chaque paragraphe ne cite que des faits declares, et chaque fait sert', () => {
  for (const g of GAMES) {
    const declares = new Set(g.facts.map((f) => f.id))
    for (const l of ALL_LANGS) {
      const cites = new Set()
      for (const p of g.text[l].intro) {
        assert.ok(Array.isArray(p.facts), `${g.id}/${l} : paragraphe sans liste facts`)
        for (const id of p.facts) {
          assert.ok(declares.has(id), `${g.id}/${l} : fait « ${id} » non déclaré`)
          cites.add(id)
        }
      }
      // Un fait déclaré qu'aucun paragraphe n'affirme est une source morte.
      assert.deepEqual([...cites].sort(), [...declares].sort(), `${g.id}/${l} : faits cités ≠ faits déclarés`)
    }
  }
})

test('chaque jeu est ecrit dans chaque langue, titre, intro et regles', () => {
  for (const g of GAMES) {
    assert.deepEqual(Object.keys(g.text).sort(), [...ALL_LANGS].sort(), `${g.id} : langues`)
    for (const l of ALL_LANGS) {
      const t = g.text[l]
      assert.equal(typeof t.title, 'string', `${g.id}/${l} : titre`)
      assert.ok(t.title.trim(), `${g.id}/${l} : titre vide`)
      assert.ok(t.intro.length >= 1, `${g.id}/${l} : intro vide`)
      for (const p of t.intro) assert.ok(typeof p.text === 'string' && p.text.trim(), `${g.id}/${l} : paragraphe vide`)
      assert.ok(t.rules.length >= 3, `${g.id}/${l} : moins de 3 règles`)
      for (const r of t.rules) assert.ok(typeof r === 'string' && r.trim(), `${g.id}/${l} : règle vide`)
    }
  }
})

test('une traduction ne perd ni paragraphe, ni regle, ni fait', () => {
  for (const g of GAMES) {
    const fr = g.text.fr
    for (const l of ALL_LANGS) {
      const t = g.text[l]
      assert.equal(t.intro.length, fr.intro.length, `${g.id}/${l} : nombre de paragraphes`)
      assert.equal(t.rules.length, fr.rules.length, `${g.id}/${l} : nombre de règles`)
      t.intro.forEach((p, i) =>
        assert.deepEqual(p.facts, fr.intro[i].facts, `${g.id}/${l} : faits du paragraphe ${i + 1}`),
      )
    }
  }
})

// Même esprit que translationScriptProblem (scripts/lib/brief-script.mjs) :
// une page arménienne ou russe qui glisse du latin se lit comme une
// traduction ratée. Compté sur TOUTES les chaînes affichées, sans liste de
// noms propres : les noms s'écrivent dans l'écriture de la page.
function latinShare(t) {
  const all = [t.title, ...t.intro.map((p) => p.text), ...t.rules].join(' ')
  const letters = all.match(/\p{L}/gu) || []
  const latin = all.match(/[A-Za-z]/g) || []
  return letters.length ? latin.length / letters.length : 0
}

test('les textes armeniens et russes restent dans leur ecriture', () => {
  for (const g of GAMES) {
    for (const l of ['hy', 'ru']) {
      const share = latinShare(g.text[l])
      assert.ok(share < 0.1, `${g.id}/${l} : ${(share * 100).toFixed(1)} % de lettres latines`)
    }
  }
})
