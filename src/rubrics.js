// Les rubriques communes du navigateur d'actualités.
//
// Module JS PLAT, comme src/seo.js et src/newsSources.js : le scraper (Node),
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
