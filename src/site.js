// À quelle vitrine appartient la page courante, et dans quel ordre son
// sélecteur de langue s'affiche.
//
// Module plat et SANS composant, délibérément : la règle
// react-refresh/only-export-components signale chaque export non-composant
// d'un fichier qui exporte aussi un composant. Mettre ces deux-là dans
// i18n.jsx ferait passer le lint de 6 à 7 avertissements. Même raison que
// src/worldPlace.js — voir la section lint de CLAUDE.md.
//
// N'importe QUE sites.config.js : orderedLangs reçoit LANGS en paramètre
// plutôt que de l'importer, ce qui évite le cycle i18n → site → i18n.
import { primaryLang } from '../sites.config.js'

// Posé au build par scripts/build-sites.mjs (VITE_SITE_ID). `npm run dev`
// n'en pose pas et travaille donc sur le .ch, la vitrine française.
export const SITE_ID = import.meta.env?.VITE_SITE_ID ?? 'ch'

// La langue du domaine en tête, le reste dans l'ordre reçu. Dérivé et non
// écrit à la main : sinon ajouter une cinquième langue obligerait à corriger
// deux listes, qui finiraient par diverger.
//
// L'ordre suit le DOMAINE, pas la langue affichée : sur les trois pages du
// .org la barre reste « EN FR ՀԱՅ РУ », seule la mise en évidence se déplace.
export function orderedLangs(langs) {
  const first = primaryLang(SITE_ID)
  return [...langs].sort((a, b) => (a.code === first ? -1 : b.code === first ? 1 : 0))
}
