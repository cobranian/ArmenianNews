import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

// LE MODE DE PANNE QUE CE FICHIER EXISTE POUR ATTRAPER. L attribut `loading`
// doit etre declare AVANT `src` : l analyseur HTML decide du chargement differe
// au moment ou `src` est pose, et `loading="lazy"` lu apres n a plus d effet.
// L ordre du JSX se retrouve tel quel dans le HTML PRERENDU, qui est ce que
// recoivent les lecteurs et les robots.
//
// Mesure du 5 aout 2026, production : les 189 images de l accueil se
// telechargeaient AU CHARGEMENT — 11,59 Mo — pour un premier ecran qui n en
// montre AUCUNE (page de 9 724 px, fenetre de 915, premiere image a 2 075 px).
//
// Rien d autre ne le signale : ni le lint, ni les autres tests, ni le build, ni
// npm run check, ni le rendu, ni meme un `npm run preview` sans prerendu — sur
// une racine React vide le differe fonctionne, et le defaut disparait. La page
// est parfaite, simplement 11,6 Mo trop lourde. Sans ce test, le correctif se
// defait au premier refactor qui reordonne des props, en silence.

const DIR = new URL('../src/components/', import.meta.url)

/** Chaque balise <img …/> du fichier, avec sa ligne de depart. */
function balisesImg(src) {
  const out = []
  const re = /<img\b/g
  let m
  while ((m = re.exec(src))) {
    const fin = src.indexOf('/>', m.index)
    if (fin === -1) continue
    out.push({
      ligne: src.slice(0, m.index).split('\n').length,
      corps: src.slice(m.index, fin),
    })
  }
  return out
}

const fichiers = (await readdir(DIR)).filter((f) => f.endsWith('.jsx'))
const balises = []
for (const f of fichiers) {
  const src = await readFile(new URL(f, DIR), 'utf-8')
  for (const b of balisesImg(src)) balises.push({ fichier: f, ...b })
}

// Une <img> SANS `loading` est hors sujet et doit le rester : la visionneuse
// (Lightbox.jsx) montre son image a la demande, elle doit charger tout de suite.
// Le test ne porte que sur celles qui se declarent differees.
const differees = balises.filter((b) => b.corps.includes('loading='))

test('loading est declare AVANT src dans chaque <img> differee', () => {
  for (const b of differees) {
    const iLoading = b.corps.indexOf('loading=')
    const iSrc = b.corps.indexOf('src=')
    assert.notEqual(iSrc, -1, `${b.fichier}:${b.ligne} — <img> differee sans src`)
    assert.ok(
      iLoading < iSrc,
      `${b.fichier}:${b.ligne} — src est declare AVANT loading. L analyseur ` +
        `decide du differe quand src est pose, donc le telechargement part ` +
        `pendant que loading vaut encore eager, et le differe ne mord pas.`,
    )
  }
})

// Sans ce second test, retirer tous les `loading` ferait passer le premier au
// vert sur un tableau vide — un garde qui ne garde plus rien.
test('le depot porte au moins quatre images differees', () => {
  assert.ok(
    differees.length >= 4,
    `attendu au moins 4 <img> differees, trouve ${differees.length}`,
  )
})
