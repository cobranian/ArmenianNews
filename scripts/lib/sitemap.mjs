// sitemap.xml et robots.txt, un jeu par vitrine.
//
// Générés au build et non au scrape, parce qu'il en faut désormais deux avec
// des <loc> différents et que public/ est partagé entre les deux sites.
//
// Le commentaire historique de scripts/scrape.mjs mettait en garde : « a push
// to main rebuilds without scraping, and a lastmod from that build would
// announce a freshness that never happened ». La garde tient toujours, et elle
// est respectée ici : `lastmod` vient de src/data/meta.json → generatedAt,
// l'horodatage du DERNIER SCRAPE. Un rebuild sans scrape réémet donc la même
// valeur. Ne jamais y substituer new Date() : ce serait exactement le bug
// contre lequel ce commentaire prévenait.
import { SITES, ALL_LANGS, ALL_VIEWS, urlFor, xDefaultFor } from '../../sites.config.js'

// Les annotations xhtml:link dans le sitemap répètent ce que portent les
// <link hreflang> du HTML. Google accepte les deux et recoupe : c'est une
// redondance voulue, pas un oubli de factorisation.
//
// Les alternates d'une entrée citent la MÊME VUE dans les autres langues. Des
// alternates pointant sur les accueils annonceraient que /radio et l'accueil
// sont la même page en quatre langues — et Google, plutôt que d'arbitrer,
// écarterait le bloc.
function alternates(view) {
  return [
    ...ALL_LANGS.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l, view)}" />`,
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefaultFor(view)}" />`,
  ].join('\n')
}

export function sitemapFor(siteId, lastmod) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  if (!lastmod) throw new Error('lastmod manquant — attendu meta.json → generatedAt')

  const urls = site.pages
    .flatMap((page) =>
      ALL_VIEWS.map(
        (view) => `  <url>
    <loc>${urlFor(page.lang, view)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>${view === 'home' ? '1.0' : '0.8'}</priority>
${alternates(view)}
  </url>`,
      ),
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`
}

export function robotsFor(siteId) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  return `# ${site.brand} — ${site.host}
User-agent: *
Allow: /

Sitemap: ${site.host}/sitemap.xml
`
}
