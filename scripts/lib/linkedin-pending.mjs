// LinkedIn à la main, avec Claude : la publication automatique y est fermée
// (l'API des pages est réservée aux entités juridiques enregistrées, refus
// du 28 oct. 2026). À chaque session Claude Code, un hook liste les articles
// pas encore partis sur les pages LinkedIn ; Claude propose de les publier
// par le navigateur, et ne le fait qu'après un « oui » dans la session.
//
// Même choix d'articles que le job horaire (`plan`, social.mjs) : mêmes
// types (SOCIAL_KINDS, Culture par défaut), même ordre, même plafond.
import { SITES } from '../../sites.config.js'
import { CHANNELS, plan, tagged } from './social.mjs'

// Pages entreprise créées le 28 oct. 2026 : id d'organisation pour l'URL
// d'administration, d'où l'on publie au nom de la page.
export const LINKEDIN_ORG = { ch: '146900320', org: '146899338' }
export const LINKEDIN_CHANNELS = CHANNELS.filter((c) => c.platform === 'linkedin')

export const adminUrl = (siteId) => `https://www.linkedin.com/company/${LINKEDIN_ORG[siteId]}/admin/dashboard/`

// Le texte à coller : en clair (pas le « little text » échappé de l'API),
// lien marqué pour GA4. LinkedIn tire l'aperçu de l'URL.
export function postText(item) {
  return `${item.title}\n\n${item.description}\n\n${tagged(item.url, 'linkedin')}`
}

// Premier passage d'un canal : comme le job horaire, on amorce l'archive pour
// ne pas l'inonder — mais on laisse le dernier article Culture en attente,
// pour qu'une page neuve ne reste pas vide.
export function pending({ items, ledger, kinds, now = new Date() }) {
  const seededBefore = new Set(Object.keys(ledger?.channels ?? {}))
  const r = plan({ items, channels: LINKEDIN_CHANNELS, ledger, kinds, now })
  for (const id of r.seeded) {
    const ch = LINKEDIN_CHANNELS.find((c) => c.id === id)
    const last = items
      .filter((it) => it.lang === ch.lang && kinds.includes(it.kind))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0]
    if (last) {
      delete r.ledger.channels[id].posted[last.id]
      r.posts.push({ channel: id, item: last })
    }
  }
  // `plan` marque d'avance ce qu'il propose ; ici rien n'est publié tant que
  // Claude ne l'a pas fait : on ne garde du registre que l'amorçage.
  for (const p of r.posts) if (seededBefore.has(p.channel)) delete r.ledger.channels[p.channel].posted[p.item.id]
  return { posts: r.posts, ledger: r.ledger, seeded: r.seeded }
}

export function hookMessage(posts) {
  if (!posts.length) return ''
  const lines = posts.map((p) => {
    const site = LINKEDIN_CHANNELS.find((c) => c.id === p.channel).siteId
    return `- ${p.channel} (${SITES[site].brand}) : ${p.item.id} — « ${p.item.title} »`
  })
  return [
    `RAPPEL LINKEDIN : ${posts.length} publication(s) en attente sur les pages LinkedIn.`,
    ...lines,
    '',
    'En début de réponse, annonce-le en une phrase et DEMANDE si tu dois les publier.',
    'Sur un « oui » : suis le skill `publier-linkedin` (texte exact : `node scripts/linkedin-pending.mjs --list`).',
    'Sans réponse ou sur un « non » : ne publie rien.',
  ].join('\n')
}
