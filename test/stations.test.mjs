import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { STATION_FACTS, langueKey, inLanguage } from '../src/stations.js'
import { ALL_LANGS } from '../sites.config.js'

// Node ne sait pas importer du JSX : on lit STATIONS comme du texte, exactement
// comme test/source-count.test.mjs lit TAB_ORDER.
const jsx = await readFile(new URL('../src/components/Radio.jsx', import.meta.url), 'utf-8')
const ids = [...jsx.matchAll(/\{\s*id:\s*'([a-z]+)'/g)].map((m) => m[1])
const i18n = await readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf-8')

test('les dix-sept stations du lecteur ont une fiche, et reciproquement', () => {
  assert.equal(ids.length, 17, 'STATIONS ne contient plus dix-sept entrees')
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

// `genre` et `langue` sont des CLES, pas du texte : RadioPage les rend par
// t(`radio.genre.${f.genre}`). Or t() vaut STRINGS[lang][cle] ?? STRINGS.fr[cle]
// ?? cle — une cle absente RETOURNE LA CLE. Une station ajoutee avec
// genre: 'talk' passerait donc les trois tests ci-dessus, le lint, le check et
// le prerendu, pour afficher « Genre : radio.genre.talk » sur les quatre pages
// /radio/ — cuit dans le HTML que Google indexe. Meme mecanique que
// test/radio-count.test.mjs, sur une autre famille de chaines.
//
// On compte les DECLARATIONS dans i18n.jsx : quatre par cle, une par bloc
// STRINGS. Trois suffiraient a l'affichage (le repli sur le francais masque le
// trou), et c'est precisement ce qu'il faut attraper.
function declarations(cle) {
  return (i18n.match(new RegExp(`'${cle.replace(/\./g, '\\.')}':`, 'g')) || []).length
}

test('chaque genre de station a son libelle dans les quatre langues', () => {
  const genres = [...new Set(Object.values(STATION_FACTS).map((f) => f.genre).filter(Boolean))]
  assert.ok(genres.length, 'aucun genre a verifier — le test ne garde plus rien')
  for (const g of genres) {
    assert.equal(
      declarations(`radio.genre.${g}`),
      ALL_LANGS.length,
      `radio.genre.${g} manque dans un des quatre blocs STRINGS de src/i18n.jsx ` +
        `— la page /radio/ afficherait la cle elle-meme`,
    )
  }
})

test('chaque ville de station a son libelle dans les quatre langues', () => {
  // Meme regle que les genres : `city` est une cle depuis l'audit du 21 aout
  // 2026 — avant, « Երևան » etait ecrit en dur et s'affichait tel quel sur la
  // page francaise (et partait dans RadioStation.areaServed).
  const villes = [...new Set(Object.values(STATION_FACTS).map((f) => f.city).filter(Boolean))]
  assert.ok(villes.length, 'aucune ville a verifier')
  for (const v of villes) {
    assert.match(v, /^[a-z]+$/, `${v} : une ville doit etre une cle ascii minuscule`)
    assert.equal(
      declarations(`radio.city.${v}`),
      ALL_LANGS.length,
      `radio.city.${v} manque dans un des quatre blocs STRINGS de src/i18n.jsx`,
    )
  }
})

test('chaque langue d antenne a son libelle dans les quatre langues', () => {
  const langues = [...new Set(Object.values(STATION_FACTS).filter((f) => f.langue).map(langueKey))]
  assert.ok(langues.length, 'aucune langue d antenne a verifier')
  for (const l of langues) {
    assert.equal(
      declarations(`radio.page.lang.${l}`),
      ALL_LANGS.length,
      `radio.page.lang.${l} manque dans un des quatre blocs STRINGS de src/i18n.jsx ` +
        `— la page /radio/ afficherait la cle elle-meme`,
    )
  }
})

// La reciproque : un libelle traduit quatre fois pour un genre que plus aucune
// station ne porte est une cle morte, dans un fichier dont l'invariant est la
// parite stricte des cles — elle invite un futur agent a « l'implementer ».
test('aucun libelle de genre ne survit a la station qui le portait', () => {
  const genres = new Set(Object.values(STATION_FACTS).map((f) => f.genre))
  const declares = new Set([...i18n.matchAll(/'radio\.genre\.([a-z]+)':/g)].map((m) => m[1]))
  for (const g of declares) {
    assert.ok(genres.has(g), `radio.genre.${g} n est porte par aucune station — cle morte`)
  }
})

test('aucun champ vide ni rempli d un point d interrogation', () => {
  for (const [id, f] of Object.entries(STATION_FACTS)) {
    for (const [k, v] of Object.entries(f)) {
      if (k === 'sources') continue
      if (v == null) continue
      // `langue` seul peut etre une liste (antenne bilingue) : chaque element
      // passe alors les memes controles qu'un champ simple.
      const valeurs = k === 'langue' && Array.isArray(v) ? v : [v]
      for (const x of valeurs) {
        assert.equal(typeof x, 'string', `${id}.${k} doit etre une chaine ou absent`)
        assert.ok(x.trim().length > 0, `${id}.${k} est vide`)
        assert.doesNotMatch(x, /\?|TBD|TODO|inconnu/i, `${id}.${k} n est pas un fait`)
      }
    }
  }
})

// Une langue d'antenne est un code BCP 47 (deux lettres) ou une liste de
// codes : c'est ce que `inLanguage` émet tel quel dans le balisage. Une
// faute de frappe (« frhy », « FR ») passerait le test des libellés si la clé
// i18n avait la même faute, et partirait chez Google.
test('les langues d antenne sont des codes, seuls ou en liste', () => {
  for (const [id, f] of Object.entries(STATION_FACTS)) {
    if (!f.langue) continue
    const codes = [].concat(f.langue)
    assert.ok(codes.length > 0, `${id} : liste de langues vide`)
    for (const c of codes) assert.match(c, /^[a-z]{2}$/, `${id} : « ${c} » n est pas un code de langue`)
    assert.equal(new Set(codes).size, codes.length, `${id} : langue en double`)
  }
  assert.deepEqual(inLanguage({ langue: ['fr', 'hy'] }), ['fr', 'hy'])
  assert.equal(inLanguage({ langue: 'hy' }), 'hy')
  assert.equal(langueKey({ langue: ['fr', 'hy'] }), 'fr-hy')
})
