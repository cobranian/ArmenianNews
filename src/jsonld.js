// Les blocs JSON-LD des pages de vue.
//
// Module PLAT et non un .jsx : un export non-composant depuis un .jsx ajoute un
// avertissement react-refresh/only-export-components, et le dépôt en tient
// exactement cinq, tous documentés. Même raison que src/seo.js.
//
// Sur /radio, le balisage RadioStation aide Google à comprendre l'entité mais
// N'AFFICHE RIEN de particulier dans les résultats. Ne pas en attendre de
// résultat enrichi : le seul de ce projet qui en produise est Event, sur
// /agenda.
import { STATION_FACTS } from './stations.js'
import { urlFor } from '../sites.config.js'

// Échappe "<" pour qu'aucune chaîne ne puisse fermer le <script>. Même garde
// que scripts/lib/site-meta.mjs.
const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c')

// Le SEUL balisage de ce projet qui produise un résultat enrichi visible dans
// Google (les fiches d'événements avec date et lieu). D'où deux règles strictes :
//
//   1. SEULS LES ÉVÉNEMENTS À VENIR. Baliser un événement passé comme à venir
//      enfreint les règles de Google et expose la page à une action manuelle.
//   2. LE LIEU SE LIMITE À LA DONNÉE. agenda.json ne porte qu'un `location`
//      textuel (« Genève », « Uruguay ») — jamais d'adresse. On émet donc un
//      Place nommé, sans `address`. Search Console le signalera en avertissement
//      NON BLOQUANT : c'est le comportement correct.
//
// `maintenant` est un troisième paramètre injectable (défaut : Date.now())
// pour que ce filtre soit testable sans horloge ni réseau — ne le retirez pas.
export function agendaJsonLd(lang, evenements, maintenant = Date.now()) {
  const avenir = evenements.filter((ev) => new Date(ev.date).getTime() >= maintenant)
  return safe({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: avenir.length,
    itemListElement: avenir.map((ev, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: ev.title,
        startDate: ev.date,
        url: ev.url,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: ev.location },
        ...(ev.image ? { image: ev.image } : {}),
      },
    })),
  })
}

export function radioJsonLd(lang, t) {
  const ids = Object.keys(STATION_FACTS)
  return safe({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t('radio.page.h1'),
    url: urlFor(lang, 'radio'),
    numberOfItems: ids.length,
    itemListElement: ids.map((id, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'RadioStation',
        name: t(`radio.st.${id}`),
        // Les champs absents de la fiche sont absents du balisage : baliser un
        // fait qu'on n'affiche pas serait affirmer sans source par une autre
        // porte.
        ...(STATION_FACTS[id].city ? { areaServed: STATION_FACTS[id].city } : {}),
        ...(STATION_FACTS[id].langue ? { inLanguage: STATION_FACTS[id].langue } : {}),
      },
    })),
  })
}
