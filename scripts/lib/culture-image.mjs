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
import { focusY } from './culture-focus.mjs'

export const PAGE_WIDTH = 1200
export const CARD = { width: 1200, height: 630 }

export async function makeImages(buf, { focusY: wanted } = {}) {
  const base = sharp(buf).rotate()
  const page = await base
    .clone()
    .resize({ width: PAGE_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true })
  const jpg = await cardJpeg(base, wanted, page.info)
  return { webp: page.data, width: page.info.width, height: page.info.height, jpg }
}

// La carte 1200×630. Cadrage vertical : `wanted` (meta.json image.focusY),
// sinon le haut pour une image plus haute que large (culture-focus.mjs),
// sinon « là où l'œil va » (sharp 'attention'), qui réussit aux paysages
// mais avait gardé le socle de David de Sassoun et coupé la tête de la
// statue d'Aznavour.
async function cardJpeg(base, wanted, { width: w, height: h }) {
  const f = focusY({ width: w, height: h, focusY: wanted })
  let img = base.clone()
  if (f == null) {
    img = img.resize(CARD.width, CARD.height, { fit: 'cover', position: 'attention' })
  } else {
    const scale = Math.max(CARD.width / w, CARD.height / h)
    const rw = Math.max(CARD.width, Math.round(w * scale))
    const rh = Math.max(CARD.height, Math.round(h * scale))
    img = sharp(await img.resize(rw, rh).toBuffer()).extract({
      left: Math.round((rw - CARD.width) / 2),
      top: Math.round((rh - CARD.height) * f),
      width: CARD.width,
      height: CARD.height,
    })
  }
  return img.toColourspace('srgb').jpeg({ quality: 82, mozjpeg: true }).toBuffer()
}
