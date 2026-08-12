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
//
// Il vit désormais dans `src/newsSources.js` — un module JS plat — et non plus
// dans NewsBrowser.jsx : `News.jsx` doit compter les sources pour son bandeau
// sans importer le composant, et un export non-composant dans un `.jsx`
// coûterait un 6e avertissement de lint (voir CLAUDE.md, section Lint). On le
// lit toujours COMME DU TEXTE, faute de mieux : ce module importe news.json, et
// Node refuse un import JSON sans attribut d'import.
function poolsParLangue() {
  const src = read('src/newsSources.js')
  const bloc = src.match(/export const TAB_ORDER = \{[\s\S]*?\n\}/)
  assert.ok(bloc, 'tableau TAB_ORDER introuvable dans src/newsSources.js')
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

// Le bandeau de la section Actualités compte désormais les sources au lieu de
// les nommer en dur (voir News.jsx). Le compte étant dérivé, il ne peut plus
// mentir — mais la CHAÎNE qui l'accueille, elle, le peut de deux façons, et
// toutes deux sont silencieuses :
//
//   · une langue sans la clé retombe sur le français (`t()` vaut
//     STRINGS[lang][clé] ?? STRINGS.fr[clé] ?? clé), donc /hy/ afficherait
//     « 7 rédactions arméniennes » sous une interface arménienne ;
//   · une chaîne sans le gabarit `{n}` rend un bandeau sans aucun nombre, le
//     `.replace()` ne trouvant rien à remplacer.
//
// Ni le lint, ni le build, ni `npm run check` ne lisent ces chaînes. Même
// mécanique que le contrôle des genres de station (stations.test.mjs).
test('le bandeau des actualités a sa chaîne, avec {n}, dans les quatre langues', () => {
  const src = read('src/i18n.jsx')
  const valeurs = [...src.matchAll(/'news\.sources':\s*'([^']*)'/g)].map((m) => m[1])
  assert.equal(
    valeurs.length,
    4,
    `'news.sources' déclarée ${valeurs.length} fois, attendu 4 (une par langue)`,
  )
  for (const v of valeurs) {
    assert.ok(v.includes('{n}'), `« ${v} » ne porte pas le gabarit {n}`)
  }
})
