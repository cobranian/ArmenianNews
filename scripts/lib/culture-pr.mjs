// scripts/lib/culture-pr.mjs
// Le corps de la PR de relecture (spec §1.1) et de l'issue d'idées. Le texte
// est du Markdown GitHub : GitHub l'assainit, rien n'y est exécuté.
import { OVERLAP_THRESHOLD } from './culture-overlap.mjs'

const pct = (x) => `${(x * 100).toFixed(1)} %`

export const AUTO_START = '<!-- culture:auto:start -->'
export const AUTO_END = '<!-- culture:auto:end -->'

// Le texte de l'article est collé dans la PR : ses intertitres descendent de
// deux crans pour ne pas rivaliser avec les titres de section de la page.
const lowerHeadings = (md) => md.replace(/^(#{2,3}) /gm, (_, h) => (h === '##' ? '#### ' : '##### '))

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
    lines.push(`<details><summary>Noms à confirmer (${names.length})</summary>`, '', ...names.map((n) => `- ${n}`), '', '</details>', '')
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

export function buildPrBody(args) {
  return [
    AUTO_START + buildAutoSection(args) + AUTO_END,
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
  if (i === -1 || j === -1 || j < i) return AUTO_START + auto + AUTO_END + body
  return body.slice(0, i + AUTO_START.length) + auto + body.slice(j)
}

const CHECKED = /^(\s*[-*] )\[[xX]\]( Faits vérifiés)/m
export const isChecked = (body) => CHECKED.test(String(body ?? ''))
export const uncheck = (body) => String(body).replace(CHECKED, '$1[ ]$2')

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function ideasIssueBody(ideas) {
  const entries = ideas.map((x) => ({
    slug: slugify(x.title),
    title: x.title,
    wikipedia: { ...(x.wikipedia_fr ? { fr: x.wikipedia_fr } : {}), ...(x.wikipedia_en ? { en: x.wikipedia_en } : {}) },
    keywords: x.keywords,
    status: 'pending',
  }))
  return [
    'La liste `src/data/culture/sujets.json` est épuisée. Voici des idées générées ;',
    'copiez celles que vous retenez dans le tableau `topics`, **vérifiez les titres Wikipédia**, puis fermez cette issue.',
    '',
    ...ideas.map((x) => `- ${x.title}`),
    '',
    '```json',
    JSON.stringify(entries, null, 2),
    '```',
    '',
  ].join('\n')
}
