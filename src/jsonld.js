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
import { evenementComplet, eventLd } from './agendaEvents.js'
import { urlFor } from '../sites.config.js'

// Échappe "<" pour qu'aucune chaîne ne puisse fermer le <script>. Même garde
// que scripts/lib/site-meta.mjs.
const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c')

// Le SEUL balisage de ce projet qui produise un résultat enrichi visible dans
// Google (les fiches d'événements avec date et lieu). D'où deux règles strictes :
//
//   1. SEULS LES ÉVÉNEMENTS À VENIR. Baliser un événement passé comme à venir
//      enfreint les règles de Google et expose la page à une action manuelle.
//   2. LE NŒUD Event EST COMPOSÉ AILLEURS — `eventLd` (src/agendaEvents.js),
//      partagé avec le plugin de l'accueil. Le lieu, la date murale, le 23:59
//      lu comme « toute la journée » : tout y est décidé une fois. Ne recomposez
//      pas un Event ici, c'est ce qui avait fait diverger les deux pages.
//   3. AUCUN Event SANS SES TROIS CHAMPS. `startDate` est requis par Google ;
//      un événement sans date en serait dépourvu. La comparaison temporelle
//      ci-dessous les écarte déjà — mais par accident de conversion, et dans un
//      seul sens (`new Date(null)` vaut 0, `new Date(undefined)` vaut NaN).
//      S'en remettre à elle est ce qui a fait diverger la page et son balisage :
//      voir le piège documenté dans src/agendaEvents.js.
//
// `maintenant` est un troisième paramètre injectable (défaut : Date.now())
// pour que ce filtre soit testable sans horloge ni réseau — ne le retirez pas.
export function agendaJsonLd(lang, evenements, maintenant = Date.now()) {
  const avenir = evenements.filter(
    (ev) => evenementComplet(ev) && new Date(ev.date).getTime() >= maintenant,
  )
  return safe({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    // L'ItemList désigne LA page qui la porte, donc l'URL de la vue agenda dans
    // CETTE langue — les quatre pages listent les mêmes événements et seule
    // cette URL les distingue. Même rôle que `url` dans radioJsonLd.
    url: urlFor(lang, 'agenda'),
    numberOfItems: avenir.length,
    itemListElement: avenir.map((ev, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: eventLd(ev),
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
