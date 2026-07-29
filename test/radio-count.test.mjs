import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_LANGS, SITES, primaryLang } from '../sites.config.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(root, rel), 'utf-8')

// Le nombre de stations est écrit EN TOUTES LETTRES dans cinq fichiers : les
// quatre traductions de `radio.subtitle` et les deux cartes de liens. `t()` ne
// sait pas interpoler (c'est une simple recherche par clé), donc rien ne relie
// ces chaînes au tableau STATIONS de Radio.jsx.
//
// Sans ce test, ajouter une douzième station ferait mentir six textes d'un
// coup, en quatre langues, sans qu'aucun build ni aucun lint ne s'en plaigne.
// C'est exactement le mode d'échec que le site portait déjà : son sous-titre
// n'annonçait que « la Radio publique » alors que onze stations étaient
// diffusées.
//
// On lit Radio.jsx comme du TEXTE : Node ne sait pas importer du JSX
// (ERR_UNKNOWN_FILE_EXTENSION), même raison qui a fait sortir LANGS de
// src/i18n.jsx vers sites.config.js.
const NOMBRES = {
  fr: 'Onze',
  en: 'Eleven',
  hy: 'Տասնմեկ',
  ru: 'Одиннадцать',
}
const ATTENDU = 11

function compterStations() {
  const src = read('src/components/Radio.jsx')
  const bloc = src.match(/const STATIONS = \[[\s\S]*?\n\]/)
  assert.ok(bloc, 'tableau STATIONS introuvable dans Radio.jsx')
  return (bloc[0].match(/\bid:\s*'[^']+'/g) || []).length
}

test('STATIONS déclare bien le nombre de radios annoncé aux lecteurs', () => {
  assert.equal(
    compterStations(),
    ATTENDU,
    `Radio.jsx ne déclare plus ${ATTENDU} stations. Mettez à jour ATTENDU et NOMBRES ` +
      `ici, les quatre « radio.subtitle » de src/i18n.jsx, et les deux cartes ` +
      `pages/lien.{ch,org}.html.`,
  )
})

test('les quatre sous-titres radio annoncent le même nombre', () => {
  const src = read('src/i18n.jsx')
  const trouves = [...src.matchAll(/'radio\.subtitle':\s*'([^']*)'/g)].map((m) => m[1])

  assert.equal(
    trouves.length,
    ALL_LANGS.length,
    `${ALL_LANGS.length} sous-titres radio attendus, ${trouves.length} trouvés`,
  )

  // Les dictionnaires sont dans l'ordre de ALL_LANGS (fr, en, hy, ru).
  ALL_LANGS.forEach((lang, i) => {
    assert.ok(
      trouves[i].startsWith(NOMBRES[lang]),
      `radio.subtitle (${lang}) devrait commencer par « ${NOMBRES[lang]} » : ${trouves[i]}`,
    )
  })
})

// Dérivé de `standalone` : ajouter une carte l'ajoute au contrôle, sans
// toucher ici. C'est ce qui a manqué quand lien-fr est apparue.
test('toutes les cartes de liens annoncent le même nombre', () => {
  for (const site of Object.values(SITES)) {
    const mot = NOMBRES[primaryLang(site.id)]
    for (const name of site.standalone ?? []) {
      const html = read(`pages/${name}.${site.id}.html`)
      assert.ok(
        html.includes(`${mot} radios`) || html.includes(`${mot} Armenian stations`),
        `pages/${name}.${site.id}.html n'annonce pas « ${mot} » radios`,
      )
    }
  }
})
