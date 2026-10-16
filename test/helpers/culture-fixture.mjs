// Fabrique un dossier d'article valide sur disque. Chaque test le casse
// ensuite d'UNE façon, pour que l'échec observé ait une seule cause.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { serializeFrontMatter, bodyHash } from '../../scripts/lib/culture-markdown.mjs'

export const FR_BODY = 'Premier paragraphe.\n\n## Intertitre\n\nSecond paragraphe.'

export const candidate = (i = 0, extra = {}) => ({
  file: `File:K${i}.jpg`, thumbUrl: `https://upload.wikimedia.org/k${i}.jpg`, width: 1600, height: 1000,
  author: 'Auteur', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  commonsUrl: `https://commons.wikimedia.org/wiki/File:K${i}.jpg`, ...extra,
})

export function meta(slug, extra = {}) {
  return {
    slug,
    sources: [{ lang: 'fr', title: 'Komitas', url: 'https://fr.wikipedia.org/wiki/Komitas', revision: 1 }],
    candidates: [candidate(0), candidate(1)],
    imageChoice: 0,
    image: { ...candidate(0), width: 1200, height: 750 },
    agendaEvent: null,
    overlap: 0.02,
    model: 'gemini-flash-latest',
    ...extra,
  }
}

export function texts({ date = '2026-10-19', title = 'Komitas', frBody = FR_BODY } = {}) {
  const fr = serializeFrontMatter({ title, description: 'Le père de la musique arménienne.', date }, frBody)
  const tr = (l) =>
    serializeFrontMatter(
      { title: `${title} ${l}`, description: `Desc ${l}`, date, sourceHash: bodyHash(frBody), model: 'm' },
      `Body ${l}.`,
    )
  return { fr, en: tr('en'), hy: tr('hy'), ru: tr('ru') }
}

export async function writeArticle(dir, slug, { m = meta(slug), t = texts(), images = true } = {}) {
  const base = path.join(dir, slug)
  await mkdir(base, { recursive: true })
  await writeFile(path.join(base, 'meta.json'), JSON.stringify(m, null, 2))
  for (const [l, v] of Object.entries(t)) if (v !== null) await writeFile(path.join(base, `${l}.md`), v)
  if (images) {
    await writeFile(path.join(base, 'image.webp'), 'w')
    await writeFile(path.join(base, 'image.jpg'), 'j')
  }
}
