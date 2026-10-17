// llms.txt (https://llmstxt.org) : la carte du site écrite pour les assistants
// IA — ce qu'est le site, ses pages, ses articles Culture. Google ne s'en sert
// pas ; d'autres moteurs et agents le lisent. Tout est DÉRIVÉ (sites.config.js,
// src/seo.js, chaînes de la brève et de Culture, articles chargés) : aucun
// texte ici ne peut dériver de la page qu'il décrit, et aucune URL n'est écrite
// à la main.
import { SITES, siteOf, urlFor, briefUrl, cultureUrl } from '../../sites.config.js'
import { SEO, VIEW_SEO } from '../../src/seo.js'
import { BRIEF_STRINGS } from '../../src/briefStrings.js'
import { CULTURE_STRINGS } from '../../src/cultureStrings.js'

// La seule prose propre à ce fichier : ce que le site EST, pour une machine qui
// ne le connaît pas. Dans la langue de tête de la vitrine.
const INTRO = {
  fr: (s) =>
    `${s.brand} agrège chaque heure les rédactions arméniennes (Armenpress, CivilNet, Courrier d'Erevan, Nouvelles d'Arménie…), ` +
    `l'agenda des communautés arméniennes et des radios en direct. Chaque article renvoie à sa source d'origine. ` +
    `Les articles Culture sont des textes de fond, sourcés (Wikipédia, Wikisource, UNESCO), rédigés avec un outil d'IA puis relus. ` +
    `Éditeur : ${s.editor}.`,
  en: (s) =>
    `${s.brand} aggregates Armenian newsrooms every hour (Armenpress, CivilNet, NEWS.am, Asbarez, The Armenian Weekly…), ` +
    `Armenian community events worldwide and live radio stations. Every news item links to its original source. ` +
    `Culture articles are sourced long-form pieces (Wikipedia, Wikisource, UNESCO), drafted with an AI tool and then reviewed. ` +
    `Editor: ${s.editor}.`,
}

const line = (title, url, description) => `- [${title}](${url})${description ? `: ${description}` : ''}`

function pagesFor(lang, briefs) {
  const out = [line(SEO[lang].tagline, urlFor(lang, 'home'), SEO[lang].description)]
  for (const view of ['radio', 'agenda', 'about']) {
    const v = VIEW_SEO[view]?.[lang]
    if (v) out.push(line(v.title, urlFor(lang, view), v.description))
  }
  const b = BRIEF_STRINGS[lang]
  if (b) {
    const latest = briefs?.[lang]?.[0]
    out.push(line(b.title, briefUrl(lang), b.description))
    if (latest) out.push(line(`${b.title} — ${latest.date}`, briefUrl(lang, latest.date), latest.intro))
  }
  return out
}

function cultureFor(lang, culture) {
  const c = CULTURE_STRINGS[lang]
  if (!c) return []
  const out = [line(c.title, cultureUrl(lang), c.description)]
  for (const a of culture ?? []) {
    const t = a.langs?.[lang]
    if (t) out.push(line(t.title, cultureUrl(lang, a.slug), t.description))
  }
  return out
}

export function llmsFor(siteId, { briefs = {}, culture = [] } = {}) {
  const site = SITES[siteId]
  if (!site) throw new Error(`site inconnu : ${siteId}`)
  const langs = site.pages.map((p) => p.lang).filter((l) => siteOf(l) === siteId)
  const head = langs[0]
  const intro = (INTRO[head] ?? INTRO.en)(site)
  const parts = [`# ${site.brand}`, '', `> ${SEO[head].description}`, '', intro, '']
  for (const lang of langs) {
    const label = langs.length > 1 ? ` (${lang})` : ''
    parts.push(`## ${SEO[lang].tagline}${label}`, '', ...pagesFor(lang, briefs), '')
    parts.push(`## ${CULTURE_STRINGS[lang]?.title ?? 'Culture'}${label}`, '', ...cultureFor(lang, culture), '')
  }
  // Les autres langues vivent sur l'autre vitrine : on les signale sans les
  // détailler, pour qu'un agent sache où trouver le français ou l'anglais.
  const other = Object.values(SITES).find((s) => s.id !== siteId)
  if (other) parts.push('## Optional', '', line(other.brand, `${other.host}/llms.txt`, null), '')
  return parts.join('\n')
}
