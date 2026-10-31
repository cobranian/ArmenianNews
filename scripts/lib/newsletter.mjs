// Composition du numéro hebdomadaire (Markdown, rendu par Buttondown) à partir
// de contenus DÉJÀ publiés : brèves, articles Culture, agenda. Le numéro ne
// dépend que de ses arguments — `now` est injecté, jamais lu — pour que les
// tests ne vieillissent pas. L'envoi vit ailleurs.
import { SITES, briefUrl, cultureUrl, agendaCountryUrl, urlFor } from '../../sites.config.js'
import { evenementsAVenir, instantMural, paysDeLAgenda, PAYS_INDEX_MIN } from '../../src/agendaEvents.js'
import { worldCountryKey, placeLabel } from '../../src/worldPlace.js'
import { NEWSLETTER_STRINGS } from '../../src/newsletterStrings.js'
import { HY_MONTHS_GENITIVE } from '../../src/hyDate.js'

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

// Un texte tiers (titre, description) ne doit ni fermer son lien ([ ] ( )),
// ni ouvrir une balise (< >), ni basculer en italique ou en gras (* _) dans le
// Markdown que rend Buttondown. La barre oblique inverse est échappée aussi :
// sinon un « \ » final échapperait le « ] » du lien.
export const echappe = (s) => String(s).replace(/([\\[\]()<>*_])/g, '\\$1')
const lien = (texte, url) => `[${echappe(texte)}](${url})`

const jourISO = (t) => new Date(t).toISOString().slice(0, 10)

// Lundi 00:00 UTC de la semaine ISO de `now`, en millisecondes.
function lundiDe(now) {
  const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const dow = new Date(d).getUTCDay() || 7
  return d - (dow - 1) * JOUR
}

// `lang` : la langue de la lettre (une liste par langue, sites.config.js) ;
// par défaut la langue de tête de la vitrine. L'agenda suit la vitrine
// (`agendaPays`), pas la langue.
export function digestFor(siteId, { briefs, culture, events, now, lang = SITES[siteId].pages[0].lang }) {
  if (!(lang in (SITES[siteId].newsletter?.lists ?? {}))) throw new Error(`pas de lettre ${lang} sur ${siteId}`)
  const S = NEWSLETTER_STRINGS[lang]
  const week = isoWeek(now)
  const utm = `?utm_source=newsletter&utm_medium=email&utm_campaign=hebdo-${week}`
  const t0 = now.getTime()
  // La semaine ISO PRÉCÉDENTE, du lundi au dimanche inclus (UTC), quel que
  // soit le jour du passage : le rattrapage d'un mardi ou d'un mercredi couvre
  // la même semaine que le lundi — sans perdre le début de la semaine écoulée
  // ni empiéter sur la semaine en cours. `week` (clé du registre et de l'UTM)
  // reste la semaine de l'envoi ; l'objet date le lundi de la semaine couverte.
  const lundi = lundiDe(now) - 7 * JOUR
  const debut = jourISO(lundi)
  const fin = jourISO(lundi + 7 * JOUR)
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
  // L'arménien a ses mois écrits en dur (src/hyDate.js) : Intl dépend de
  // l'ICU de la machine, et un Node à ICU réduit rendrait une autre langue.
  const fmtDate =
    lang === 'hy'
      ? { format: (d) => `${d.getUTCDate()} ${HY_MONTHS_GENITIVE[d.getUTCMonth()]}` }
      : new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const aVenir = evenementsAVenir(events || [], t0, 0)
  // Même règle que le sitemap : un lien vers un pays seulement si sa page est
  // bâtie ET indexable (clé connue, au moins PAYS_INDEX_MIN événements à venir,
  // tous événements à venir comptés, pas seulement ceux du numéro). Sinon
  // l'index de l'agenda — jamais d'exception pour un lieu inconnu.
  const pays = paysDeLAgenda(aVenir)
  const lienAgenda = (e) => {
    const k = worldCountryKey(e)
    return ((pays.get(k)?.length ?? 0) >= PAYS_INDEX_MIN ? agendaCountryUrl(lang, k) : urlFor(lang, 'agenda')) + utm
  }
  const limite = t0 + FENETRE_AGENDA * JOUR
  // Les pays retenus par la vitrine (sites.config.js), par ordre de priorité ;
  // sans liste, le monde entier par ordre chronologique.
  const retenus = SITES[siteId].newsletter.agendaPays ?? null
  const rang = (e) => (retenus ? retenus.indexOf(worldCountryKey(e)) : 0)
  const lesEvenements = aVenir
    .filter((e) => instantMural(e.date, 0) < limite && rang(e) >= 0)
    .sort((a, b) => rang(a) - rang(b) || instantMural(a.date, 0) - instantMural(b.date, 0))
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
          return `- ${lien(title, cultureUrl(lang, a.slug) + utm)}${description ? `\n  ${echappe(description)}` : ''}`
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
          return `- ${lien(texte, lienAgenda(e))}`
        })
        .join('\n'),
      lien(S.more, urlFor(lang, 'agenda') + utm),
    )
  }
  return { week, subject: S.subject(fmtDate.format(new Date(lundi))), body: parts.join('\n\n') + '\n' }
}
