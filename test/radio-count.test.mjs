import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_LANGS, SITES, primaryLang } from '../sites.config.js'
import { VIEW_SEO } from '../src/seo.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(root, rel), 'utf-8')

// Le nombre de stations est écrit EN TOUTES LETTRES dans trois fichiers, et
// quatorze chaînes : les quatre `radio.subtitle`, les quatre `radio.more`, les
// quatre couples `radio.page.intro` / `radio.page.list` de src/i18n.jsx, les
// quatre `VIEW_SEO.radio.*.description` de src/seo.js, et les cartes de liens
// de pages/. `t()` ne sait pas interpoler (c'est une simple recherche par clé),
// donc rien ne relie ces chaînes au tableau STATIONS de Radio.jsx.
//
// Sans ce test, ajouter une douzième station ferait mentir tous ces textes d'un
// coup, en quatre langues, sans qu'aucun build ni aucun lint ne s'en plaigne.
// C'est exactement le mode d'échec que le site portait déjà : son sous-titre
// n'annonçait que « la Radio publique » alors que onze stations étaient
// diffusées. Les descriptions de src/seo.js sont le cas le plus coûteux : ce
// sont elles qui s'affichent dans les résultats Google.
//
// On lit Radio.jsx et i18n.jsx comme du TEXTE : Node ne sait pas importer du
// JSX (ERR_UNKNOWN_FILE_EXTENSION), même raison qui a fait sortir LANGS de
// src/i18n.jsx vers sites.config.js. src/seo.js, lui, est un module plat : on
// l'importe.
const NOMBRES = {
  fr: 'Douze',
  en: 'Twelve',
  hy: 'Տասներկու',
  ru: 'Двенадцать',
}
const ATTENDU = 12

// Les endroits à mettre à jour quand ce nombre change. Enuméré dans CHAQUE
// message d'échec : un message qui n'en cite qu'une partie fait réparer une
// partie, et les tests repassent au vert sur des textes encore faux.
const OU = [
  'ATTENDU et NOMBRES dans ce fichier',
  'les quatre « radio.subtitle » de src/i18n.jsx',
  'les quatre « radio.more » de src/i18n.jsx',
  'les quatre « radio.page.intro » et « radio.page.list » de src/i18n.jsx',
  'les quatre VIEW_SEO.radio.*.description de src/seo.js',
  'les cartes pages/lien.{ch,org}.html',
].join(', ')

// Contient le nombre attendu, quelle que soit la casse de son initiale — les
// textes l'écrivent tantôt en tête de phrase, tantôt au fil du texte.
const annonce = (texte, lang) =>
  texte.includes(NOMBRES[lang]) || texte.includes(NOMBRES[lang].toLowerCase())

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
    `Radio.jsx ne déclare plus ${ATTENDU} stations. Mettez à jour : ${OU}.`,
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
      `radio.subtitle (${lang}) devrait commencer par « ${NOMBRES[lang]} » : ${trouves[i]}. ` +
        `À mettre à jour : ${OU}.`,
    )
  })
})

// `radio.more` est le TEXTE DU LIEN de l'accueil vers /radio/ — l'ancre que
// Google lit pour comprendre de quoi traite la page visée. Les quatre
// traductions annoncent le nombre ; la française l'annonçait seule autrement,
// ce qui laissait trois textes hors de toute garde.
test('les quatre libellés du lien vers /radio/ annoncent le même nombre', () => {
  const src = read('src/i18n.jsx')
  const trouves = [...src.matchAll(/'radio\.more':\s*'([^']*)'/g)].map((m) => m[1])
  assert.equal(trouves.length, ALL_LANGS.length, `${ALL_LANGS.length} « radio.more » attendus`)
  ALL_LANGS.forEach((lang, i) => {
    assert.ok(
      annonce(trouves[i], lang),
      `radio.more (${lang}) devrait annoncer « ${NOMBRES[lang]} » : ${trouves[i]}. ` +
        `À mettre à jour : ${OU}.`,
    )
  })
})

// LE CAS LE PLUS COÛTEUX. Ces quatre descriptions sont ce que Google affiche
// sous le titre dans ses résultats : elles annonceraient douze stations à un
// lecteur qui en trouverait treize. Elles vivent dans un module PLAT, donc on
// les importe au lieu de les lire au regex.
test('les quatre meta descriptions de /radio/ annoncent le même nombre', () => {
  for (const lang of ALL_LANGS) {
    const d = VIEW_SEO.radio[lang]?.description
    assert.ok(d, `VIEW_SEO.radio.${lang}.description manquante`)
    assert.ok(
      annonce(d, lang),
      `VIEW_SEO.radio.${lang}.description devrait annoncer « ${NOMBRES[lang]} » : ${d}. ` +
        `À mettre à jour : ${OU}.`,
    )
  }
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
        `pages/${name}.${site.id}.html n'annonce pas « ${mot} » radios. À mettre à jour : ${OU}.`,
      )
    }
  }
})

// Les deux textes de la page /radio/ annoncent eux aussi le nombre de stations,
// et `t()` ne sait toujours pas interpoler. Meme mode d'echec que radio.subtitle,
// sur deux cles de plus. On lit i18n.jsx comme du texte, comme le reste du
// fichier.
test('les textes de la page /radio annoncent le meme nombre', () => {
  const src = read('src/i18n.jsx')
  for (const cle of ['radio.page.intro', 'radio.page.list']) {
    const trouves = [...src.matchAll(new RegExp(`'${cle}':\\s*\n?\\s*'([^']*)'`, 'g'))].map(
      (m) => m[1],
    )
    assert.equal(trouves.length, ALL_LANGS.length, `${ALL_LANGS.length} « ${cle} » attendus`)
    ALL_LANGS.forEach((lang, i) => {
      assert.ok(
        annonce(trouves[i], lang),
        `${cle} (${lang}) devrait annoncer « ${NOMBRES[lang]} » : ${trouves[i]}. ` +
          `À mettre à jour : ${OU}.`,
      )
    })
  }
})
