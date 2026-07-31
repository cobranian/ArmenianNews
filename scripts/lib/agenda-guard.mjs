// La garde qui contrôle où vivent les Event schema.org sur le HTML PRODUIT.
// Isolée de scripts/check-build.mjs pour être testable sur des fixtures, sans
// dist/ ni horloge — voir test/agenda-guard.test.mjs.
//
// Trois vues, trois attentes (Task 11) :
//
//   Vue      | graphe du PLUGIN (data-ld="agenda") | Event en général
//   ---------|--------------------------------------|-------------------
//   home     | présent SI l'agenda a un événement    | idem
//   agenda   | ABSENT (le composant pose le sien)    | présent SI un événement à venir
//   radio    | absent                                 | aucun
//
// Le graphe du plugin et la présence d'Event ne sont PAS la même question :
// /agenda/ affiche légitimement des Event (posés par le composant), donc un
// simple `includes('"@type":"Event"')` ne peut pas, à lui seul, détecter un
// graphe du PLUGIN recopié à tort sur cette vue — d'où le contrôle séparé sur
// l'ATTRIBUT (AGENDA_LD_ATTR/AGENDA_LD_VALUE).
import { AGENDA_LD_ATTR, AGENDA_LD_VALUE } from './agenda-ld.mjs'

const hasPluginGraph = (html) => html.includes(`${AGENDA_LD_ATTR}="${AGENDA_LD_VALUE}"`)
const hasEvent = (html) => html.includes('"@type":"Event"')

/**
 * @param {'home'|'agenda'|'radio'|string} view
 * @param {string} html — le HTML tel que produit dans dist/
 * @param {{agendaAttendu: boolean, agendaAVenir: boolean}} etat
 *   agendaAttendu — au moins un événement valide (title/date/url) dans
 *                   agenda.json, toutes dates confondues : ce que le plugin
 *                   (accueil) exige avant d'injecter son @graph.
 *   agendaAVenir  — au moins un de ces événements est À VENIR : ce que la
 *                   vue /agenda/ (composant, filtré) exige pour afficher un
 *                   Event.
 * @returns {[string, boolean][]} des paires [nom du contrôle, ok]
 */
export function agendaGuardChecks(view, html, { agendaAttendu, agendaAVenir }) {
  return [
    [
      view === 'home' ? 'le graphe du plugin (data-ld="agenda") est là' : 'le graphe du plugin est absent',
      view === 'home' ? !agendaAttendu || hasPluginGraph(html) : !hasPluginGraph(html),
    ],
    [
      view === 'radio' ? 'aucun Event sur /radio' : 'des Event sont présents si l’agenda en a',
      view === 'radio'
        ? !hasEvent(html)
        : view === 'agenda'
          ? !agendaAVenir || hasEvent(html)
          : !agendaAttendu || hasEvent(html),
    ],
  ]
}
