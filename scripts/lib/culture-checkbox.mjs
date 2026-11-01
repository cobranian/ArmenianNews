// scripts/lib/culture-checkbox.mjs
//
// La case « Faits vérifiés » du corps de PR, et les marqueurs de la section
// que le robot y réécrit. Module SANS AUCUN import, à dessein :
// articles-publish.yml le lit sur la branche de BASE (git show), et non sur la
// branche relue, avant de publier — une branche culture/* ouverte avant une
// correction de ce fichier en garderait l'ancienne version. Une dépendance de
// plus le rendrait inutilisable seul, et la publication échouerait.
export const AUTO_START = '<!-- culture:auto:start -->'
export const AUTO_END = '<!-- culture:auto:end -->'

// La case cochée. Seule définition : /corrige la décoche avec la même
// (culture-pr.mjs), pour que décocher et contrôler ne divergent jamais.
// Groupes : 1 = retrait et puce, 2 = libellé.
export const FACTS_CHECKED = /^(\s*[-*] )\[[xX]\]( Faits vérifiés)/m

// La partie du corps que tient le RELECTEUR : tout sauf la section du robot.
// Celle-ci recopie des textes de tiers (titre de l'événement lié, titres des
// sources, texte du modèle) : un événement intitulé « x] Faits vérifiés … »
// y devenait la ligne « - [x] Faits vérifiés … » et passait pour la case
// cochée. Du premier marqueur d'ouverture au DERNIER de fermeture : un
// marqueur recopié dans un titre ne rouvre rien. Sans fermeture, tout ce qui
// suit l'ouverture est tenu pour le robot.
export function reviewerPart(prBody) {
  const s = String(prBody ?? '')
  const i = s.indexOf(AUTO_START)
  if (i === -1) return s
  const j = s.lastIndexOf(AUTO_END)
  return s.slice(0, i) + (j > i ? s.slice(j + AUTO_END.length) : '')
}

export function factsChecked(prBody) {
  return FACTS_CHECKED.test(reviewerPart(prBody))
}
