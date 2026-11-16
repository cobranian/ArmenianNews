// Titre et description YouTube de chaque Short, à coller à la mise en ligne.
//
//   node scripts/describe.mjs [fr|en|hy|ru|de|it|es]   → out/youtube/<slug>-<lang>.json
//
// La licence décide de la dernière ligne : une photo CC BY-SA oblige la vidéo
// à la même licence (partage dans les mêmes conditions) ; domaine public, CC0
// et CC BY n'imposent que la mention de l'auteur.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lang = process.argv[2] ?? 'fr'
const credits = JSON.parse(await readFile(path.join(root, 'src/shorts/credits.json'), 'utf-8'))
const outDir = path.join(root, 'out/youtube')
await mkdir(outDir, { recursive: true })

// hy, ru, de et it : mêmes formules que out/youtube/translations.json ; es sur
// le même modèle. Les liens suivent cultureUrl() de ArmenianNews/sites.config.js.
const SITE = {
  fr: 'https://armenieinfo.ch/culture/',
  en: 'https://armenianews.org/culture/',
  hy: 'https://armenianews.org/hy/culture/',
  ru: 'https://armenianews.org/ru/culture/',
  de: 'https://armenieinfo.ch/de/kultur/',
  it: 'https://armenieinfo.ch/it/cultura/',
  es: 'https://armenianews.org/es/cultura/',
}
const TAGS = {
  fr: '#Arménie #culture #histoire #Shorts',
  en: '#Armenia #culture #history #Shorts',
  hy: '#Հայաստան #մշակույթ #պատմություն #Shorts',
  ru: '#Армения #культура #история #Shorts',
  de: '#Armenien #Kultur #Geschichte #Shorts',
  it: '#Armenia #cultura #storia #Shorts',
  es: '#Armenia #cultura #historia #Shorts',
}
const HASH = { fr: '#Arménie', en: '#Armenia', hy: '#Հայաստան', ru: '#Армения', de: '#Armenien', it: '#Armenia', es: '#Armenia' }
const FULL = {
  fr: "L'article complet :",
  en: 'Full article:',
  hy: 'Ամբողջական հոդվածը՝',
  ru: 'Полная статья:',
  de: 'Der vollständige Artikel:',
  it: "L'articolo completo:",
  es: 'Artículo completo:',
}
const PD = {
  fr: 'domaine public',
  hy: 'հանրային սեփականություն',
  ru: 'общественное достояние',
  de: 'gemeinfrei',
  it: 'pubblico dominio',
  es: 'dominio público',
}
const PHOTO = {
  fr: (a, l) => `Photo : ${a}, ${l}, via Wikimedia Commons :`,
  en: (a, l) => `Photo: ${a}, ${l}, via Wikimedia Commons:`,
  hy: (a, l) => `Լուսանկարը՝ ${a}, ${l}, Wikimedia Commons-ի միջոցով՝`,
  ru: (a, l) => `Фото: ${a}, ${l}, через Wikimedia Commons:`,
  de: (a, l) => `Foto: ${a}, ${l}, via Wikimedia Commons:`,
  it: (a, l) => `Foto: ${a}, ${l}, via Wikimedia Commons:`,
  es: (a, l) => `Foto: ${a}, ${l}, vía Wikimedia Commons:`,
}
const SAME = {
  fr: (l) => `Cette vidéo est diffusée sous la même licence (${l}).`,
  en: (l) => `This video is shared under the same licence (${l}).`,
  hy: (l) => `Այս տեսանյութը տարածվում է նույն լիցենզիայով (${l})։`,
  ru: (l) => `Это видео распространяется по той же лицензии (${l}).`,
  de: (l) => `Dieses Video wird unter derselben Lizenz (${l}) veröffentlicht.`,
  it: (l) => `Questo video è distribuito con la stessa licenza (${l}).`,
  es: (l) => `Este vídeo se distribuye bajo la misma licencia (${l}).`,
}
if (!SITE[lang]) throw new Error(`langue inconnue : ${lang}`)

function licenceLines(c) {
  const lic = PD[lang] && /^public domain$/i.test(c.license) ? PD[lang] : c.license
  const lines = [PHOTO[lang](c.author, lic), c.commonsUrl]
  if (/BY-SA/i.test(c.license)) lines.push(SAME[lang](c.license))
  return lines
}

for (const f of (await readdir(path.join(root, 'src/shorts/data'))).filter((x) => x.endsWith('.json'))) {
  const data = JSON.parse(await readFile(path.join(root, 'src/shorts/data', f), 'utf-8'))
  const d = data[lang]
  const url = `${SITE[lang]}${data.slug}/?utm_source=youtube&utm_medium=video`
  const title = `${d.ytTitle} ${HASH[lang]}`
  if (title.length > 100) throw new Error(`${data.slug} : titre de ${title.length} caractères (YouTube : 100 max)`)
  const description = [
    d.ytLead,
    '',
    `${FULL[lang]} ${url}`,
    '',
    ...licenceLines(credits[data.slug]),
    '',
    TAGS[lang],
  ].join('\n')
  await writeFile(path.join(outDir, `${data.slug}-${lang}.json`), `${JSON.stringify({ slug: data.slug, title, description }, null, 2)}\n`)
}
console.log(`descriptions ${lang} écrites dans out/youtube/`)
