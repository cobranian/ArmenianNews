// Composition du numéro hebdomadaire (Markdown, rendu par Buttondown) à partir
// de contenus DÉJÀ publiés : brèves, articles Culture, agenda. Le numéro ne
// dépend que de ses arguments — `now` est injecté, jamais lu — pour que les
// tests ne vieillissent pas. L'envoi vit ailleurs.
import { SITES, briefUrl, cultureUrl, agendaCountryUrl, urlFor } from '../../sites.config.js'
import { evenementsAVenir, instantMural } from '../../src/agendaEvents.js'
import { worldCountryKey, placeLabel } from '../../src/worldPlace.js'
import { NEWSLETTER_STRINGS } from '../../src/newsletterStrings.js'

const JOUR = 86400000
const FENETRE_AGENDA = 14
const MAX_EVENEMENTS = 8

// Semaine ISO 8601 : le jeudi de la semaine décide de l'année.
export function isoWeek(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const debut = Date.UTC(d.getUTCFullYear(), 0, 1)
  const n = Math.ceil(((d - debut) / JOUR + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(n).padStart(2, '0')}`
}

// Un titre ne doit pas pouvoir fermer son lien : on échappe [ ] ( ).
const echappe = (s) => String(s).replace(/([[\]()])/g, '\\$1')
const lien = (texte, url) => `[${echappe(texte)}](${url})`

const jourISO = (t) => new Date(t).toISOString().slice(0, 10)

export function digestFor(siteId, { briefs, culture, events, now }) {
  const lang = SITES[siteId].newsletter.lang
  const S = NEWSLETTER_STRINGS[lang]
  const week = isoWeek(now)
  const utm = `?utm_source=newsletter&utm_medium=email&utm_campaign=hebdo-${week}`
  const t0 = now.getTime()
  // Les 7 jours qui précèdent le jour de `now` (celui-ci exclu : sa brève
  // ouvrira le numéro suivant).
  const debut = jourISO(t0 - 7 * JOUR)
  const fin = jourISO(t0)
  const dansFenetre = (date) => date >= debut && date < fin

  const lesBreves = (briefs?.[lang] || [])
    .filter((b) => dansFenetre(b.date) && b.topics?.[0]?.title)
    .sort((a, b) => a.date.localeCompare(b.date))
  const lesArticles = (culture || [])
    .filter((a) => dansFenetre(a.date) && a.langs?.[lang]?.title)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!lesBreves.length && !lesArticles.length) return null

  // Heure murale lue comme UTC (décalage 0) : le résultat ne dépend pas de la
  // machine qui compose le numéro.
  const fmtDate = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const limite = t0 + FENETRE_AGENDA * JOUR
  const lesEvenements = evenementsAVenir(events || [], t0, 0)
    .filter((e) => instantMural(e.date, 0) < limite)
    .sort((a, b) => instantMural(a.date, 0) - instantMural(b.date, 0))
    .slice(0, MAX_EVENEMENTS)

  const parts = [S.intro]
  if (lesBreves.length) {
    parts.push(`## ${S.briefs}`, lesBreves.map((b) => `- ${lien(b.topics[0].title, briefUrl(lang, b.date) + utm)}`).join('\n'))
  }
  if (lesArticles.length) {
    parts.push(
      `## ${S.culture}`,
      lesArticles
        .map((a) => {
          const { title, description } = a.langs[lang]
          return `- ${lien(title, cultureUrl(lang, a.slug) + utm)}${description ? `\n  ${description}` : ''}`
        })
        .join('\n'),
    )
  }
  if (lesEvenements.length) {
    parts.push(
      `## ${S.agenda}`,
      lesEvenements
        .map((e) => {
          const lieu = placeLabel(e.location, lang)
          const texte = `${e.title} — ${fmtDate.format(new Date(`${e.date}Z`))}${lieu ? ` — ${lieu}` : ''}`
          return `- ${lien(texte, agendaCountryUrl(lang, worldCountryKey(e)) + utm)}`
        })
        .join('\n'),
      lien(S.more, urlFor(lang, 'agenda') + utm),
    )
  }
  return { week, subject: S.subject(fmtDate.format(new Date(t0))), body: parts.join('\n\n') + '\n' }
}
