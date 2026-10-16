// AU BUILD, CE FICHIER EST FILTRÉ À LA VITRINE : le plugin `lightData()` de
// vite.config.js ne laisse passer que les langues que le site bâti sert (fr sur
// le .ch ; en/hy/ru sur le .org), via `newsForLangs` et le `TAB_ORDER`
// ci-dessous. Le bundle du .ch ne contient donc aucune dépêche anglaise — c'est
// voulu (−400 Ko de JSON brut), et c'est pourquoi `TAB_ORDER` décide AUSSI de
// ce qui est embarqué, pas seulement de ce qui est affiché.
import news from './data/news.json'

import { TAB_ORDER, feedFor } from './newsLangs.js'

export { TAB_ORDER }

// Les étagères brutes d'une source pour une langue. Toujours un tableau : une
// source absente du snapshot rend [], jamais undefined.
export function shelvesFor(id, lang) {
  return feedFor(news, id, lang)
}

// Les sources réellement affichées pour une langue : nommées dans TAB_ORDER ET
// portant au moins une étagère remplie. C'est le même critère que celui de
// `buildSources` (NewsBrowser.jsx) — il passe par la même lecture, donc les
// deux ne peuvent pas diverger.
export function visibleSources(lang) {
  return (TAB_ORDER[lang] || TAB_ORDER.fr).filter((id) =>
    shelvesFor(id, lang).some((s) => s.articles?.length),
  )
}
