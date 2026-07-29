// Formatage des dates en arménien, écrit en dur.
//
// POURQUOI CE FICHIER EXISTE. `Intl.DateTimeFormat('hy-AM')` ne rend pas de
// l'arménien dans Chrome : son ICU n'embarque pas les données de date
// arméniennes, donc la locale ne « résout » pas et le navigateur retombe sur
// sa propre langue. Mesuré le 29 juillet 2026 :
//
//   new Intl.DateTimeFormat('hy-AM', …).resolvedOptions().locale  →  'fr'
//   new Date('2026-07-29').toLocaleDateString('hy-AM', …)         →  '29 juillet 2026'
//
// La retombée est la langue DU LECTEUR, pas l'anglais : un lecteur allemand
// voyait la date en allemand sur la page arménienne, un lecteur russe en russe.
// `LOCALES` dans i18n.jsx était correct — le défaut est côté navigateur.
//
// LE PIÈGE, et c'est lui qui rend le bug coûteux : **Node embarque l'ICU
// complet**. `node -e "…toLocaleDateString('hy-AM')"` rend bien
// « 29 հուլիսի, 2026 թ. ». Donc aucun test côté Node ne peut voir la panne, et
// `npm run prerender` cuit dans le HTML ce que le Chrome de la CI aura produit
// — soit la langue de la CI, figée dans la page arménienne.
//
// D'OÙ LE CHOIX D'ÉCRIRE EN DUR PLUTÔT QUE DE DÉTECTER LA PANNE. Une bascule
// conditionnelle (« si Intl est cassé, alors… ») rendrait le HTML dépendant de
// la machine qui le produit : le prérendu et le navigateur du lecteur
// pourraient diverger, et c'est exactement la classe de bug qu'on répare. Ces
// tables sont donc la seule source, toujours, partout.
//
// Les chaînes ne sont pas de mémoire : elles sont extraites du CLDR via l'ICU
// complet de Node, pour que l'arménien rendu ici soit identique à ce qu'un
// navigateur correctement doté afficherait. Pour les revérifier :
//
//   node -e "console.log(new Intl.DateTimeFormat('hy-AM',{day:'numeric',month:'long',year:'numeric'}).format(new Date('2026-07-15')))"
//   → 15 հուլիսի, 2026 թ.
//
// Module plat, sans React, comme src/seo.js, src/site.js et src/worldPlace.js :
// y ajouter ces exports dans i18n.jsx ferait monter le lint d'un avertissement
// `react-refresh` de plus (voir la section Lint de CLAUDE.md).

// Les mois portent leur forme GÉNITIVE (« հունվարի », pas « հունվար ») : en
// arménien la date se dit « le 29 de juillet », le mois se décline. Le
// nominatif donnerait une date agrammaticale.
export const HY_MONTHS_GENITIVE = [
  'հունվարի',
  'փետրվարի',
  'մարտի',
  'ապրիլի',
  'մայիսի',
  'հունիսի',
  'հուլիսի',
  'օգոստոսի',
  'սեպտեմբերի',
  'հոկտեմբերի',
  'նոյեմբերի',
  'դեկտեմբերի',
]

// Abréviations CLDR, sans point final — l'usage arménien n'en met pas, là où le
// français écrit « juil. ». Le `.replace('.', '')` de l'agenda est donc inutile
// ici, et le formateur partagé s'en charge pour les langues qui en ont besoin.
export const HY_MONTHS_ABBR = [
  'հնվ',
  'փտվ',
  'մրտ',
  'ապր',
  'մյս',
  'հնս',
  'հլս',
  'օգս',
  'սեպ',
  'հոկ',
  'նոյ',
  'դեկ',
]

// Indexé sur Date.getDay() : dimanche = 0. Vérifié sur le 1ᵉʳ février 2026,
// qui est un dimanche.
export const HY_WEEKDAYS_ABBR = ['կիր', 'երկ', 'երք', 'չրք', 'հնգ', 'ուր', 'շբթ']

const pad = (n) => String(n).padStart(2, '0')

// « 15 հուլիսի, 2026 թ. » — le motif long du CLDR arménien : jour, mois au
// génitif, virgule, année, puis « թ. » (abréviation de թվական, « année »).
// La virgule et le « թ. » font partie du motif, ce ne sont pas des ornements.
export function hyLongDate(d) {
  return `${d.getDate()} ${HY_MONTHS_GENITIVE[d.getMonth()]}, ${d.getFullYear()} թ.`
}

export function hyMonthAbbr(d) {
  return HY_MONTHS_ABBR[d.getMonth()]
}

// « չրք, 16:30 » — l'arménien est en 24 heures, deux chiffres, deux-points,
// comme le français. L'heure est lue en heure locale, comme le faisait
// toLocaleDateString.
export function hyWeekdayTime(d) {
  return `${HY_WEEKDAYS_ABBR[d.getDay()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
