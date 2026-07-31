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
