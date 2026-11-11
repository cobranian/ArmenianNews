// Les liens de la barre de navigation, dans leur ORDRE — une seule liste pour
// les deux barres du site : celle de React (Nav.jsx : accueil et vues) et
// celle des pages statiques (scripts/lib/static-shell.mjs : brève, Culture,
// agenda par pays). Deux listes avaient divergé : les pages statiques
// n'offraient ni Actualités, ni Jeux, ni Réseaux (12 nov. 2026).
//
// Module JS PLAT, sans React, parce que Node le lit au build — même raison que
// src/seo.js et src/site.js (voir CLAUDE.md, section Lint). Les libellés
// viennent de BRIEF_STRINGS, gardés égaux aux nav.* d'i18n.jsx par
// test/brief-strings.test.mjs.
import { pathFor, briefPath, culturePath } from '../sites.config.js'
import { BRIEF_STRINGS } from './briefStrings.js'
import { CULTURE_STRINGS } from './cultureStrings.js'

// `home` : chemin de l'accueil de la langue ('' sur l'accueil lui-même, où
// les ancres suffisent). `onHome` : sur l'accueil, « En direct » et « Agenda »
// font défiler vers leur section ; ailleurs ils mènent à la PAGE pilier
// (/radio/, /agenda/) — c'est là qu'est la matière, et ce qui relie
// radio ⇄ agenda (audit du 21 août 2026).
export function navLinks(lang, { home = '', onHome = false } = {}) {
  const s = BRIEF_STRINGS[lang]
  return [
    [onHome ? '#direct' : pathFor(lang, 'radio'), s.radio],
    [briefPath(lang), s.nav],
    [`${home}#actualites`, s.news],
    [onHome ? '#agenda' : pathFor(lang, 'agenda'), s.agenda],
    [culturePath(lang), CULTURE_STRINGS[lang].nav],
    [`${home}#reseaux`, s.social],
    [pathFor(lang, 'games'), s.games],
  ]
}
