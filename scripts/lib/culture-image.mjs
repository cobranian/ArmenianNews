//
// Deux fichiers par article :
//   image.webp — l'illustration de la page, 1200 px de large au plus
//                (jamais agrandie) ;
//   image.jpg  — la carte de partage, 1200×630 exactement, sRGB, SANS profil
//                ICC : sans quoi WhatsApp cesse d'afficher l'aperçu, en silence
//                (voir CLAUDE.md, la carte de partage).
// `sharp` est une dépendance de développement : seuls les CLI Culture (CI et
// poste local) l'appellent, jamais le build.
import sharp from 'sharp'

export const PAGE_WIDTH = 1200
export const CARD = { width: 1200, height: 630 }

export async function makeImages(buf) {
  const base = sharp(buf).rotate()
  const page = await base
    .clone()
    .resize({ width: PAGE_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true })
  const jpg = await base
    .clone()
    .resize(CARD.width, CARD.height, { fit: 'cover', position: 'attention' })
    .toColourspace('srgb')
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
  return { webp: page.data, width: page.info.width, height: page.info.height, jpg }
}
