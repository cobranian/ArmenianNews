import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITES, primaryLang } from '../sites.config.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(root, rel), 'utf-8')

// Même piège que le nombre de radios (voir radio-count.test.mjs), sur l'autre
// compteur écrit en toutes lettres : le nombre de RÉDACTIONS annoncé par les
// cartes de liens. Rien ne le relie au `pool` de NewsBrowser.jsx.
//
// Et il a mordu. En ajoutant NEWS.am, la liste anglaise est passée de six
// sources à sept ; `pages/lien.org.html` a continué d'annoncer « Six Armenian
// newsrooms » à cinq endroits (description, og, twitter, corps, tuile). Aucun
// build, aucun lint, aucun test ne s'en est plaint — le compteur des radios
// était garde, celui des rédactions ne l'était pas.
//
// Le nombre dépend de la LANGUE : chaque langue n'affiche que les sources qui
// publient dans cette langue. La carte d'une vitrine doit donc annoncer le
// compte de sa langue de tête — fr pour le .ch, en pour le .org.
//
// On lit NewsBrowser.jsx comme du TEXTE : Node ne sait pas importer du JSX
// (ERR_UNKNOWN_FILE_EXTENSION), exactement comme pour Radio.jsx.
const MOTS = {
  fr: { 4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept', 8: 'Huit', 9: 'Neuf', 10: 'Dix' },
  en: { 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten' },
}

// TAB_ORDER porte désormais l'ordre ET la présence, une entrée par langue.
// (Il a remplacé un ternaire `pool` + tri alphabétique ; ce test lisait les
// branches du ternaire.)
function poolsParLangue() {
  const src = read('src/components/NewsBrowser.jsx')
  const bloc = src.match(/const TAB_ORDER = \{[\s\S]*?\n\}/)
  assert.ok(bloc, 'tableau TAB_ORDER introuvable dans NewsBrowser.jsx')
  const pools = {}
  for (const m of bloc[0].matchAll(/(\w+):\s*\[([\s\S]*?)\]/g)) {
    pools[m[1]] = (m[2].match(/'[^']+'/g) || []).length
  }
  return pools
}

test('chaque langue déclare un pool de sources non vide', () => {
  const pools = poolsParLangue()
  for (const [lang, n] of Object.entries(pools)) {
    assert.ok(n >= 1, `pool ${lang} vide`)
    assert.ok(MOTS.fr[n] && MOTS.en[n], `nombre ${n} absent de MOTS — ajoutez-le`)
  }
})

// Dérivé de `standalone`, comme le test des radios : ajouter une carte l'ajoute
// au contrôle sans toucher ici.
test('les cartes de liens annoncent le nombre de rédactions de leur langue', () => {
  const pools = poolsParLangue()
  for (const site of Object.values(SITES)) {
    const lang = primaryLang(site.id)
    const mot = MOTS[lang]?.[pools[lang]]
    assert.ok(mot, `pas de mot pour ${pools[lang]} sources en ${lang}`)
    // fr : « Sept rédactions arméniennes » ; en : « Seven Armenian newsrooms ».
    // Insensible à la casse : le corps de page écrit la même phrase en minuscule.
    const attendu = lang === 'fr' ? `${mot} rédactions` : `${mot} Armenian newsrooms`
    for (const name of site.standalone ?? []) {
      const html = read(`pages/${name}.${site.id}.html`)
      assert.ok(
        html.toLowerCase().includes(attendu.toLowerCase()),
        `pages/${name}.${site.id}.html n'annonce pas « ${attendu} » (pool ${lang} = ${pools[lang]})`,
      )
    }
  }
})
