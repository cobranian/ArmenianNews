import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITES, primaryLang } from '../sites.config.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(root, rel), 'utf-8')

// ON CHERCHE DANS LE TEXTE RENDU, PAS DANS LES COMMENTAIRES — et ce n'est pas
// une precaution theorique : ce test est ne faux. Les cartes expliquent leur
// compte juste au-dessus de la ligne qui le porte (« VINGT-QUATRE toiles, pas
// vingt-cinq… »), donc un `includes` sur le fichier entier trouvait la phrase
// attendue DANS LE COMMENTAIRE et passait au vert alors que le texte visible
// annoncait vingt-cinq. Verifie par mutation : sans ce depouillement, changer
// « Twenty-four paintings » en « Twenty-five paintings » ne faisait tomber
// aucun test. Le commentaire qui documente un compteur est exactement le texte
// le plus susceptible de contenir ce compteur.
const rendu = (rel) => read(rel).replace(/<!--[\s\S]*?-->/g, '')

// Troisieme compteur ecrit en toutes lettres dans les cartes de liens, apres
// les radios (radio-count.test.mjs) et les redactions (source-count.test.mjs) :
// le nombre de TOILES du mur Don Narek. Rien ne le relie a facebook.json, et le
// mur bouge — il est passe de 18 a 25 publications le 14 aout 2026, et le
// portrait de Don Narek a change de bout.
//
// Le mode de panne est celui, deja paye deux fois, des deux autres compteurs :
// la carte reste valide, le build passe, le lint passe, `npm run check` passe,
// et elle annonce simplement un nombre faux a tous ceux qui la partagent.
//
// LE NOMBRE ANNONCE N'EST PAS LA TAILLE DU MUR. La photo de Don Narek lui-meme
// en fait partie et n'est pas une toile : elle ferme le carrousel comme une
// signature. `dn-narek` est la troisieme copie de cet identifiant — les deux
// autres sont `PINNED_ID` (scripts/fb-scrape.mjs) et `FB_PINNED_ID`
// (src/components/Social.jsx), qui ne peuvent pas se partager de constante
// (module Node d'un cote, JSX de navigateur de l'autre).
const PINNED_ID = 'dn-narek'

const MOTS = {
  fr: {
    20: 'Vingt',
    21: 'Vingt et une',
    22: 'Vingt-deux',
    23: 'Vingt-trois',
    24: 'Vingt-quatre',
    25: 'Vingt-cinq',
    26: 'Vingt-six',
    27: 'Vingt-sept',
    28: 'Vingt-huit',
    29: 'Vingt-neuf',
    30: 'Trente',
  },
  en: {
    20: 'Twenty',
    21: 'Twenty-one',
    22: 'Twenty-two',
    23: 'Twenty-three',
    24: 'Twenty-four',
    25: 'Twenty-five',
    26: 'Twenty-six',
    27: 'Twenty-seven',
    28: 'Twenty-eight',
    29: 'Twenty-nine',
    30: 'Thirty',
  },
}

const toiles = () => {
  const fb = JSON.parse(read('src/data/facebook.json'))
  return fb.posts.filter((p) => p.id !== PINNED_ID).length
}

test('le mur Don Narek porte un nombre de toiles annoncable', () => {
  const n = toiles()
  assert.ok(n >= 1, 'aucune toile dans src/data/facebook.json')
  assert.ok(
    MOTS.fr[n] && MOTS.en[n],
    `nombre ${n} absent de MOTS — ajoutez-le dans les deux langues`,
  )
})

// Derive de `standalone`, comme les deux autres compteurs : ajouter une carte
// l'ajoute au controle sans toucher ici. Les trois cartes suivent donc
// ensemble, ce qui compte — `lien-fr.ch.html` est la jumelle de `lien.ch.html`
// et diverge en silence quand on n'en modifie qu'une.
test('les cartes de liens annoncent le nombre de toiles du mur', () => {
  const n = toiles()
  for (const site of Object.values(SITES)) {
    const lang = primaryLang(site.id)
    const mot = MOTS[lang]?.[n]
    assert.ok(mot, `pas de mot pour ${n} toiles en ${lang}`)
    // fr : « Vingt-quatre toiles » ; en : « Twenty-four paintings ».
    const attendu = lang === 'fr' ? `${mot} toiles` : `${mot} paintings`
    for (const name of site.standalone ?? []) {
      const html = rendu(`pages/${name}.${site.id}.html`)
      assert.ok(
        html.toLowerCase().includes(attendu.toLowerCase()),
        `pages/${name}.${site.id}.html n'annonce pas « ${attendu} » (mur = ${n} toiles)`,
      )
    }
  }
})

// L'ancre, et c'est le piege que les cartes documentent deja pour #direct : une
// ancre absente ne provoque aucune erreur, le navigateur reste simplement en
// haut de la page. On ne peut pas ouvrir un navigateur ici, mais on peut
// verifier que l'id existe bien la ou le composant le pose.
test('les cartes pointent une ancre que Social.jsx pose reellement', () => {
  const social = read('src/components/Social.jsx')
  assert.ok(
    /id="facebook"/.test(social),
    'src/components/Social.jsx ne pose plus id="facebook" — les cartes de liens pointent dans le vide',
  )
  for (const site of Object.values(SITES)) {
    for (const name of site.standalone ?? []) {
      const html = rendu(`pages/${name}.${site.id}.html`)
      assert.ok(
        html.includes('#facebook'),
        `pages/${name}.${site.id}.html ne mene pas au mur Don Narek`,
      )
    }
  }
})
