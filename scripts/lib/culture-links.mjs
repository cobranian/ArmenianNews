// Les liens entre versions d'un article, partagés par l'en-tête HTML
// (site-meta.mjs), le sitemap et check-build : trois générateurs qui
// divergeraient feraient ignorer le bloc hreflang par Google.
//
// LE PIÈGE, le même que la brève : un article ne cite QUE ses langues
// présentes. Une traduction absente ou périmée n'est pas publiée ; un
// hreflang vers elle ferait ignorer TOUT le bloc. L'index est servi dans
// toutes les langues, mais vide il est noindex : un index ne cite donc que les
// index qui ont au moins un article, plus lui-même.
//
// Sans node:fs : vite.config.js l'importe aussi.
import { ALL_LANGS, cultureUrl } from '../../sites.config.js'
import { focusY } from './culture-focus.mjs'

export function cultureLangsBySlug(articles) {
  return new Map(articles.map((a) => [a.slug, ALL_LANGS.filter((l) => a.langs[l])]))
}

// `lang` : la langue de la page, pour l'index seulement (il se cite toujours).
export function cultureAlternates(slug, bySlug, lang = null) {
  const present = new Set([...bySlug.values()].flat())
  const langs = slug === null
    ? ALL_LANGS.filter((l) => l === lang || present.has(l))
    : (bySlug.get(slug) ?? [])
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
        .map((a) => ({
          slug: a.slug,
          title: a.langs[l].title,
          description: a.langs[l].description,
          date: a.date,
          // Le carrousel de l'accueil pose l'image copiée au build
          // (cultureImagePath) ; false → motif, jamais d'<img> vers un 404.
          image: Boolean(a.image),
          // Cadrage vertical (culture-focus.mjs) : null = centre.
          focus: focusY(a.image),
        })),
    ]),
  )
}
