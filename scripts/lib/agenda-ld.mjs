// Le balisage Event de l'agenda : comment on le MARQUE, et comment on le
// RETIRE.
//
// Le plugin `agendaEventsJsonLd` de vite.config.js injecte dans le <head> du
// HTML bâti un @graph de tous les événements de l'agenda. Il est injecté HORS
// des sentinelles <!--SITE_META:START/END--> — donc scripts/build-sites.mjs, qui
// dérive les autres pages en n'échangeant que le bloc entre sentinelles, le
// recopie tel quel dans TOUTES les pages.
//
// Tant que les quatre pages dérivées étaient des accueils, c'était juste : la
// section Agenda y était visible. Depuis les pages de vue, ça ne l'est plus.
// Google demande que les données structurées décrivent le contenu VISIBLE ;
// 159 Event datés et localisés sur une page qui n'en montre aucun expose à une
// action manuelle « données structurées non pertinentes », qui porte sur le
// DOMAINE ENTIER — donc sur les accueils aussi.
//
// D'où cet attribut : le plugin le pose, `stripAgendaLd` le retire là où
// l'agenda n'est pas rendu. Les deux côtés lisent la même constante, sinon
// renommer l'attribut d'un côté remettrait le graphe partout, en silence.
export const AGENDA_LD_ATTR = 'data-ld'
export const AGENDA_LD_VALUE = 'agenda'

// Retire le bloc marqué, et lui seul. Les autres <script type="ld+json">
// (WebSite, Organization, et l'ItemList de /radio) n'ont pas cet attribut et
// doivent survivre.
//
// L'attribut est cherché DANS la balise ouvrante, sans présumer de l'ordre des
// attributs : c'est Vite qui sérialise la balise, pas nous.
export function stripAgendaLd(html) {
  const re = new RegExp(
    `[ \\t]*<script\\b[^>]*\\b${AGENDA_LD_ATTR}="${AGENDA_LD_VALUE}"[^>]*>[\\s\\S]*?</script>\\n?`,
    'g',
  )
  return html.replace(re, '')
}
