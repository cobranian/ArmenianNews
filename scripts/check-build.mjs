/**
 * Contrôle ce que le build a réellement produit.
 *
 *   npm run build && npm run check     # l'ordre de la CI, celui qui fait foi
 *
 * ATTENTION À L'ORDRE, il n'est pas le même des deux côtés et ça a déjà bloqué
 * un déploiement. Le workflow horaire enchaîne `build` → **`check`** →
 * `screenshot` → `prerender` → deploy : ce script y voit donc le HTML SORTI DU
 * BUILD, racine React encore vide, sans une ligne de ce que rendent les
 * composants. Au poste de travail on enchaîne naturellement `build` →
 * `prerender` → `check`, et l'on juge alors un HTML déjà cuit. Toute
 * vérification portant sur du contenu rendu par React doit donc regarder le
 * stade (voir scripts/lib/agenda-guard.mjs) — sinon elle passe en local et
 * échoue en CI, sur des pages parfaitement saines.
 *
 * Dérivé de sites.config.js : ajouter une page ou une langue étend
 * automatiquement le contrôle, sans toucher à ce fichier.
 */
import { access, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { newsletterAction, SITES, ALL_LANGS, LANG_SWITCH_LABEL, ALL_VIEWS, BRIEF_SLUGS, CULTURE_SLUGS, VIEWS, urlFor, pathFor, primaryLang, briefUrl, briefPath, cultureUrl, culturePath, cultureImagePath, feedUrl, feedPath } from '../sites.config.js'
import { loadCulture } from './lib/culture-load.mjs'
import { cultureLangsBySlug, cultureAlternates } from './lib/culture-links.mjs'
import { evenementComplet, evenementsAVenir } from '../src/agendaEvents.js'
import { agendaGuardChecks } from './lib/agenda-guard.mjs'
import { loadBriefs, briefLangHrefs } from './lib/brief-pages.mjs'
import { cultureLangHrefs } from './lib/culture-pages.mjs'
import { agendaPaysAlternates } from './lib/site-meta.mjs'

// Les contrôles d'audience (GA4 + beacon Cloudflare) d'une page de la vitrine
// `site`. Partagés entre les pages React et les cartes de liens de pages/ :
// ce sont les cartes qu'on partage sur les réseaux, et elles sont restées sans
// mesure jusqu'au 19 octobre 2026 parce qu'aucun contrôle ne les regardait.
function analyticsChecks(site, html) {
  const count = (re) => (html.match(re) || []).length
  return [
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
        : !html.includes('/cf-init.js'),
    ],
    [
      'aucun jeton beacon étranger',
      Object.values(SITES)
        .filter((s) => s.id !== site.id && s.cfBeaconToken)
        .every((s) => !html.includes(s.cfBeaconToken)),
    ],
  ]
}

import { briefLangsByDate, briefAlternates } from './lib/brief-links.mjs'

// Une entrée de sitemap de brève ou de Culture, quel que soit le slug de sa
// langue (breve, in-kuerze, kultur…) — dérivé des tables, pas écrit ici.
const SECTION_LOC = new RegExp(
  `<loc>[^<]*/(${[...new Set([...Object.values(BRIEF_SLUGS), ...Object.values(CULTURE_SLUGS)])]
    .map((x) => x.slice(0, -1))
    .join('|')})/`,
)

// Une entrée de page Agenda par pays : un segment SOUS le slug de la vue agenda
// (/agenda/suisse/, /events/france/). Le slug seul est la vue elle-même, que
// le décompte des vues doit garder — d'où l'exigence d'un second segment.
const AGENDA_SLUGS = [...new Set(Object.values(VIEWS.agenda.slugs))].map((x) => x.slice(0, -1))
const PAYS_LOC = new RegExp(`<loc>[^<]*/(${AGENDA_SLUGS.join('|')})/[a-z0-9-]+/</loc>`)

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
    // Les deux filtres viennent de src/agendaEvents.js, comme le plugin et la
    // vue : ce contrôle doit juger sur la liste que ces deux-là produisent, pas
    // sur une troisième écrite ici et libre d'en diverger.
    const tous = [...(a.switzerland || []), ...(a.world || [])]
    return {
      agendaAttendu: tous.filter(evenementComplet).length > 0,
      agendaAVenir: evenementsAVenir(tous).length > 0,
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
        [
          // Le formulaire d'inscription : seulement si la liste de la langue
          // de la page a un compte. Vu après prérendu (avant, la racine est
          // vide : la garde ne peut alors pas échouer).
          'formulaire newsletter : seulement si la liste de cette langue a un compte',
          !html.includes('footer__newsletter') || newsletterAction(site.id, page.lang) !== null,
        ],
        [`og:site_name "${site.brand}"`, html.includes(`og:site_name" content="${site.brand}"`)],
        ['un seul og:site_name', count(/og:site_name"/g) === 1],
        ['un seul <title>', count(/<title>/g) === 1],
        [
          `les ${ALL_LANGS.length} hreflang, réciproques ET de la bonne vue`,
          ALL_LANGS.every((l) => html.includes(`hreflang="${l}" href="${urlFor(l, view)}"`)),
        ],
        [
          `${ALL_LANGS.length + 1} alternate exactement (${ALL_LANGS.length} langues + x-default)`,
          count(/rel="alternate" hreflang=/g) === ALL_LANGS.length + 1,
        ],
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
        ...analyticsChecks(site, html),
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
// `npm run check` peut valider toutes les pages, parfaites, alors que les deux
// sitemaps manquent. C'est arrivé — voir la revue de Task 8.
for (const site of Object.values(SITES)) {
  const dir = path.join(root, 'dist', site.id)

  // La page 404 de la vitrine : Firebase la sert avec un vrai statut 404 à
  // toute URL sans fichier, depuis le retrait du rewrite ** → index.html. Sans
  // elle, Firebase servirait sa propre page d'erreur, nue et en anglais — et
  // rien ne le dirait, puisque le déploiement réussirait. On exige la langue
  // du domaine, le noindex, et aucune URL du voisin.
  try {
    const nf = await readFile(path.join(dir, '404.html'), 'utf-8')
    const kos = [
      [`<html lang="${primaryLang(site.id)}">`, nf.includes(`<html lang="${primaryLang(site.id)}">`)],
      ['noindex', /<meta name="robots" content="noindex/.test(nf)],
      [
        'aucun host du voisin',
        Object.values(SITES)
          .filter((s) => s.id !== site.id)
          .every((s) => !nf.includes(s.host)),
      ],
    ]
      .filter(([, ok]) => !ok)
      .map(([n]) => n)
    if (kos.length) {
      console.error(`✗ dist/${site.id}/404.html\n    ${kos.join('\n    ')}`)
      bad += kos.length
    } else {
      console.log(`✓ dist/${site.id}/404.html (${primaryLang(site.id)})`)
    }
  } catch {
    console.error(`✗ dist/${site.id}/404.html — absent (scripts/lib/not-found.mjs)`)
    bad++
  }

  // La balise og:image peut être parfaite et le fichier absent : `ogImage` est
  // une chaîne dans sites.config.js, rien n'oblige quiconque à l'avoir généré.
  // Le partage servirait alors un 404, que les scrapers lisent comme une image
  // cassée (du temps du rewrite ** → index.html, c'était même du HTML servi en
  // 200 à sa place). On vérifie donc le fichier, et qu'il pèse quelque chose.
  const ogPath = path.join(dir, site.ogImage.replace(/^\//, ''))
  try {
    const { size } = await stat(ogPath)
    if (size < 1024) throw new Error('trop petit')
    console.log(`✓ dist/${site.id}${site.ogImage} (${(size / 1024).toFixed(0)} ko)`)
  } catch {
    console.error(`✗ dist/${site.id}${site.ogImage} — absent ou vide (npm run og-image)`)
    bad++
  }

  // La carte HÉRITÉE du .ch. Plus aucune page ne la référence — le .ch est
  // passé à `og-image-ch.jpg` le 1er août 2026 pour casser le cache des
  // réseaux après le redessin de l'Ararat — mais des aperçus en circulation la
  // pointent encore. La supprimer ne casserait aucun test, aucun build et
  // aucune page : elle rendrait seulement un 404 à ceux qui la demandent, que
  // les scrapers lisent comme une image cassée. Exactement le piège du bloc
  // ci-dessus, sur un fichier que plus rien ne relie au code — donc que rien
  // ne protégerait sans cette ligne.
  if (site.id === 'ch') {
    const legacy = path.join(dir, 'og-image.jpg')
    try {
      const { size } = await stat(legacy)
      if (size < 1024) throw new Error('trop petit')
      console.log(`✓ dist/ch/og-image.jpg (héritée, ${(size / 1024).toFixed(0)} ko)`)
    } catch {
      console.error(
        '✗ dist/ch/og-image.jpg — la carte héritée a disparu.\n' +
          "    Elle n'est plus référencée mais reste demandée par les aperçus\n" +
          '    déjà partagés ; sans elle, ils recevraient un 404.',
      )
      bad++
    }
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
        // noindex sur TOUTES les cartes de liens, pas seulement lien-fr : une
        // carte indexable est une page de 15 ko qui dit la même chose que
        // l'accueil sous un autre titre — un doublon qui se présente à Google
        // en concurrent de la page qu'elle annonce. Le partage social n'en a
        // pas besoin : Facebook et WhatsApp lisent l'Open Graph, pas robots.
        ['noindex', /<meta name="robots" content="noindex/.test(lien)],
        // Les six balises, pas la seule `og:image`. Ces pages sont des HTML
        // complets hors du bundle : `site-meta.mjs` ne les voit pas, donc le
        // bloc complet qu'il pose sur les pages React n'y arrive JAMAIS
        // tout seul. C'est exactement ce qui s'est produit — l'accueil décrivait
        // son image en entier pendant que lien.html n'en annonçait que trois
        // balises, alors que c'est lien.html qu'on partage. Aucun build, aucun
        // test et aucune préversion ne pouvaient le voir : la page était valide,
        // simplement moins bien décrite que sa jumelle.
        ...['secure_url', 'type', 'width', 'height', 'alt'].map((prop) => [
          `og:image:${prop}`,
          new RegExp(
            `<meta property="og:image:${prop}" content="[^"]+"`,
          ).test(lien),
        ]),
        ...analyticsChecks(site, lien),
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
  // Les entrées de la brève et de Culture sont variables : on ne
  // compte ici que les entrées de vue.
  const vues = xml
    .split('<url>')
    .filter((b) => !SECTION_LOC.test(b) && !PAYS_LOC.test(b))
    .join('<url>')
  const urls = (vues.match(/<url>/g) || []).length
  const dates = (vues.match(/<lastmod>/g) || []).length
  const alts = (vues.match(/xhtml:link/g) || []).length
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

  // llms.txt : présent, et ne cite que des URL de SA vitrine (hors le renvoi
  // final vers le llms.txt du voisin).
  try {
    const llms = await readFile(path.join(dir, 'llms.txt'), 'utf-8')
    const other = Object.values(SITES).find((s) => s.id !== site.id)
    const foreign = [...llms.matchAll(/\]\((https:\/\/[^)]+)\)/g)]
      .map((m) => m[1])
      .filter((u) => !u.startsWith(site.host + '/') && u !== `${other?.host}/llms.txt`)
    if (!llms.startsWith(`# ${site.brand}\n`) || foreign.length) {
      console.error(`✗ dist/${site.id}/llms.txt — titre ou URL étrangère (${foreign.slice(0, 3).join(', ')})`)
      bad++
    } else {
      console.log(`✓ dist/${site.id}/llms.txt`)
    }
  } catch {
    console.error(`✗ dist/${site.id}/llms.txt — absent`)
    bad++
  }

  // Flux RSS : un par langue, bien formé, qui se cite lui-même, et aucun
  // élément ne pointe vers l'hôte du voisin.
  for (const { lang } of site.pages) {
    const rel = `dist/${site.id}${feedPath(lang)}`
    try {
      const feed = await readFile(path.join(root, rel), 'utf-8')
      const other = Object.values(SITES).find((s) => s.id !== site.id)
      const foreign = [...feed.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)]
        .map((m) => m[1])
        .filter((u) => u.startsWith(other.host + '/'))
      if (!feed.startsWith('<?xml') || !feed.includes(`<atom:link href="${feedUrl(lang)}"`) || foreign.length) {
        console.error(`✗ ${rel} — en-tête, atom:link ou lien étranger (${foreign.slice(0, 3).join(', ')})`)
        bad++
      } else {
        console.log(`✓ ${rel}`)
      }
    } catch {
      console.error(`✗ ${rel} — absent`)
      bad++
    }
  }
}

// Le sélecteur de langue des pages statiques est le SEUL endroit qui doit
// citer le domaine voisin (.ch ↔ .org). On le retire avant le contrôle
// « cite le voisin », et on exige à la place que ses liens (un par langue) soient
// exactement ceux attendus — un lien vers une traduction absente serait un 404.
const LANG_BAR = /<div class="lang" role="group" aria-label="([^"]*)">.*?<\/div>/
function langBarProblem(html, expected, lang) {
  const hit = html.match(LANG_BAR)
  if (!hit) return 'sélecteur de langue absent'
  const [bar, label] = hit
  if (!LANG_SWITCH_LABEL[lang] || label !== LANG_SWITCH_LABEL[lang]) return `sélecteur de langue : libellé « ${label} »`
  const got = Object.fromEntries([...bar.matchAll(/href="([^"]+)" hreflang="([^"]+)"/g)].map((m) => [m[2], m[1]]))
  return ALL_LANGS.every((l) => got[l] === expected[l]) && Object.keys(got).length === ALL_LANGS.length
    ? null
    : 'sélecteur de langue : liens inattendus'
}

// Les brèves : chaque page attendue existe, dans sa langue, avec SON canonical,
// un bloc hreflang exactement égal à briefAlternates (donc sans langue absente
// ce jour-là), sans le domaine voisin, et listée dans le sitemap (sauf un index
// vide, qui est noindex). Les liens de nav sont rendus par React — non
// vérifiables ici avant le prérendu — et sont gardés par
// test/brief-links-ui.test.mjs.
{
  const briefs = await loadBriefs(path.join(root, 'src/data/briefs'))
  const byDate = briefLangsByDate(briefs)
  for (const site of Object.values(SITES)) {
    const other = Object.values(SITES).find((s) => s.id !== site.id).host
    const sitemap = await readFile(path.join(root, 'dist', site.id, 'sitemap.xml'), 'utf-8').catch(() => '')
    for (const { lang } of site.pages) {
      for (const date of [null, ...(briefs[lang] ?? []).map((b) => b.date)]) {
        const rel = path.join('dist', site.id, briefPath(lang, date).replace(/^\//, ''), 'index.html')
        const html = await readFile(path.join(root, rel), 'utf-8').catch(() => null)
        const fail = (why) => { console.error(`✗ ${rel} — ${why}`); bad++ }
        if (!html) { fail('absent'); continue }
        if (!html.includes(`<html lang="${lang}">`)) fail(`<html lang="${lang}"> manquant`)
        if (!html.includes(`<link rel="canonical" href="${briefUrl(lang, date)}" />`)) fail('canonical')
        const got = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])
        if (JSON.stringify(got) !== JSON.stringify(briefAlternates(date, byDate, lang))) fail('hreflang')
        const barWhy = langBarProblem(html, briefLangHrefs(date, byDate), lang)
        if (barWhy) fail(barWhy)
        const foreign = html.replaceAll(/<link rel="alternate"[^>]+>/g, '').replace(LANG_BAR, '')
        if (foreign.includes(`href="${other}`)) fail(`cite ${other}`)
        if (briefs[lang]?.length && !sitemap.includes(`<loc>${briefUrl(lang, date)}</loc>`)) fail('absente du sitemap')
      }
    }
  }
  console.log('✓ pages de brève contrôlées')
}

// Les pages Culture : chaque page attendue existe, dans sa langue, avec SON
// canonical, un hreflang égal à cultureAlternates (sans langue absente pour
// cet article), sans le domaine voisin, listée au sitemap (sauf un index vide,
// qui est noindex), et l'image d'un article existe vraiment dans dist/ — une
// og:image parfaite sur un fichier absent sert un 404 aux réseaux.
{
  const culture = await loadCulture(path.join(root, 'src/data/culture'), { warn: () => {} })
  const bySlug = cultureLangsBySlug(culture)
  for (const site of Object.values(SITES)) {
    const other = Object.values(SITES).find((s) => s.id !== site.id).host
    const sitemap = await readFile(path.join(root, 'dist', site.id, 'sitemap.xml'), 'utf-8').catch(() => '')
    for (const { lang } of site.pages) {
      const mine = culture.filter((a) => a.langs[lang])
      for (const slug of [null, ...mine.map((a) => a.slug)]) {
        const rel = path.join('dist', site.id, culturePath(lang, slug).replace(/^\//, ''), 'index.html')
        const html = await readFile(path.join(root, rel), 'utf-8').catch(() => null)
        const fail = (why) => { console.error(`✗ ${rel} — ${why}`); bad++ }
        if (!html) { fail('absent'); continue }
        if (!html.includes(`<html lang="${lang}">`)) fail(`<html lang="${lang}"> manquant`)
        if (!html.includes(`<link rel="canonical" href="${cultureUrl(lang, slug)}" />`)) fail('canonical')
        const got = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])
        if (JSON.stringify(got) !== JSON.stringify(cultureAlternates(slug, bySlug, lang))) fail('hreflang')
        const barWhy = langBarProblem(html, cultureLangHrefs(slug, bySlug), lang)
        if (barWhy) fail(barWhy)
        const foreign = html.replaceAll(/<link rel="alternate"[^>]+>/g, '').replace(LANG_BAR, '')
        if (foreign.includes(`href="${other}`)) fail(`cite ${other}`)
        if (mine.length && !sitemap.includes(`<loc>${cultureUrl(lang, slug)}</loc>`)) fail('absente du sitemap')
        const article = slug && mine.find((a) => a.slug === slug)
        if (article?.image) {
          for (const ext of ['webp', 'jpg']) {
            const img = path.join(root, 'dist', site.id, cultureImagePath(slug, ext).replace(/^\//, ''))
            await access(img).catch(() => fail(`image.${ext} absente de dist`))
          }
        }
      }
    }
  }
  console.log('✓ pages Culture contrôlées')
}

// Les pages Agenda par pays. Jugées sur ce que le build a ÉCRIT, pas sur un
// recalcul : ce contrôle tourne quelques minutes après le build, et un
// événement passé entre les deux changerait la liste attendue. Chaque dossier
// présent sous la vue agenda doit être une page saine (langue, canonical,
// hreflang complet, au moins un Event) ; chaque page pays du sitemap doit
// exister et être indexable.
{
  for (const site of Object.values(SITES)) {
    const other = Object.values(SITES).find((s) => s.id !== site.id).host
    const sitemap = await readFile(path.join(root, 'dist', site.id, 'sitemap.xml'), 'utf-8').catch(() => '')
    let n = 0
    for (const { lang } of site.pages) {
      const sub = pathFor(lang, 'agenda').replace(/^\//, '')
      const dirs = (await readdir(path.join(root, 'dist', site.id, sub), { withFileTypes: true }).catch(() => []))
        .filter((d) => d.isDirectory())
      for (const d of dirs) {
        const rel = path.join('dist', site.id, sub, d.name, 'index.html')
        const fail = (why) => { console.error(`✗ ${rel} — ${why}`); bad++ }
        const html = await readFile(path.join(root, rel), 'utf-8').catch(() => null)
        if (!html) { fail('absent'); continue }
        n++
        const key = html.match(/data-agenda-pays="([a-z]+)"/)?.[1]
        if (!key) { fail('data-agenda-pays absent'); continue }
        const url = `${urlFor(lang, 'agenda')}${d.name}/`
        if (!html.includes(`<html lang="${lang}">`)) fail(`<html lang="${lang}"> manquant`)
        if (!html.includes(`<link rel="canonical" href="${url}" />`)) fail('canonical')
        const got = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])
        if (JSON.stringify(got) !== JSON.stringify(agendaPaysAlternates(key))) fail('hreflang')
        const foreign = html.replaceAll(/<link rel="alternate"[^>]+>/g, '').replace(LANG_BAR, '')
        if (foreign.includes(`href="${other}`)) fail(`cite ${other}`)
        if (!html.includes('"@type":"Event"')) fail('aucun Event')
        const noindex = html.includes('<meta name="robots" content="noindex')
        const listed = sitemap.includes(`<loc>${url}</loc>`)
        if (!noindex && !listed) fail('indexable mais absente du sitemap')
        if (noindex && listed) fail('noindex mais listée au sitemap')
      }
    }
    for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (!PAYS_LOC.test(m[0])) continue
      const rel = path.join('dist', site.id, m[1].slice(site.host.length).replace(/^\//, ''), 'index.html')
      await access(path.join(root, rel)).catch(() => { console.error(`✗ sitemap → ${rel} absent`); bad++ })
    }
    console.log(`✓ dist/${site.id} : ${n} pages Agenda par pays contrôlées`)
  }
}

if (bad) {
  console.error(`\n${bad} problème(s)`)
  process.exit(1)
}
console.log('\n✓ toutes les pages sont conformes')
