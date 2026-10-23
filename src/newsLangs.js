// Quelle source paraît sous quelle langue, et où lire ses étagères — et la
// forme de news.json, lisibles par Node.
//
// Module JS **plat**, comme `src/seo.js`, `src/site.js`, `src/worldPlace.js`,
// `src/hyDate.js` et `src/agendaEvents.js`, et pour la même raison : `News.jsx`
// doit compter les sources visibles sans importer `NewsBrowser.jsx`, et ajouter
// un export non-composant à un `.jsx` ferait passer le lint de 5 à 6
// avertissements `react-refresh` (voir CLAUDE.md, section Lint). Ne le
// reconsolidez pas dans `NewsBrowser.jsx`. Sans import JSON : le scraper
// (scripts/lib/brief-select.mjs) doit lire TAB_ORDER, et src/newsSources.js
// importe news.json — Node refuse un import JSON sans attribut ;
// newsSources.js ré-exporte d'ici.
//
// Il porte aussi la CONNAISSANCE DE LA FORME des données, en un seul endroit :
// certaines sources sont indexées par langue dans `news.json`, les autres sont
// une liste plate. Ce savoir était auparavant recopié source par source dans
// `buildSources` ; l'y laisser aurait obligé le compteur du bandeau à le
// recopier une fois de plus, et deux copies d'une même règle finissent toujours
// par diverger — c'est exactement ce qui était arrivé au filtre de l'agenda.

// L'ordre des onglets, par langue. Il est ÉCRIT À LA MAIN : il était auparavant
// calculé — Armenpress épinglé, puis tri alphabétique de marque — pour qu'une
// nouvelle source se place toute seule. Cette propriété est perdue à dessein.
// Le rang porte désormais une intention éditoriale que l'alphabet ne sait pas
// exprimer : sous `fr`, les quatre fils proprement francophones passent devant
// les sources traduites ou multilingues ; sous `en`/`hy`, NEWS.am monte au
// troisième rang.
//
// Cette liste décide aussi de la PRÉSENCE : une langue ne montre que les
// sources qui publient dans cette langue. Les fils 100 % francophones
// (Courrier, armenews, artzakank, armenieinfotv) ne paraissent donc que sous
// `fr` ; ArmRadio et NEWS.am — en/hy/ru, sans édition française — en sont
// retirés plutôt que d'y servir des titres anglais sous `lang="fr"` ; Armenian
// Weekly, anglophone seul, ne paraît que sous `en`.
//
// CONSÉQUENCE À CONNAÎTRE : une source ajoutée sans être nommée ici
// n'apparaîtra nulle part, et c'est silencieux. Le garde-fou est
// `test/source-count.test.mjs`, qui lit ce tableau COMME DU TEXTE (Node ne sait
// pas importer un module qui importe du JSON sans attribut d'import) pour
// vérifier le nombre de rédactions annoncé par les cartes de liens. Ne le
// renommez pas sans mettre ce test à jour.
export const TAB_ORDER = {
  fr: [
    'armenpress',
    'armenieinfotv',
    'courrier',
    'armenews',
    'artzakank',
    'californiacourier',
    'civilnet',
  ],
  en: [
    'armenpress',
    'armradio',
    'newsam',
    'asbarez',
    'armenianweekly',
    'civilnet',
    'californiacourier',
    'oragark',
  ],
  hy: [
    'armenpress',
    'armradio',
    'newsam',
    'asbarez',
    'civilnet',
    'californiacourier',
    'oragark',
  ],
  ru: ['armenpress', 'armradio', 'newsam', 'californiacourier', 'civilnet'],
}

// L'allemand et l'italien (armenieinfo.ch) n'ont AUCUNE rédaction à eux : ils
// lisent le fil français. Une copie de `TAB_ORDER.fr` divergerait au premier
// ajout de source, d'où la référence — `TAB_ORDER.de === TAB_ORDER.fr`.
// Écrit APRÈS le littéral : test/source-count.test.mjs lit ce littéral comme
// du texte.
export const CONTENT_LANG = { de: 'fr', it: 'fr' }
TAB_ORDER.de = TAB_ORDER.fr
TAB_ORDER.it = TAB_ORDER.fr

// La langue dans laquelle le CONTENU est lu pour une langue d'interface.
export function contentLang(lang) {
  return CONTENT_LANG[lang] ?? lang
}

// Les sources dont le flux est indexé par langue dans news.json. Les autres —
// celles qui ne publient que dans une seule langue — sont une liste plate.
const BY_LANG = new Set([
  'armenpress',
  'armradio',
  'asbarez',
  'oragark',
  'californiacourier',
  'civilnet',
  'newsam',
])

// ArmRadio publie en/hy/ru — jamais en français. Elle n'est de toute façon pas
// nommée dans TAB_ORDER.fr, donc ce repli sur `en` ne sert aujourd'hui aucune
// page ; il est conservé pour que lire `news.armradio` reste défini quelle que
// soit la langue demandée, y compris depuis un test.
const FEED_LANG = {
  armradio: (lang) => (lang === 'hy' ? 'hy' : lang === 'ru' ? 'ru' : 'en'),
}

// Le nom de chaque rédaction, tel qu'affiché. Une seule source de vérité :
// l'onglet (NewsBrowser.jsx) et la ligne « Sources » de la brève.
export const SOURCE_NAMES = {
  armenpress: 'Armenpress',
  armradio: 'ArmRadio',
  courrier: "Courrier d'Erevan",
  armenews: "Nouvelles d'Arménie",
  artzakank: 'Artzakank',
  armenieinfotv: 'ArménieInfo.tv',
  asbarez: 'Asbarez',
  oragark: 'Oragark',
  armenianweekly: 'Armenian Weekly',
  californiacourier: 'California Courier',
  civilnet: 'CivilNet',
  newsam: 'NEWS.am',
}

// Les étagères brutes d'une source pour une langue. Toujours un tableau.
export function feedFor(news, id, lang) {
  const read = contentLang(lang)
  const feed = BY_LANG.has(id) ? news?.[id]?.[FEED_LANG[id]?.(read) ?? read] : news?.[id]
  return Array.isArray(feed) ? feed : []
}
