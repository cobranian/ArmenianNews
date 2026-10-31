// Ce que la brève quotidienne reçoit : quand elle est due, et quels articles.
//
// La date d'une brève est la date MURALE D'EREVAN, pas celle d'UTC ni celle de
// la machine : un scrape à 20:30 UTC est déjà le lendemain à Erevan, et le
// runner de la CI est en UTC là où un poste local ne l'est pas. Intl est sûr
// ici (Node a l'ICU complet ; c'est le NAVIGATEUR qui n'a pas hy-AM, voir
// src/hyDate.js) — et on ne formate qu'en chiffres.
import { TAB_ORDER, feedFor } from '../../src/newsLangs.js'
import { rubricOf } from '../../src/rubrics.js'

export const BRIEF_HOUR = 7
export const WINDOW_MS = 24 * 3600 * 1000
export const MAX_ARTICLES = 100
export const MIN_ARTICLES = 10
// L'espagnol n'a que Armenpress es (muet le week-end) et Diario Armenia : 5 à 8
// articles par 24 h le dimanche et le lundi. Avec 10, la brève sautait et
// `checkBriefs` ouvrait une fausse issue [sources-down].
export const MIN_ARTICLES_BY_LANG = { es: 5 }
export const minArticles = (lang) => MIN_ARTICLES_BY_LANG[lang] ?? MIN_ARTICLES

const CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Yerevan',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

export function yerevanClock(now = new Date()) {
  const p = Object.fromEntries(CLOCK.formatToParts(now).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
}

// Due : pas encore écrite ET la journée d'Erevan a commencé (7 h). Une brève
// écrite n'est JAMAIS régénérée — son URL datée garde un contenu stable.
export function isBriefDue(now, exists) {
  return !exists && yerevanClock(now).hour >= BRIEF_HOUR
}

// Les articles de la langue, sur les 24 h précédentes, dans les sources que
// TAB_ORDER attribue à cette langue — la même règle que le fil. Un article
// sans titre, sans URL ou sans date lisible est écarté : on ne peut ni le
// situer dans la journée ni le citer.
export function selectArticles(news, lang, now = new Date(), max = MAX_ARTICLES) {
  const end = now.getTime()
  const since = end - WINDOW_MS
  const seen = new Set()
  const out = []
  for (const source of TAB_ORDER[lang] ?? []) {
    for (const shelf of feedFor(news, source, lang)) {
      const key = shelf.categoryKey ?? shelf.sectionKey
      for (const a of shelf.articles ?? []) {
        const title = typeof a?.title === 'string' ? a.title.replace(/\s+/g, ' ').trim() : ''
        const t = Date.parse(a?.date)
        if (!title || !a?.url || Number.isNaN(t) || t < since || seen.has(a.url)) continue
        seen.add(a.url)
        out.push({ source, rubric: rubricOf(source, key, a), title, url: a.url, date: a.date, t })
      }
    }
  }
  out.sort((x, y) => y.t - x.t)
  return out
    .slice(0, max)
    .map((a, i) => ({ id: i + 1, source: a.source, rubric: a.rubric, title: a.title, url: a.url, date: a.date }))
}
