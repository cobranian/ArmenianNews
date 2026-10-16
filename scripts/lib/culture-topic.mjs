// Le choix du sujet de la semaine (spec §1.1) : un sujet de la liste curée
// dont un événement de l'agenda tombe dans les 21 jours passe devant — le
// plus proche d'abord ; sinon le premier disponible.
//
// « Disponible » = `pending` ET sans PR ouverte ET sans dossier déjà présent.
// Sans la deuxième condition, un sujet en relecture serait rédigé une seconde
// fois le lundi suivant ; sans la troisième, un statut remis à `pending` à la
// main ferait réécrire un article publié.
import { evenementsAVenir } from '../../src/agendaEvents.js'
import { CULTURE_SLUG } from '../../sites.config.js'

export const WINDOW_DAYS = 21
export const STATUSES = ['pending', 'published', 'rejected']

const fold = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

export function availableTopics(topics, { openBranches = [], existing = [] } = {}) {
  const open = new Set(openBranches)
  const done = new Set(existing)
  return topics.filter((t) => t.status === 'pending' && !open.has(`culture/${t.slug}`) && !done.has(t.slug))
}

export function agendaMatch(topic, agenda, now = Date.now()) {
  const keys = (Array.isArray(topic.keywords) ? topic.keywords : []).map(fold).filter(Boolean)
  if (!keys.length || !agenda) return null
  const all = [...(agenda.switzerland ?? []), ...(agenda.world ?? [])]
  const limit = now + WINDOW_DAYS * 86400000
  return (
    evenementsAVenir(all, now)
      .filter((e) => new Date(e.date).getTime() <= limit)
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((e) => keys.some((k) => fold(e.title).includes(k))) ?? null
  )
}

export function pickTopic({ topics, openBranches = [], existing = [], agenda = null, now = Date.now() }) {
  const avail = availableTopics(topics, { openBranches, existing })
  const matched = avail
    .map((topic) => ({ topic, event: agendaMatch(topic, agenda, now) }))
    .filter((x) => x.event)
    .sort((a, b) => a.event.date.localeCompare(b.event.date))
  if (matched.length) return matched[0]
  return avail.length ? { topic: avail[0], event: null } : null
}

export function setTopicStatus(file, slug, status) {
  if (!STATUSES.includes(status)) throw new Error(`statut invalide : ${status}`)
  if (!file.topics.some((t) => t.slug === slug)) throw new Error(`sujet inconnu : ${slug}`)
  return { ...file, topics: file.topics.map((t) => (t.slug === slug ? { ...t, status } : t)) }
}

export function validateTopics(file) {
  if (!Array.isArray(file?.topics)) return ['sujets.json : « topics » doit être un tableau']
  const errs = []
  const seen = new Set()
  file.topics.forEach((t, i) => {
    const at = `sujets.json[${i}] (${t?.slug})`
    if (!CULTURE_SLUG.test(t?.slug ?? '')) errs.push(`${at} : slug invalide`)
    else if (seen.has(t.slug)) errs.push(`${at} : slug en double`)
    seen.add(t?.slug)
    if (!STATUSES.includes(t?.status)) errs.push(`${at} : statut invalide`)
    if (!t?.wikipedia?.fr && !t?.wikipedia?.en) errs.push(`${at} : aucun article Wikipédia (fr ou en)`)
    if (!Array.isArray(t?.keywords)) errs.push(`${at} : « keywords » doit être un tableau`)
  })
  return errs
}
