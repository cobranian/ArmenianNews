// Les rubriques communes du navigateur d'actualités.
//
// Module JS PLAT, comme src/seo.js et src/newsLangs.js : le scraper (Node),
// les tests et le bundle lisent la même table, et un export non-composant dans
// un .jsx ferait passer le lint de 5 à 6 avertissements. Il n'importe AUCUN
// JSON : Node ne sait pas importer un module qui en importe sans attribut.
//
// Chaque source garde ses propres rubriques dans news.json ; cette table les
// replie sur neuf rubriques communes. Une valeur `{ mixed: défaut }` désigne un
// FIL FOURRE-TOUT (« Top Stories », « Actualité »…) que le scrape classe article
// par article (scripts/lib/classify-rubrics.mjs) et dont le défaut sert de
// repli — c'est ce repli qui rend la panne d'OpenRouter SILENCIEUSE : tout le
// fil atterrit dans son défaut, sans autre signe qu'un « ✗ classify » au log.
//
// Une rubrique d'origine absente d'ici tombe dans DEFAULT_RUBRIC, en silence :
// test/rubric-map.test.mjs confronte cette table au dernier instantané.

export const RUBRICS = [
  'armenie',
  'politique',
  'economie',
  'monde',
  'societe',
  'diaspora',
  'culture',
  'sports',
  'opinion',
]

export const DEFAULT_RUBRIC = 'armenie'

// Cartes par étagère (une étagère = une source dans une rubrique).
export const SHELF_CAP = 12

const mixed = (d) => ({ mixed: d })

export const RUBRIC_MAP = {
  armenpress: {
    armenia: 'armenie',
    economy: 'economie',
    world: 'monde',
    culture: 'culture',
    sports: 'sports',
    'fact-check': mixed('armenie'),
    projects: mixed('armenie'),
  },
  armradio: {
    politics: 'politique',
    society: 'societe',
    economics: 'economie',
    analytics: 'opinion',
    world: 'monde',
    culture: 'culture',
    sport: 'sports',
  },
  // Le Courrier est indexé par `sectionKey`, pas par `categoryKey`.
  courrier: {
    actualite: mixed('armenie'),
    societe: 'societe',
    economie: 'economie',
    'arts-et-culture': 'culture',
    francophonie: mixed('diaspora'),
    opinions: 'opinion',
    region: 'monde',
    diasporas: 'diaspora',
  },
  armenews: {
    actualites: mixed('armenie'),
    sport: 'sports',
    communaute: 'diaspora',
    culture: 'culture',
    lifestyle: 'culture',
    magazine: mixed('culture'),
  },
  artzakank: {
    'armenie-artsakh': 'armenie',
    communaute: 'diaspora',
    divers: mixed('diaspora'),
  },
  armenieinfotv: {
    armenie: 'armenie',
    artsakh: 'armenie',
    'art-culture': 'culture',
    diaspora: 'diaspora',
    france: 'diaspora',
    geopolitique: 'politique',
    politique: 'politique',
    'un-autre-regard': 'opinion',
  },
  // Deux éditions (en, hy) sous une même table : leurs clés ne se recouvrent pas.
  asbarez: {
    'top-stories': mixed('armenie'),
    community: 'diaspora',
    'arts-culture': 'culture',
    'op-ed': 'opinion',
    columns: 'opinion',
    videos: mixed('diaspora'),
    sports: 'sports',
    hayastan: 'armenie',
    'klkhavor-loorer': mixed('armenie'),
    kaghoutigyanken: 'diaspora',
    'գաղութներ': 'diaspora',
    hotvadzner: mixed('opinion'),
  },
  // Soy Armenio : `armenia` est le fil fourre-tout de 14 000 articles.
  soyarmenio: {
    'noticias-de-armenia': mixed('armenie'),
    politica: 'politique',
    'diaspora-armenia': 'diaspora',
    cultura: 'culture',
    economia: 'economie',
    'noticias-internacionales': 'monde',
    deporte: 'sports',
  },
  oragark: {
    featured: mixed('armenie'),
    news: mixed('armenie'),
    armenia: 'armenie',
    community: 'diaspora',
    'arachin-hy': mixed('armenie'),
    'latest-news-hy': mixed('armenie'),
  },
  armenianweekly: {
    news: mixed('armenie'),
    diaspora: 'diaspora',
    culture: 'culture',
    opinion: 'opinion',
    columns: 'opinion',
    youth: mixed('diaspora'),
    'special-reports': mixed('armenie'),
  },
  // fr/ru/hy : la chronique de Harut Sassounian ; en : le fil d'actualité.
  californiacourier: {
    french: 'opinion',
    russian: 'opinion',
    'eastern-armenian': 'opinion',
    mainpost: mixed('armenie'),
  },
  civilnet: {
    politics: 'politique',
    economy: 'economie',
    society: 'societe',
    'human-rights': 'societe',
    region: 'monde',
    world: 'monde',
    opinion: 'opinion',
    civilnetcheck: mixed('politique'),
    'democracy-watch': mixed('politique'),
  },
  newsam: {
    politics: 'politique',
    business: 'economie',
    economics: 'economie',
    society: 'societe',
    incidents: 'societe',
    medicine: 'societe',
    culture: 'culture',
    style: 'culture',
    sport: 'sports',
    analytics: 'opinion',
  },
}

// La rubrique commune d'un article. `article.rubric` (écrit par le classeur)
// n'est lu QUE pour un fil mixed : si la table rend une rubrique d'origine
// fixe, elle l'emporte sur un `rubric` resté d'un ancien instantané — un push
// sur main rebâtit sans scraper.
export function rubricOf(sourceId, key, article, map = RUBRIC_MAP) {
  const v = map[sourceId]?.[key]
  if (typeof v === 'string') return v
  if (v && typeof v === 'object')
    return RUBRICS.includes(article?.rubric) ? article.rubric : v.mixed
  return DEFAULT_RUBRIC
}

// Le défaut d'un fil fourre-tout, ou null si la rubrique d'origine est fixe.
export function mixedDefault(sourceId, key, map = RUBRIC_MAP) {
  const v = map[sourceId]?.[key]
  return v && typeof v === 'object' ? v.mixed : null
}

// Horodatage d'un article ; un article non daté (ou mal daté) part en dernier.
const time = (a) => {
  const t = Date.parse(a.date)
  return Number.isNaN(t) ? -Infinity : t
}

// Les sources (forme de buildSources, NewsBrowser.jsx) recomposées en
// rubriques : pour chaque rubrique, une étagère par source, la rédaction à la
// dépêche la plus récente en tête — Armenpress compris, c'est voulu. L'ordre
// des sources reçu (TAB_ORDER) ne fait plus que départager deux étagères à
// égalité ou sans date. Il est figé à l'instantané : prérendu et navigateur
// lisent le même JSON, donc le même ordre. Une source fusionne toutes ses
// rubriques d'origine qui mènent à la même rubrique commune (NEWS.am business
// + economics), sans doublon d'URL. Chaque carte garde le libellé de sa
// rubrique d'origine (`catLabel`). Rubrique ou étagère vide : absente.
export function groupByRubric(sources, { cap = SHELF_CAP, map = RUBRIC_MAP } = {}) {
  const out = []
  for (const key of RUBRICS) {
    const shelves = []
    for (const source of sources) {
      const seen = new Set()
      const items = []
      for (const c of source.cats || [])
        for (const a of c.articles || []) {
          if (!a?.url || seen.has(a.url)) continue
          if (rubricOf(source.id, c.key, a, map) !== key) continue
          seen.add(a.url)
          items.push({ ...a, catLabel: c.label })
        }
      if (!items.length) continue
      // Stable : deux non datés gardent leur ordre (NaN vaut 0 pour sort).
      items.sort((x, y) => time(y) - time(x))
      shelves.push({ source, articles: items.slice(0, cap) })
    }
    // Stable : à égalité, l'ordre de TAB_ORDER tient.
    shelves.sort((x, y) => time(y.articles[0]) - time(x.articles[0]))
    if (shelves.length) out.push({ key, shelves })
  }
  return out
}

// Les couples « source|rubrique d'origine » d'un news.json que `map` ignore.
// Une source indexée par langue a un objet { lang: [étagères] }, les autres une
// liste plate ; Courrier est indexé par `sectionKey`, les autres par
// `categoryKey`. Sans doublon d'une langue à l'autre.
export function unmappedKeys(news, map = RUBRIC_MAP) {
  const out = new Set()
  for (const [source, feed] of Object.entries(news || {})) {
    if (source === 'generatedAt' || !feed) continue
    const lists = Array.isArray(feed) ? [feed] : Object.values(feed)
    for (const list of lists)
      for (const shelf of list || []) {
        const key = shelf.categoryKey ?? shelf.sectionKey
        if (map[source]?.[key] === undefined) out.add(`${source}|${key}`)
      }
  }
  return [...out]
}
