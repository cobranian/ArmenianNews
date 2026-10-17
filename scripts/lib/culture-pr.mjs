// scripts/lib/culture-pr.mjs
// Le corps de la PR de relecture (spec §1.1) et de l'issue d'idées. Le texte
// est du Markdown GitHub : GitHub l'assainit, rien n'y est exécuté.
import { OVERLAP_THRESHOLD } from './culture-overlap.mjs'
import { FACTS_CHECKED, factsChecked } from './culture-validate.mjs'

const pct = (x) => `${(x * 100).toFixed(1)} %`

export const AUTO_START = '<!-- culture:auto:start -->'
export const AUTO_END = '<!-- culture:auto:end -->'

// Le texte de l'article est collé dans la PR : ses intertitres descendent de
// deux crans pour ne pas rivaliser avec les titres de section de la page.
const lowerHeadings = (md) => md.replace(/^(#{2,3}) /gm, (_, h) => (h === '##' ? '#### ' : '##### '))

// Garde-fou de taille (GitHub plafonne le corps à 65 536 caractères).
const MAX_NAMES = 60

function sourceLabel(s) {
  if (s.kind === 'unesco') return 'UNESCO'
  if (s.kind === 'hse') return `Encyclopédie soviétique arménienne (ՀՍՀ, Wikisource), révision ${s.revision}`
  return `Wikipédia ${s.lang}, révision ${s.revision}`
}

// La partie que le robot réécrit à chaque révision (entre les marqueurs).
export function buildAutoSection({ title, frBody = '', meta, unsupported, editorial = [], overlap, warnings = [] }) {
  const lines = [`## ${title}`, '']
  // Les alertes passent avant tout : c'est ce que le relecteur doit voir d'abord.
  const alerts = []
  if (unsupported === null) {
    alerts.push('Vérification automatique des faits indisponible (réponse du modèle illisible) : vérifiez à la main toutes les dates, tous les chiffres et tous les noms propres.')
  } else {
    for (const f of unsupported.facts) alerts.push(`⚠️ ${f} — introuvable tel quel dans les sources`)
  }
  for (const e of editorial) alerts.push(`ligne éditoriale : ${e}`)
  if (overlap > OVERLAP_THRESHOLD) {
    alerts.push(`recouvrement avec Wikipédia : ${pct(overlap)}, au-dessus du seuil de ${pct(OVERLAP_THRESHOLD)} — reformulez les passages trop proches de la source`)
  }
  for (const w of warnings) alerts.push(w)
  if (alerts.length) lines.push('### ⚠️ À vérifier en premier', ...alerts.map((a) => `- ${a}`))
  else lines.push('Rien à signaler : les faits extraits se retrouvent dans les sources, la ligne éditoriale et le recouvrement sont dans les limites.')
  lines.push('', '### Texte', '', lowerHeadings(frBody), '')
  const names = unsupported?.names ?? []
  if (names.length) {
    const shown = names.slice(0, MAX_NAMES)
    const more = names.length - shown.length
    lines.push(`<details><summary>Noms à confirmer (${names.length})</summary>`, '', ...shown.map((n) => `- ${n}`), ...(more ? [`- … (${more} de plus)`] : []), '', '</details>', '')
  }
  lines.push('### Image')
  if (meta.candidates?.length) {
    meta.candidates.forEach((c, i) => {
      lines.push(
        `${i}. ${i === meta.imageChoice ? '**choisie** ' : ''}[${c.file}](${c.commonsUrl}) — ${c.author}, ${c.license}`,
        `   <img src="${c.thumbUrl}" width="240">`,
      )
    })
    lines.push('', 'Pour en changer : modifiez `"imageChoice"` dans `meta.json` (0, 1 ou 2) **avant** de cocher la case.')
  } else {
    lines.push('Aucune image libre trouvée : la page affichera un motif.')
  }
  lines.push('', '### Sources', ...meta.sources.map((s) => `- [${s.title}](${s.url}) — ${sourceLabel(s)}`))
  const ev = meta.agendaEvent
  if (ev) lines.push('', '### Événement lié', `- [${ev.title}](${ev.url}) — ${String(ev.date).slice(0, 10)}${ev.location ? `, ${ev.location}` : ''}`)
  lines.push('', '### Modèle', `- Rédaction : \`${meta.model}\``, '')
  return lines.join('\n')
}

// Les marqueurs sont sur leur propre ligne : une ligne qui commence par `<!--`
// ouvre un bloc HTML CommonMark et le titre qui suit s'afficherait en clair.
const wrap = (auto) => `${AUTO_START}\n${auto.replace(/^\n+|\n+$/g, '')}\n${AUTO_END}`

export function buildPrBody(args) {
  return [
    wrap(buildAutoSection(args)),
    '',
    'Pour corriger : commentez `/corrige <consigne>` (ex. `/corrige retire le paragraphe sur le plat`).',
    'Pour publier, **en dernier** : cochez la case.',
    '',
    '- [ ] Faits vérifiés',
    '',
  ].join('\n')
}

// Remplace le contenu entre marqueurs ; tout le reste (case cochée comprise)
// est gardé tel quel. Sans marqueurs, la section est préfixée.
export function replaceAutoSection(body, auto) {
  const i = body.indexOf(AUTO_START)
  const j = body.indexOf(AUTO_END)
  if (i === -1 || j === -1 || j < i) return wrap(auto) + '\n' + body
  return body.slice(0, i) + wrap(auto) + body.slice(j + AUTO_END.length)
}

// La détection même de culture-check (factsChecked) : ce que le contrôle tient
// pour coché est exactement ce que /corrige décoche. Toutes les cases cochées
// sont décochées, pas seulement la première.
const CHECKED_ALL = new RegExp(FACTS_CHECKED.source, 'gm')
export const isChecked = factsChecked
export const uncheck = (body) => String(body ?? '').replace(CHECKED_ALL, '$1[ ]$2')

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// L'issue d'idées : une liste numérotée lisible sur téléphone, puis le JSON
// que `/ajoute` relit (`n` désigne l'idée, `qid` l'identifie sans homonyme).
// Chaque idée a déjà été vérifiée : son article Wikipédia existe (`url`) et
// son élément Wikidata n'est pas déjà dans sujets.json.
export function ideasIssueBody(ideas) {
  const entries = ideas.map((x, i) => ({
    n: i + 1,
    slug: slugify(x.title),
    title: x.title,
    qid: x.qid,
    wikipedia: { ...(x.wikipedia_fr ? { fr: x.wikipedia_fr } : {}), ...(x.wikipedia_en ? { en: x.wikipedia_en } : {}) },
    keywords: x.keywords,
    status: 'proposed',
  }))
  return [
    'Il reste moins d’une semaine de sujets dans `src/data/culture/sujets.json`. Voici des idées, chacune liée à un article Wikipédia existant :',
    '',
    ...ideas.map((x, i) => `${i + 1}. ${x.title} — [Wikipédia](${x.url})`),
    '',
    'Pour les retenir, commentez avec leurs numéros : `/ajoute 1 4 7`. Pour les écarter : `/rejette 2 3`.',
    '',
    '<details><summary>Données (lues par /ajoute)</summary>',
    '',
    '```json',
    JSON.stringify(entries, null, 2),
    '```',
    '',
    '</details>',
    '',
  ].join('\n')
}
