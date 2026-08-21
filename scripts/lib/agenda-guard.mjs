// La garde qui contrôle où vivent les Event schema.org sur le HTML PRODUIT.
// Isolée de scripts/check-build.mjs pour être testable sur des fixtures, sans
// dist/ ni horloge — voir test/agenda-guard.test.mjs.
//
// Trois vues, trois attentes (Task 11) :
//
//   Vue      | graphe du PLUGIN (data-ld="agenda") | Event en général
//   ---------|--------------------------------------|-------------------
//   home     | présent SI l'agenda a un événement    | idem
//   agenda   | ABSENT (le composant pose le sien)    | présent SI un événement à venir,
//            |                                        | ET SEULEMENT une fois la page prérendue
//   radio    | absent                                 | aucun
//
// Le graphe du plugin et la présence d'Event ne sont PAS la même question :
// /agenda/ affiche légitimement des Event (posés par le composant), donc un
// simple `includes('"@type":"Event"')` ne peut pas, à lui seul, détecter un
// graphe du PLUGIN recopié à tort sur cette vue — d'où le contrôle séparé sur
// l'ATTRIBUT (AGENDA_LD_ATTR/AGENDA_LD_VALUE).
//
// LE PIÈGE DU STADE — invisible en local, il a bloqué un déploiement.
// L'accueil tient ses Event du PLUGIN, donc du <head>, donc de `npm run build`.
// La vue /agenda/ tient les siens du COMPOSANT React, donc de `<div id="root">`,
// donc de `npm run prerender`. Or l'ordre des étapes n'est pas le même des deux
// côtés : la CI fait build → check → prerender, le poste local build →
// prerender → check. Exiger des Event sur /agenda/ sans regarder le stade fait
// donc échouer `npm run check` en CI sur quatre pages parfaitement saines, et
// passer en local sur les mêmes — un défaut qu'aucune vérification locale ne
// peut voir. L'exigence est donc différée tant que la racine React est vide.
//
// L'autre moitié de la garde — « le graphe du plugin est absent » — reste
// INCONDITIONNELLE : c'est elle qui porte la protection d'origine (159 Event
// recopiés sur /radio/, une page qui n'en affiche aucun), et ce défaut-là naît
// au build, pas au prérendu.
import { AGENDA_LD_ATTR, AGENDA_LD_VALUE } from './agenda-ld.mjs'

const hasPluginGraph = (html) => html.includes(`${AGENDA_LD_ATTR}="${AGENDA_LD_VALUE}"`)
const hasEvent = (html) => html.includes('"@type":"Event"')

// La signature EXACTE de la sortie de `npm run build` : la racine React vide,
// que le prérendu remplace par le même conteneur rempli.
//
// Le sens du test compte plus que sa forme. Il reconnaît « pas encore
// prérendue », pas « prérendue » : tout HTML qui ne porte pas cette signature
// est traité comme cuit, donc SOUMIS à l'exigence d'Event. Écrite dans l'autre
// sens — reconnaître la racine remplie — un simple changement de forme du
// conteneur (un attribut ajouté au marqueur d'index.html) rendrait l'exigence
// inatteignable : la garde cesserait de protéger sans qu'aucun contrôle ne
// tombe. Ici le même changement la resserre. Une garde doit rater du côté où
// elle crie.
const RACINE_VIDE = /<div id="root"[^>]*>\s*<\/div>/
const avantPrerendu = (html) => RACINE_VIDE.test(html)

/**
 * @param {'home'|'agenda'|'radio'|string} view
 * @param {string} html — le HTML tel que produit dans dist/
 * @param {{agendaAttendu: boolean, agendaAVenir: boolean}} etat
 *   agendaAttendu — au moins un événement valide (title/date/url) dans
 *                   agenda.json, toutes dates confondues : ce que le plugin
 *                   (accueil) exige avant d'injecter son @graph.
 *   agendaAVenir  — au moins un de ces événements est À VENIR : ce que la
 *                   vue /agenda/ (composant, filtré) exige pour afficher un
 *                   Event — une fois la page prérendue, voir ci-dessus.
 * @returns {[string, boolean][]} des paires [nom du contrôle, ok]
 */
export function agendaGuardChecks(view, html, { agendaAttendu, agendaAVenir }) {
  // Chaque vue est nommée, aucune ne tombe dans un `else`. Une cinquième vue
  // ajoutée à VIEWS (sites.config.js) héritait autrement de la branche de
  // l'ACCUEIL : elle aurait réclamé un graphe d'agenda sur une page qui n'en
  // veut pas. L'échec aurait été bruyant — donc pas dangereux — mais son
  // message aurait désigné le balisage au lieu de la vue oubliée. Ici il dit la
  // cause, et il oblige à trancher les deux états plutôt qu'à en hériter un.
  // Les vues SANS agenda : ni graphe du plugin, ni Event d'aucune sorte. Une
  // vue nouvelle doit être classée ici explicitement — le repli est l'échec.
  const SANS_AGENDA = ['radio', 'about']
  if (!['home', 'agenda', ...SANS_AGENDA].includes(view)) {
    return [[`vue « ${view} » : son état d'agenda n'est pas décidé ici`, false]]
  }

  const graphePlugin =
    view === 'home'
      ? ['le graphe du plugin (data-ld="agenda") est là', !agendaAttendu || hasPluginGraph(html)]
      : ['le graphe du plugin est absent', !hasPluginGraph(html)]

  const events =
    SANS_AGENDA.includes(view)
      ? [`aucun Event sur /${view}`, !hasEvent(html)]
      : [
          'des Event sont présents si l’agenda en a',
          view === 'agenda'
            ? // Posés par le composant, donc absents tant que la page n'est pas
              // prérendue — le piège de l'ordre des étapes, en tête de fichier.
              !agendaAVenir || avantPrerendu(html) || hasEvent(html)
            : // home : posés par le plugin, dans le <head>, dès le build.
              !agendaAttendu || hasEvent(html),
        ]

  return [graphePlugin, events]
}
