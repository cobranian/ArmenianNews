/**
 * Les deux allègements de données appliqués AU BUILD par le plugin
 * `lightData()` de vite.config.js. Fonctions pures, testables sans Vite
 * (test/light-data.test.mjs).
 *
 * Pourquoi. Le bundle pesait 1,45 Mo brut (293 Ko brotli) le 21 août 2026, et
 * ce n'était pas du code : `src/data/news.json` (666 Ko, les QUATRE langues)
 * et `src/data/instagram.json` (496 Ko, le POOL entier de 1 448 posts) y
 * étaient inlinés par `import`. Or la vitrine .ch ne rend que le français, le
 * .org jamais le français, et le mur Instagram n'affiche que les 90 posts de
 * `instagram-feed.json` (20 Ko) — du pool, il n'a besoin que des comptes
 * (handle, nom, url, brin) pour les pastilles. Mesuré : 2,5 s de main-thread
 * mobile sur l'accueil, dont l'essentiel à analyser du JSON que la page
 * n'utilise pas.
 */

// Le pool sans ses posts : ce que `Social.jsx` lit vraiment de `ig.accounts`.
// La forme `{ accounts: [...] }` est conservée à l'identique, seules les
// listes `posts` tombent (et `exclude`, qui ne sert qu'au scraper).
export function accountsOnly(pool) {
  return {
    accounts: (pool.accounts ?? []).map(({ posts, ...account }) => account), // eslint-disable-line no-unused-vars
  }
}

// news.json restreint aux langues d'une vitrine.
//
// Deux formes cohabitent dans le fichier (voir src/newsSources.js) : les
// sources indexées par langue (`{ fr: …, en: … }`) et les sources unilingues, en
// liste plate. Pour les premières on ne garde que les langues servies ; pour les
// secondes, `tabOrder` dit sous quelle langue la source paraît — une source
// plate absente de toutes les langues servies disparaît. `generatedAt` passe
// tel quel.
export function newsForLangs(news, langs, tabOrder) {
  const out = {}
  for (const [key, value] of Object.entries(news)) {
    if (key === 'generatedAt') {
      out[key] = value
      continue
    }
    if (Array.isArray(value)) {
      if (langs.some((l) => (tabOrder[l] ?? []).includes(key))) out[key] = value
      continue
    }
    if (value && typeof value === 'object') {
      const kept = Object.fromEntries(Object.entries(value).filter(([l]) => langs.includes(l)))
      if (Object.keys(kept).length) out[key] = kept
    }
  }
  return out
}
