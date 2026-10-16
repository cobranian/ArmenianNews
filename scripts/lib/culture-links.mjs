// Les liens entre versions d'un article, partagés par l'en-tête HTML
// (site-meta.mjs), le sitemap et check-build : trois générateurs qui
// divergeraient feraient ignorer le bloc hreflang par Google.
//
// LE PIÈGE, le même que la brève : un article ne cite QUE ses langues
// présentes. Une traduction absente ou périmée n'est pas publiée ; un
// hreflang vers elle ferait ignorer TOUT le bloc. L'index, lui, existe
// toujours dans les quatre langues.
//
// Sans node:fs : vite.config.js l'importe aussi.
import { ALL_LANGS, cultureUrl } from '../../sites.config.js'

export function cultureLangsBySlug(articles) {
  return new Map(articles.map((a) => [a.slug, ALL_LANGS.filter((l) => a.langs[l])]))
}

export function cultureAlternates(slug, bySlug) {
  const langs = slug === null ? ALL_LANGS : (bySlug.get(slug) ?? [])
  const out = langs.map((l) => [l, cultureUrl(l, slug)])
  if (langs.includes('en')) out.push(['x-default', cultureUrl('en', slug)])
  return out
}

export function teaserFor(articles, langs, n = 3) {
  return Object.fromEntries(
    langs.map((l) => [
      l,
      articles
        .filter((a) => a.langs[l])
        .slice(0, n)
        .map((a) => ({ slug: a.slug, title: a.langs[l].title, description: a.langs[l].description, date: a.date })),
    ]),
  )
}
