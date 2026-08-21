// Les deux filtres canoniques de l'agenda — écrits UNE fois, lus des deux
// mondes.
//
// Module PLAT (pas de JSX) et sans rien de Node : il doit être lisible par le
// bundle (`AgendaPage`, `jsonld.js`) ET par Node (le plugin
// `agendaEventsJsonLd` de vite.config.js, scripts/check-build.mjs, les tests).
// Même raison que src/seo.js, src/site.js, src/worldPlace.js et src/hyDate.js.
//
// POURQUOI un filtre commun. Le plugin (accueil) écartait déjà les événements
// incomplets (`e.title && e.date && e.url`) ; la vue /agenda/, elle, ne
// filtrait que le temps. Deux filtres écrits séparément dérivent — or c'est la
// MÊME liste qui est rendue et balisée, et la vue /agenda/ est la seule page du
// projet qui produise un résultat enrichi dans Google.
//
// Et le cas n'est pas théorique : le scraper laisse DÉLIBÉRÉMENT passer des
// événements sans date (`upcoming`, scripts/sources/armenopole.mjs :
// `!e.date || …`), et `isoFromMonthDay` rend `null` dès qu'un libellé de mois
// change chez la source.
//
// LE PIÈGE, qui est ce qui rend le filtre explicite nécessaire :
// `new Date(null).getTime()` vaut **0** — `null` se convertit en nombre —
// tandis que `new Date(undefined)`, comme `''` ou un texte quelconque, vaut
// **NaN**, et toute comparaison portant sur NaN est fausse. Un filtre purement
// temporel écarte donc la première forme par ACCIDENT (`0 < maintenant`) et
// laisse passer la seconde (`NaN < maintenant` est faux). L'événement se rend
// alors avec un `<time>` vide et compte dans le total affiché, mais reste
// absent du balisage (qui teste `NaN >= maintenant`, faux lui aussi) : la page
// et son JSON-LD cessent de dire la même chose, sans qu'aucune erreur ne soit
// levée. Un test d'existence explicite ne dépend d'aucune de ces conversions.
export const evenementComplet = (e) => Boolean(e && e.title && e.date && e.url)

// La liste EXACTE que /agenda/ rend ET balise : complète, dédoublonnée par URL
// (le même événement est recensé sur plusieurs pages pays chez armenopole),
// puis restreinte à ce qui est à venir — une liste d'événements révolus est une
// page sans valeur, et son balisage serait fautif.
//
// `maintenant` est injectable pour que ce filtre soit testable sans horloge —
// même signature et même raison que `agendaJsonLd` (src/jsonld.js).
export function evenementsAVenir(evenements, maintenant = Date.now()) {
  const vus = new Set()
  return evenements.filter((ev) => {
    if (!evenementComplet(ev)) return false
    if (vus.has(ev.url) || new Date(ev.date).getTime() < maintenant) return false
    vus.add(ev.url)
    return true
  })
}

// La valeur `startDate` du balisage schema.org, dérivée de la date stockée.
//
// `ev.date` est une HEURE MURALE sans fuseau (« 2026-08-30T12:30 », voir
// `isoFromMonthDay` dans scripts/lib/util.mjs) : on l'émet telle quelle —
// schema.org accepte une heure sans offset, et c'est plus juste qu'un offset
// deviné. Un cas est lu autrement : 23:59, qui chez Armenopole signifie « pas
// d'heure » (27 événements sur 155 le 21 août 2026). Annoncer 23:59 serait
// faux ; le jour seul est exact.
//
// Une valeur qui porte encore un `Z` (un vieux snapshot repris par le
// backfill) passe intacte : on ne sait pas en retrouver l'heure murale, et la
// tronquer en un jour pourrait désigner la mauvaise date.
export function startDateLd(date) {
  return /^\d{4}-\d{2}-\d{2}T23:59$/.test(date) ? date.slice(0, 10) : date
}

// LE nœud `Event` — composé ici, une fois, pour le plugin `agendaEventsJsonLd`
// (vite.config.js, accueil) ET pour `agendaJsonLd` (src/jsonld.js, vue
// /agenda/). Écrit deux fois, il avait divergé : l'accueil adressait son lieu
// et la vue non, la vue déclarait le mode de présence et l'accueil non — et le
// Rich Results Test ne jugeait pas les mêmes événements de la même façon selon
// la page.
//
// Le lieu se limite à la donnée : agenda.json ne porte qu'un `location` textuel
// (« Genève », « Uruguay »). On l'émet comme `name` ET comme `address` (texte),
// parce que Google demande une adresse sur le Place d'un Event — sans elle la
// fiche est rétrogradée en avertissement. Un texte vaut mieux qu'une
// PostalAddress inventée. Aucun `organizer` : les événements sont ceux
// d'Armenopole, pas les nôtres.
export function eventLd(ev) {
  const node = {
    '@type': 'Event',
    name: ev.title,
    startDate: startDateLd(ev.date),
    url: ev.url,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  }
  if (ev.location) node.location = { '@type': 'Place', name: ev.location, address: ev.location }
  if (ev.image) node.image = ev.image
  return node
}
