// La pause de la rédaction Culture : tant qu'elle court, le brouillon de la
// nuit (articles.yml → culture-draft.mjs) n'ouvre aucun article, mais les
// idées de sujets continuent d'être proposées et /ajoute de les enregistrer.
// Le tableau de bord l'affiche (publication-check.mjs).
//
// Pourquoi (5 nov. 2026) : chaque article demande un Short dans 7 langues, et
// YouTube n'accepte qu'une dizaine d'envois par 24 h pour tout le compte
// Google. À un article par jour, la file (~100 vidéos) ne baissait que de 3
// par jour. Dix jours sans article la vident.
//
// `until` est le DERNIER jour de pause (UTC, inclus) : le brouillon reprend la
// nuit suivante. `null` = pas de pause. La pause se lève d'elle-même.
export const CULTURE_PAUSE = {
  until: '2026-11-15',
  why: 'rattraper les Shorts YouTube en retard (~10 envois par jour)',
}

export function culturePaused(now = new Date(), pause = CULTURE_PAUSE) {
  return Boolean(pause?.until) && now.toISOString().slice(0, 10) <= pause.until
}

// Le jour de reprise (lendemain de `until`), au format AAAA-MM-JJ.
export function resumeDay(pause = CULTURE_PAUSE) {
  const d = new Date(`${pause.until}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// La ligne du tableau de bord : `info` (affichée, jamais notifiée comme une
// alerte), et rien du tout une fois la pause levée.
export function checkPause(now = new Date(), pause = CULTURE_PAUSE) {
  if (!culturePaused(now, pause)) return []
  return [
    {
      key: 'culture-pause',
      level: 'info',
      text: `⏸️ Rédaction des articles EN PAUSE jusqu'au ${pause.until} inclus — reprise du brouillon le ${resumeDay(pause)} à 03:00 UTC. Raison : ${pause.why}. Les idées de sujets continuent (/ajoute, /rejette).`,
    },
  ]
}
