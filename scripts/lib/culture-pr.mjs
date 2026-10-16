// scripts/lib/culture-pr.mjs
// Le corps de la PR de relecture (spec §1.1) et de l'issue d'idées. Le texte
// est du Markdown GitHub : GitHub l'assainit, rien n'y est exécuté.
import { OVERLAP_THRESHOLD } from './culture-overlap.mjs'

const pct = (x) => `${(x * 100).toFixed(1)} %`

export function buildPrBody({ title, meta, unsupported, overlap, warnings = [] }) {
  const lines = [`## ${title}`, '']
  for (const w of warnings) lines.push(`> ⚠️ ${w}`)
  if (warnings.length) lines.push('')
  if (unsupported.length) {
    lines.push('### ⚠️ À vérifier en premier', 'Introuvables tels quels dans les sources :', ...unsupported.map((c) => `- ⚠️ ${c}`))
  } else {
    lines.push('### Faits', 'Toutes les dates, chiffres et noms propres extraits se retrouvent dans les sources.')
  }
  lines.push(
    '',
    `### Recouvrement avec Wikipédia : ${pct(overlap)}${overlap > OVERLAP_THRESHOLD ? ` — ⚠️ au-dessus du seuil de ${pct(OVERLAP_THRESHOLD)} : reformulez les passages trop proches de la source` : ''}`,
    '',
    '### Sources',
    ...meta.sources.map((s) => `- [${s.title}](${s.url}) — Wikipédia ${s.lang}, révision ${s.revision}`),
  )
  const ev = meta.agendaEvent
  if (ev) lines.push('', '### Événement lié', `- [${ev.title}](${ev.url}) — ${String(ev.date).slice(0, 10)}${ev.location ? `, ${ev.location}` : ''}`)
  lines.push('', '### Image')
  if (meta.candidates?.length) {
    meta.candidates.forEach((c, i) => {
      lines.push(
        `${i}. ${i === meta.imageChoice ? '**choisie** ' : ''}[${c.file}](${c.commonsUrl}) — ${c.author}, ${c.license}`,
        `   <img src="${c.thumbUrl}" width="240">`,
      )
    })
    lines.push('', 'Pour en changer : modifiez `"imageChoice"` dans `meta.json` (0, 1 ou 2) **avant** de poser l’étiquette.')
  } else {
    lines.push('Aucune image libre trouvée : la page affichera un motif.')
  }
  lines.push(
    '',
    '### Modèle',
    `- Rédaction : \`${meta.model}\``,
    '',
    '### Relecture',
    '1. Corrigez `fr.md` (onglet « Files changed », menu ⋯ → *Edit file*).',
    '2. Cochez la case ci-dessous quand les faits sont vérifiés.',
    '3. Posez l’étiquette **traduire** : en, hy et ru sont produits depuis votre texte.',
    '4. Fusionnez quand le statut `culture-check` est vert. *Il ne bloque pas la fusion : c’est à vous de le regarder.*',
    '',
    '- [ ] Faits vérifiés',
    '',
  )
  return lines.join('\n')
}

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
