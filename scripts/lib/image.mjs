/**
 * La règle d'encodage des images bundlées, sortie des deux scrapes pour être
 * testable : ceux-ci pilotent un Chrome et ne sont pas exécutables en test.
 *
 * `sharp` est une dépendance de DÉVELOPPEMENT et doit le rester. Les deux
 * scrapes sont manuels et locaux ; ni le build ni la CI n'appellent ce module.
 */
import sharp from 'sharp'

// La tuile rend autour de 300px, et la visionneuse fait `min(1040px, 94vw)` :
// sur un téléphone de 390px elle affiche 367px, soit 734 en rétine. 800 couvre
// les deux. Descendre à 640 agrandirait l'image de 15 % exactement là où le
// lecteur la regarde de près.
export const TARGET_WIDTH = 800

// Mesuré sur 24 images réparties sur toute la distribution des largeurs du
// pool : 243 → 63 ko de moyenne, indiscernable de l'original à la taille
// d'affichage réelle, y compris sur une gravure manuscrite fine.
export const TARGET_QUALITY = 78

/**
 * La largeur de sortie. **N'agrandit jamais** : une image déjà à 500px reste à
 * 500px — agrandir coûterait des octets pour des pixels inventés.
 *
 * Une largeur illisible retombe sur le maximum, pas sur zéro : `sharp` traite
 * `width: 0` comme une erreur, et une image absente se lit comme une panne de
 * réseau alors que c'est un en-tête qu'on n'a pas su lire.
 */
export function targetWidth(sourceWidth, max = TARGET_WIDTH) {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) return max
  return Math.min(sourceWidth, max)
}

/**
 * JPEG, PNG ou WebP en entrée ; WebP redimensionné en sortie.
 *
 * `withoutEnlargement` double `targetWidth` à dessein : la première est la règle
 * qu'on teste sans `sharp`, le second est le garde de `sharp` lui-même. Si
 * `metadata()` ne rend pas de largeur, `targetWidth` retombe sur le maximum et
 * c'est alors ce garde qui empêche l'agrandissement.
 */
export async function encode(buf, { width = TARGET_WIDTH, quality = TARGET_QUALITY } = {}) {
  const img = sharp(buf)
  const { width: source } = await img.metadata()
  return img
    .resize({ width: targetWidth(source, width), withoutEnlargement: true })
    .webp({ quality })
    .toBuffer()
}
