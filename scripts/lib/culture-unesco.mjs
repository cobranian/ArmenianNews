//
// La table UNESCO du patrimoine culturel immatériel arménien : curée à la main,
// jamais lue sur le réseau (le code ne contacte pas ich.unesco.org). Chaque ligne
// a été vérifiée sur sa fiche officielle.
import { readFileSync } from 'node:fs'

export const LIST_FR = {
  representative: 'Liste représentative',
  urgent: 'Liste de sauvegarde urgente',
  'good-practices': 'Registre des bonnes pratiques de sauvegarde',
}

export function loadUnesco(path = new URL('../../src/data/culture/unesco.json', import.meta.url)) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function unescoSource(entry) {
  return {
    kind: 'unesco',
    lang: 'en',
    title: entry.name,
    url: entry.url,
    revision: null,
    extract: `Inscrit en ${entry.year} sur la ${LIST_FR[entry.list]} du patrimoine culturel immatériel de l'UNESCO, sous l'intitulé « ${entry.name} ».`,
    license: 'UNESCO',
  }
}
