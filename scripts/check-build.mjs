/**
 * Contrôle ce que le build a réellement produit.
 *
 *   npm run check          # après npm run build
 *
 * Dérivé de sites.config.js : ajouter une page ou une langue étend
 * automatiquement le contrôle, sans toucher à ce fichier.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITES, LANG_URL, ALL_LANGS } from '../sites.config.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let bad = 0

for (const site of Object.values(SITES)) {
  for (const page of site.pages) {
    const rel = path.join('dist', site.id, page.path.replace(/^\//, ''), 'index.html')
    let html
    try {
      html = await readFile(path.join(root, rel), 'utf-8')
    } catch {
      console.error(`✗ ${rel} — absent`)
      bad++
      continue
    }

    // Compter, pas seulement constater la présence. Un `includes` ne distingue
    // pas « présent une fois » de « présent trois fois » — or le mode d'échec
    // qui compte ici est justement la DUPLICATION : si replaceMeta cessait
    // d'être idempotent, chaque page accumulerait plusieurs blocs <head>, donc
    // plusieurs canonical et plusieurs jeux de hreflang. C'est pire que rien :
    // Google n'arbitre pas, il écarte.
    const count = (re) => (html.match(re) || []).length

    const checks = [
      [`<html lang="${page.lang}">`, html.includes(`<html lang="${page.lang}"`)],
      ['un seul <html>', count(/<html\s/g) === 1],
      [
        `canonical ${LANG_URL[page.lang]}`,
        html.includes(`rel="canonical" href="${LANG_URL[page.lang]}" />`),
      ],
      ['un seul canonical', count(/rel="canonical"/g) === 1],
      [`og:site_name "${site.brand}"`, html.includes(`og:site_name" content="${site.brand}"`)],
      ['un seul og:site_name', count(/og:site_name"/g) === 1],
      ['un seul <title>', count(/<title>/g) === 1],
      [
        'les 4 hreflang, réciproques',
        ALL_LANGS.every((l) => html.includes(`hreflang="${l}" href="${LANG_URL[l]}"`)),
      ],
      ['5 alternate exactement (4 langues + x-default)', count(/rel="alternate"/g) === 5],
      ['x-default', html.includes('hreflang="x-default"')],
      ['une seule paire de sentinelles', count(/<!--SITE_META:START-->/g) === 1],
      ['theme-color préservé, une fois', count(/name="theme-color"/g) === 1],
      ['GA4 intact', html.includes('G-EB3W5XXSMW')],
      // Le beacon Cloudflare porte le jeton de SA vitrine, et rien d'autre.
      // Le mode d'échec visé n'est pas « absent » mais « celui du voisin » :
      // une page du .org portant le jeton du .ch se mesure sans erreur, dans le
      // mauvais tableau de bord, et rien ne le signale.
      [
        site.cfBeaconToken ? `beacon ${site.id} (${site.cfBeaconToken.slice(0, 8)}…)` : 'sans beacon',
        site.cfBeaconToken
          ? count(new RegExp(site.cfBeaconToken, 'g')) === 1
          : !html.includes('static.cloudflareinsights.com'),
      ],
      [
        'aucun jeton beacon étranger',
        Object.values(SITES)
          .filter((s) => s.id !== site.id && s.cfBeaconToken)
          .every((s) => !html.includes(s.cfBeaconToken)),
      ],
      // Même mode d'échec pour la vérification Search Console : une page portant
      // le jeton de l'autre vitrine se déploie sans erreur et ne valide jamais.
      [
        site.gscToken ? `vérification GSC ${site.id}` : 'sans balise GSC',
        site.gscToken
          ? count(new RegExp(`content="${site.gscToken}"`, 'g')) === 1
          : !html.includes('google-site-verification'),
      ],
      [
        'aucun jeton GSC étranger',
        Object.values(SITES)
          .filter((s) => s.id !== site.id && s.gscToken)
          .every((s) => !html.includes(s.gscToken)),
      ],
    ]

    const failed = checks.filter(([, ok]) => !ok).map(([name]) => name)
    if (failed.length) {
      console.error(`✗ ${rel}\n    ${failed.join('\n    ')}`)
      bad += failed.length
    } else {
      console.log(`✓ ${rel} (${page.lang})`)
    }
  }
}

// Les fichiers SEO sont écrits hors du flux des pages : sans ce contrôle,
// `npm run check` peut valider quatre pages parfaites alors que les deux
// sitemaps manquent. C'est arrivé — voir la revue de Task 8.
for (const site of Object.values(SITES)) {
  const dir = path.join(root, 'dist', site.id)

  let xml
  try {
    xml = await readFile(path.join(dir, 'sitemap.xml'), 'utf-8')
  } catch {
    console.error(`✗ dist/${site.id}/sitemap.xml — absent`)
    bad++
    continue
  }
  const urls = (xml.match(/<url>/g) || []).length
  const dates = (xml.match(/<lastmod>/g) || []).length
  const alts = (xml.match(/xhtml:link/g) || []).length
  const attendu = site.pages.length
  const checks = [
    [`${attendu} <url>`, urls === attendu],
    [`${attendu} <lastmod>`, dates === attendu],
    [`${attendu * (ALL_LANGS.length + 1)} xhtml:link`, alts === attendu * (ALL_LANGS.length + 1)],
    ['host du site dans les <loc>', xml.includes(`<loc>${site.host}/`)],
  ]
  const rates = checks.filter(([, ok]) => !ok).map(([n]) => n)
  if (rates.length) {
    console.error(`✗ dist/${site.id}/sitemap.xml\n    ${rates.join('\n    ')}`)
    bad += rates.length
  } else {
    console.log(`✓ dist/${site.id}/sitemap.xml (${urls} url)`)
  }

  try {
    const robots = await readFile(path.join(dir, 'robots.txt'), 'utf-8')
    if (!robots.includes(`Sitemap: ${site.host}/sitemap.xml`)) {
      console.error(`✗ dist/${site.id}/robots.txt — ne pointe pas sur ${site.host}/sitemap.xml`)
      bad++
    } else {
      console.log(`✓ dist/${site.id}/robots.txt`)
    }
  } catch {
    console.error(`✗ dist/${site.id}/robots.txt — absent`)
    bad++
  }
}

if (bad) {
  console.error(`\n${bad} problème(s)`)
  process.exit(1)
}
console.log('\n✓ toutes les pages sont conformes')
