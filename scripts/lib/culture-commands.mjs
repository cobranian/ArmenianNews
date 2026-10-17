// scripts/lib/culture-commands.mjs
// Les commandes de PR du propriétaire (« /corrige <consigne> ») : lecture de la
// commande et réponse du robot. Le workflow filtre déjà sur l'auteur et le
// préfixe ; le script relit ici la commande pour ne jamais appeler le modèle
// sur un commentaire qui n'en est pas une.

// En tête de commentaire seulement (espaces de tête tolérés), suivi d'un blanc
// ou de la fin : « /corrigez » n'est pas la commande, et un « /corrige » cité
// au milieu d'une phrase non plus.
const REVISE = /^\s*\/corrige(?=\s|$)([\s\S]*)$/

export function parseReviseCommand(text) {
  const m = String(text ?? '').replace(/\r\n/g, '\n').match(REVISE)
  if (!m) return null
  const instruction = m[1].trim()
  return instruction || null
}

const paragraphs = (body) =>
  String(body ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

// Un paragraphe réécrit compte une fois (il apparaît d'un côté ET disparaît de
// l'autre) : d'où le maximum des deux, et non leur somme.
export function changedParagraphs(before, after) {
  const a = paragraphs(before)
  const b = paragraphs(after)
  const added = b.filter((p) => !a.includes(p)).length
  const removed = a.filter((p) => !b.includes(p)).length
  return Math.max(added, removed)
}

// Les ⚠️ que l'ancienne section automatique ne portait pas encore.
const ALERT = /^- ⚠️ (.+) — introuvable tel quel dans les sources$/gm
export function newAlerts(prBody, facts) {
  const known = new Set([...String(prBody ?? '').matchAll(ALERT)].map((m) => m[1]))
  return facts.filter((f) => !known.has(f))
}

// La réponse postée sous le commentaire. Une erreur n'y porte que son message
// (statut HTTP, modèle) : le client LLM n'écrit jamais la clé dans une erreur.
export function reviseReply({ error, model, fellBack = false, changed = 0, alerts = [], unchecked = false }) {
  if (error) {
    return [
      `❌ Révision non appliquée : ${error}`,
      '',
      '`fr.md` est inchangé. Renvoyez la consigne `/corrige` pour réessayer.',
      '',
    ].join('\n')
  }
  const lines = [
    `✅ Révision appliquée par \`${model}\`${fellBack ? ' (modèle de secours : Gemini indisponible)' : ''}.`,
    '',
    `- ${changed} ${changed > 1 ? 'paragraphes changés' : 'paragraphe changé'}.`,
  ]
  if (alerts.length) lines.push('- Nouveaux points à vérifier :', ...alerts.map((a) => `  - ⚠️ ${a}`))
  if (unchecked) lines.push('- **Case décochée : recochez pour publier** (le texte a changé depuis votre vérification).')
  lines.push('', 'La section automatique de la PR a été mise à jour.', '')
  return lines.join('\n')
}
