import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { STATION_FACTS } from '../src/stations.js'

// Node ne sait pas importer du JSX : on lit STATIONS comme du texte, exactement
// comme test/source-count.test.mjs lit TAB_ORDER.
const jsx = await readFile(new URL('../src/components/Radio.jsx', import.meta.url), 'utf-8')
const ids = [...jsx.matchAll(/\{\s*id:\s*'([a-z]+)'/g)].map((m) => m[1])

test('les douze stations du lecteur ont une fiche, et reciproquement', () => {
  assert.equal(ids.length, 12, 'STATIONS ne contient plus douze entrees')
  assert.deepEqual([...ids].sort(), Object.keys(STATION_FACTS).sort())
})

// LA REGLE DE SOURCAGE. Une fiche qui affirme sans sourcer est exactement ce que
// ce chantier refuse : elle classe aussi bien qu'une fiche vraie, jusqu'au jour
// ou un lecteur la dement.
test('aucun fait n est affirme sans source', () => {
  for (const [id, f] of Object.entries(STATION_FACTS)) {
    const faits = ['city', 'genre', 'langue', 'fm', 'bitrate'].filter((k) => f[k] != null)
    if (faits.length) {
      assert.ok(Array.isArray(f.sources) && f.sources.length > 0, `${id} : faits sans source`)
      for (const s of f.sources) assert.match(s, /^https:\/\//, `${id} : source non https`)
    }
  }
})

test('aucun champ vide ni rempli d un point d interrogation', () => {
  for (const [id, f] of Object.entries(STATION_FACTS)) {
    for (const [k, v] of Object.entries(f)) {
      if (k === 'sources') continue
      if (v == null) continue
      assert.equal(typeof v, 'string', `${id}.${k} doit etre une chaine ou absent`)
      assert.ok(v.trim().length > 0, `${id}.${k} est vide`)
      assert.doesNotMatch(v, /\?|TBD|TODO|inconnu/i, `${id}.${k} n est pas un fait`)
    }
  }
})
