/**
 * Contrôle ce que le build a réellement produit.
 *
 *   npm run check          # après npm run build
 *
 * Dérivé de sites.config.js : ajouter une page ou une langue étend
 * automatiquement le contrôle, sans toucher à ce fichier.
 */
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITES, ALL_LANGS, ALL_VIEWS, urlFor, pathFor, primaryLang } from '../sites.config.js'
import { agendaGuardChecks } from './lib/agenda-guard.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let bad = 0

// Le plugin `agendaEventsJsonLd` (vite.config.js) n'injecte son @graph que s'il
// a des événements à baliser. On lit le même fichier avec le même filtre pour
// savoir ce que l'accueil DOIT porter : sans cela, un agenda vide — état
// dégradé légitime, que le plugin tolère explicitement — ferait échouer le
// contrôle et bloquerait un déploiement par ailleurs sain.
//
// Depuis la vue /agenda/ (Task 11), ce contrôle distingue DEUX choses qui se
// recoupaient tant que seul l'accueil existait :
//   - le graphe du PLUGIN (marqué data-ld="agenda") : il ne doit vivre QUE sur
//     l'accueil — /agenda/ pose le sien (le composant, filtré aux événements
//     à venir affichés), et /radio/ n'en montre aucun.
//   - la présence d'`Event` EN GÉNÉRAL : légitime sur l'accueil (via le
//     plugin) ET sur /agenda/ (via le composant), jamais sur /radio/.
// Un simple `includes('"@type":"Event"')` ne peut pas voir cette différence :
// il confondrait le graphe du plugin recopié à tort sur une vue avec le
// balisage propre du composant Agenda. D'où la lecture de l'ATTRIBUT
// (AGENDA_LD_ATTR/AGENDA_LD_VALUE, scripts/lib/agenda-ld.mjs) pour le premier
// point, et un second calcul — les mêmes événements, mais restreints à ceux
// À VENIR — pour savoir si /agenda/ DOIT afficher au moins un Event.
const { agendaAttendu, agendaAVenir } = await (async () => {
  try {
    const a = JSON.parse(await readFile(path.join(root, 'src/data/agenda.json'), 'utf-8'))
    const tous = [...(a.switzerland || []), ...(a.world || [])].filter(
      (e) => e.title && e.date && e.url,
    )
    const maintenant = Date.now()
    return {
      agendaAttendu: tous.length > 0,
      agendaAVenir: tous.some((e) => new Date(e.date).getTime() >= maintenant),
    }
  } catch {
    return { agendaAttendu: false, agendaAVenir: false }
  }
})()

for (const site of Object.values(SITES)) {
  for (const page of site.pages) {
    for (const view of ALL_VIEWS) {
      const dir = pathFor(page.lang, view).replace(/^\//, '')
      const rel = path.join('dist', site.id, dir, 'index.html')
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
          `canonical ${urlFor(page.lang, view)}`,
          html.includes(`rel="canonical" href="${urlFor(page.lang, view)}" />`),
        ],
        ['un seul canonical', count(/rel="canonical"/g) === 1],
        [`og:site_name "${site.brand}"`, html.includes(`og:site_name" content="${site.brand}"`)],
        ['un seul og:site_name', count(/og:site_name"/g) === 1],
        ['un seul <title>', count(/<title>/g) === 1],
        [
          'les 4 hreflang, réciproques ET de la bonne vue',
          ALL_LANGS.every((l) => html.includes(`hreflang="${l}" href="${urlFor(l, view)}"`)),
        ],
        ['5 alternate exactement (4 langues + x-default)', count(/rel="alternate"/g) === 5],
        ['x-default', html.includes('hreflang="x-default"')],
        ['une seule paire de sentinelles', count(/<!--SITE_META:START-->/g) === 1],
        ['theme-color préservé, une fois', count(/name="theme-color"/g) === 1],
        // Le @graph du PLUGIN est injecté hors des sentinelles, donc dérivé
        // avec le reste du HTML par défaut : sans retrait explicite (voir
        // scripts/lib/agenda-ld.mjs), il se recopierait dans toutes les pages
        // dérivées. Il ne doit vivre QUE sur l'accueil — /agenda/ pose le sien
        // (le composant, exact et filtré) et un second graphe y dupliquerait
        // les entités ; /radio/ n'affiche aucun événement. La garde porte sur
        // l'ATTRIBUT du plugin, pas sur la chaîne "@type":"Event" : cette
        // dernière est légitime sur /agenda/ (posée par le composant) et ne
        // permettrait donc pas de distinguer « le bon graphe » du « graphe du
        // plugin recopié à tort ». Logique isolée dans
        // scripts/lib/agenda-guard.mjs, testée par test/agenda-guard.test.mjs
        // — aucun autre lint ni test unitaire ne lit le ld+json du build, donc
        // ce contrôle est le seul à voir le fichier réellement déployé.
        ...agendaGuardChecks(view, html, { agendaAttendu, agendaAVenir }),
        // GA4 : même piège que le beacon, et il a été réel. L'ID était en dur
        // dans index.html et ga-init.js — deux fichiers partagés — donc le .org
        // se mesurait dans la propriété du .ch. Un `includes` sur un ID unique
        // aurait validé cet état exact. On compte donc DEUX occurrences (l'une
        // dans data-ga-id, l'autre dans l'URL de gtag.js) et on interdit
        // explicitement l'ID du voisin.
        [
          site.gaMeasurementId ? `GA4 ${site.id} (${site.gaMeasurementId})` : 'sans GA4',
          site.gaMeasurementId
            ? count(new RegExp(site.gaMeasurementId, 'g')) === 2
            : !html.includes('googletagmanager.com'),
        ],
        [
          'aucun ID GA4 étranger',
          Object.values(SITES)
            .filter((s) => s.id !== site.id && s.gaMeasurementId)
            .every((s) => !html.includes(s.gaMeasurementId)),
        ],
        // L'ordre des deux balises est ce qui rend le Consent Mode effectif :
        // ga-init.js (synchrone) doit précéder gtag.js (async), sinon le premier
        // hit part sans état de consentement. Inversées, les deux balises restent
        // présentes et le contrôle ci-dessus passerait sans rien voir.
        [
          'ga-init.js avant gtag.js',
          !site.gaMeasurementId ||
            (html.indexOf('/ga-init.js') !== -1 &&
              html.indexOf('/ga-init.js') < html.indexOf('googletagmanager.com/gtag/js')),
        ],
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
        // Même famille de piège : la carte de partage porte la marque ET la
        // langue du domaine. Une page du .org annonçant la carte du .ch se
        // déploie sans erreur et sert un aperçu français sous un titre anglais.
        [
          `og:image ${site.ogImage}`,
          html.includes(`content="${site.host}${site.ogImage}"`),
        ],
        [
          'aucune carte de partage étrangère',
          Object.values(SITES)
            .filter((s) => s.id !== site.id)
            .every((s) => !html.includes(s.ogImage)),
        ],
      ]

      const failed = checks.filter(([, ok]) => !ok).map(([name]) => name)
      if (failed.length) {
        console.error(`✗ ${rel}\n    ${failed.join('\n    ')}`)
        bad += failed.length
      } else {
        console.log(`✓ ${rel} (${page.lang}, ${view})`)
      }
    }
  }
}

// Les fichiers SEO sont écrits hors du flux des pages : sans ce contrôle,
// `npm run check` peut valider quatre pages parfaites alors que les deux
// sitemaps manquent. C'est arrivé — voir la revue de Task 8.
for (const site of Object.values(SITES)) {
  const dir = path.join(root, 'dist', site.id)

  // La balise og:image peut être parfaite et le fichier absent : `ogImage` est
  // une chaîne dans sites.config.js, rien n'oblige quiconque à l'avoir généré.
  // Le partage servirait alors un 404 — et comme Firebase réécrit tout chemin
  // manquant vers index.html, ce ne serait même pas un 404 franc mais du HTML
  // servi en 200, que les scrapers lisent comme une image cassée. On vérifie
  // donc le fichier, et qu'il pèse quelque chose.
  const ogPath = path.join(dir, site.ogImage.replace(/^\//, ''))
  try {
    const { size } = await stat(ogPath)
    if (size < 1024) throw new Error('trop petit')
    console.log(`✓ dist/${site.id}${site.ogImage} (${(size / 1024).toFixed(0)} ko)`)
  } catch {
    console.error(`✗ dist/${site.id}${site.ogImage} — absent ou vide (npm run og-image)`)
    bad++
  }

  // Pages autonomes (cartes de liens). Le mode d'échec visé n'est pas
  // « absente » mais « celle du voisin » : la carte française déployée sur
  // armenianews.org se sert sans la moindre erreur, en français, avec la
  // vignette de partage de l'autre domaine. On contrôle donc la langue
  // déclarée, le canonical et l'image — chacun doit désigner CE site, et CETTE
  // page (un canonical recopié d'une carte sur l'autre les ferait toutes deux
  // se déclarer comme la même URL).
  for (const name of site.standalone ?? []) {
    try {
      const lien = await readFile(path.join(dir, `${name}.html`), 'utf-8')
      const attendus = [
        [
          `<html lang="${primaryLang(site.id)}">`,
          lien.includes(`<html lang="${primaryLang(site.id)}"`),
        ],
        [
          `canonical ${site.host}/${name}.html`,
          lien.includes(`rel="canonical" href="${site.host}/${name}.html"`),
        ],
        [`og:image ${site.ogImage}`, lien.includes(`content="${site.host}${site.ogImage}"`)],
        [
          'aucun host ni carte du voisin',
          Object.values(SITES)
            .filter((s) => s.id !== site.id)
            .every((s) => !lien.includes(s.host) && !lien.includes(s.ogImage)),
        ],
      ]
      const kos = attendus.filter(([, ok]) => !ok).map(([n]) => n)
      if (kos.length) {
        console.error(`✗ dist/${site.id}/${name}.html\n    ${kos.join('\n    ')}`)
        bad += kos.length
      } else {
        console.log(`✓ dist/${site.id}/${name}.html (${primaryLang(site.id)})`)
      }
    } catch {
      console.error(`✗ dist/${site.id}/${name}.html — absent (pages/${name}.${site.id}.html ?)`)
      bad++
    }
  }

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
  const attendu = site.pages.length * ALL_VIEWS.length
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
