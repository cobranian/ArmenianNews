// Flux RSS 2.0 par langue : les brèves quotidiennes et les articles Culture,
// les plus récents d'abord. Tout est DÉRIVÉ (sites.config.js, src/seo.js,
// chaînes de la brève) : aucune URL écrite à la main.
//
// AUCUNE date ne vient de l'horloge. `lastBuildDate` est la date de l'élément
// le plus récent, jamais `new Date()` : un push sur main rebâtit sans scraper,
// et une date prise au build annoncerait une fraîcheur qui n'a pas eu lieu
// (même règle que le `lastmod` des sitemaps) — et rendrait le XML différent à
// chaque build, donc un « changement » pour les lecteurs de flux.
import { SITES, siteOf, urlFor, briefUrl, cultureUrl, feedUrl } from '../../sites.config.js'
import { SEO } from '../../src/seo.js'
import { BRIEF_STRINGS } from '../../src/briefStrings.js'

export const FEED_MAX = 30

const xml = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

export function feedItems(lang, { briefs = {}, culture = [] } = {}) {
  const items = []
  const b = BRIEF_STRINGS[lang]
  for (const br of briefs?.[lang] ?? []) {
    items.push({
      title: `${b?.title ?? ''} — ${br.date}`,
      url: briefUrl(lang, br.date),
      description: br.intro,
      pubDate: new Date(br.generatedAt),
    })
  }
  for (const a of culture ?? []) {
    const t = a.langs?.[lang]
    if (!t) continue
    items.push({
      title: t.title,
      url: cultureUrl(lang, a.slug),
      description: t.description,
      pubDate: new Date(`${a.date}T00:00:00Z`),
    })
  }
  return items
    .filter((i) => !Number.isNaN(i.pubDate.getTime()))
    .sort((x, y) => y.pubDate - x.pubDate)
    .slice(0, FEED_MAX)
}

export function feedFor(lang, data = {}) {
  const site = SITES[siteOf(lang)]
  const items = feedItems(lang, data)
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${xml(`${site.brand} — ${SEO[lang].tagline}`)}</title>`,
    `<link>${xml(urlFor(lang, 'home'))}</link>`,
    `<description>${xml(SEO[lang].description)}</description>`,
    `<language>${lang}</language>`,
    `<atom:link href="${xml(feedUrl(lang))}" rel="self" type="application/rss+xml"/>`,
  ]
  if (items.length) out.push(`<lastBuildDate>${items[0].pubDate.toUTCString()}</lastBuildDate>`)
  for (const i of items) {
    out.push(
      '<item>',
      `<title>${xml(i.title)}</title>`,
      `<link>${xml(i.url)}</link>`,
      `<guid isPermaLink="true">${xml(i.url)}</guid>`,
      `<pubDate>${i.pubDate.toUTCString()}</pubDate>`,
      `<description>${xml(i.description)}</description>`,
      '</item>',
    )
  }
  out.push('</channel>', '</rss>', '')
  return out.join('\n')
}
