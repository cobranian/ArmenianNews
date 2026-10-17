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

// Le if: du workflow compare sans casse et laisse passer « /corrige » seul :
// sans cette réponse, le propriétaire ne verrait qu'un 👀 suivi de rien.
export const UNRECOGNIZED_REPLY = 'Consigne vide ou commande non reconnue : écrivez `/corrige <consigne>`.\n'

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

// --- L'issue « Culture : idées de sujets » : `/ajoute 1 4 7`, `/rejette 2 3` ---
// Le workflow filtre sur l'auteur, le titre et le préfixe (sans casse) ; le
// script relit ici la commande, sensible à la casse : « /AJOUTE » reçoit l'aide.
const IDEA = /^\s*\/(ajoute|rejette)(?=\s|$)([\s\S]*)$/
const ACTIONS = { ajoute: 'add', rejette: 'reject' }

export function parseIdeaCommand(text) {
  const m = String(text ?? '').match(IDEA)
  if (!m) return null
  const tokens = m[2].split(/[\s,]+/).filter(Boolean)
  // Un seul mot qui n'est pas un numéro et la commande n'est pas reconnue :
  // mieux vaut l'aide qu'un ajout partiel deviné.
  if (!tokens.length || !tokens.every((t) => /^[1-9]\d*$/.test(t))) return null
  return { action: ACTIONS[m[1]], numbers: [...new Set(tokens.map(Number))] }
}

export const IDEAS_HELP_REPLY =
  'Commande non reconnue : écrivez `/ajoute 1 4 7` pour retenir des idées, `/rejette 2 3` pour les écarter (numéros de la liste, séparés par des espaces ou des virgules).\n'

const IDEAS_JSON = /```json\r?\n([\s\S]*?)\r?\n```/

export function readIdeas(issueBody) {
  const m = String(issueBody ?? '').match(IDEAS_JSON)
  if (!m) throw new Error('issue d’idées : bloc ```json``` introuvable')
  const ideas = JSON.parse(m[1])
  if (!Array.isArray(ideas)) throw new Error('issue d’idées : le bloc JSON doit être un tableau')
  return ideas
}

// Les slugs des idées viennent du titre (« le-tar », « l-alphabet-… ») ;
// sujets.json n'en porte pas l'article. Le tiret est exigé : « lesgui » reste
// entier, et « la » seul aussi (il ne resterait rien).
const ARTICLE = /^(?:le|la|les|l|the)-(?=.)/
const topicSlug = (slug) => String(slug ?? '').replace(ARTICLE, '')

const LABEL = { added: 'ajoutée', rejected: 'rejetée', duplicate: 'déjà dans sujets.json' }

// Statuts d'une idée : proposed → added | rejected | duplicate (slug ou qid
// déjà dans sujets.json : traitée et barrée, jamais ajoutée en double — sans
// quoi elle resterait « proposed » et l'issue ne se fermerait jamais).
export function applyIdeaCommand({ ideas, sujets, cmd }) {
  const next = ideas.map((x) => ({ ...x }))
  const topics = [...sujets.topics]
  const lines = []
  for (const n of cmd.numbers) {
    const idea = next.find((x) => x.n === n)
    if (!idea) {
      lines.push(`- n° ${n} : numéro inconnu.`)
      continue
    }
    if (idea.status !== 'proposed') {
      lines.push(`- n° ${n} (${idea.title}) : déjà traitée (${LABEL[idea.status] ?? idea.status}).`)
      continue
    }
    if (cmd.action === 'reject') {
      idea.status = 'rejected'
      lines.push(`- n° ${n} (${idea.title}) : rejetée.`)
      continue
    }
    const slug = topicSlug(idea.slug)
    const twin = topics.find((t) => t.slug === slug || t.qid === idea.qid)
    if (twin) {
      idea.status = 'duplicate'
      const why = twin.slug === slug ? `le slug « ${slug} »` : `le qid ${idea.qid}`
      lines.push(`- n° ${n} (${idea.title}) : non ajoutée, ${why} est déjà dans sujets.json (sujet « ${twin.slug} »).`)
      continue
    }
    const wikipedia = Object.fromEntries(Object.entries(idea.wikipedia ?? {}).filter(([, v]) => v))
    topics.push({
      slug,
      title: idea.title,
      qid: idea.qid,
      ...(Object.keys(wikipedia).length ? { wikipedia } : {}),
      keywords: Array.isArray(idea.keywords) ? idea.keywords : [],
      status: 'pending',
    })
    idea.status = 'added'
    lines.push(`- n° ${n} (${idea.title}) : ajoutée à sujets.json (« ${slug} »).`)
  }
  const left = next.filter((x) => x.status === 'proposed').length
  const done = left === 0
  const reply = [...lines, '', done ? 'Plus aucune idée en attente : issue fermée.' : `Encore ${left} idée(s) en attente.`, ''].join('\n')
  return { ideas: next, sujets: { ...sujets, topics }, reply, done }
}

// Réécrit le bloc JSON et barre, dans la liste lisible (avant <details>), la
// ligne de chaque idée traitée. Idempotent : une ligne déjà barrée le reste.
export function writeIdeas(issueBody, ideas) {
  const body = String(issueBody ?? '')
  if (!IDEAS_JSON.test(body)) throw new Error('issue d’idées : bloc ```json``` introuvable')
  const withJson = body.replace(IDEAS_JSON, () => '```json\n' + JSON.stringify(ideas, null, 2) + '\n```')
  const cut = withJson.indexOf('<details>')
  const head = cut < 0 ? withJson : withJson.slice(0, cut)
  const treated = new Set(ideas.filter((x) => x.status !== 'proposed').map((x) => x.n))
  const struck = head.replace(/^(\d+)\. (?!~~)(.+?)(\r?)$/gm, (line, n, text, cr) =>
    treated.has(Number(n)) ? `${n}. ~~${text}~~${cr}` : line,
  )
  return cut < 0 ? struck : struck + withJson.slice(cut)
}
