/**
 * Les pages Agenda par pays — /agenda/suisse/, /events/france/… — HTML
 * complets écrits au build, comme la brève et Culture (même coquille,
 * static-shell.mjs) : hors du bundle React, hors du prérendu, donc sans risque
 * d'hydratation.
 *
 * Pourquoi ces pages : c'est la seule donnée que ce site est seul à agréger
 * (les 21 pages pays d'Armenopole, dédoublonnées et regroupées par le lieu
 * réel), et elle répond à une recherche réelle — « événements arméniens
 * Genève », « armenian events london ». Une page par pays et non par ville :
 * les villes ont trop peu d'événements pour faire autre chose que des pages
 * minces, ce que Google traite comme du contenu de masse.
 *
 * Qui a une page, et laquelle est indexable : PAYS_PAGE_MIN / PAYS_INDEX_MIN
 * dans src/agendaEvents.js (le lien depuis /agenda/ dépend de la même règle).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ALL_LANGS, agendaCountryUrl, agendaCountryPath, pathFor } from '../../sites.config.js'
import { AGENDA_PAYS_STRINGS } from '../../src/agendaPaysStrings.js'
import { countryLabel, placeLabel } from '../../src/worldPlace.js'
import { eventAnchor, PAYS_INDEX_MIN } from '../../src/agendaEvents.js'
import { hyLongDate } from '../../src/hyDate.js'
import { agendaPaysHeadFor } from './site-meta.mjs'
import { esc, pageShell } from './static-shell.mjs'

// Les mêmes locales que l'interface (LOCALES, src/i18n.jsx — illisible ici,
// c'est du JSX). L'arménien passe par ses tables écrites en dur : Intl le rend
// dans Node mais pas dans un navigateur, et la date doit être la même que
// celle que /agenda/ affiche (voir « À savoir » dans CLAUDE.md).
const LOCALES = { fr: 'fr-FR', de: 'de-CH', it: 'it-CH', en: 'en-GB', ru: 'ru-RU' }

// La date d'un événement, comme formatDate (i18n.jsx) : jour, mois, année.
// `ev.date` est une heure murale sans fuseau, lue en heure locale par les deux.
export function agendaDate(lang, iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (lang === 'hy') return hyLongDate(d)
  return d.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric' })
}

export const indexable = (events) => events.length >= PAYS_INDEX_MIN

// Les pays qui se lient entre eux : les seuls indexables, triés par nom dans
// la langue de la page — l'ordre du sélecteur de /agenda/.
export function paysIndexables(pays, lang) {
  return [...pays.entries()]
    .filter(([, evs]) => indexable(evs))
    .map(([k]) => k)
    .sort((a, b) => countryLabel(a, lang).localeCompare(countryLabel(b, lang), lang))
}

export function agendaPaysHtml({ siteId, lang, key, events, pays, cssHref }) {
  const s = AGENDA_PAYS_STRINGS[lang]
  const country = countryLabel(key, lang)
  const items = events
    .map(
      (ev) => `          <li id="${eventAnchor(ev)}">
            <time class="agenda-list__date" datetime="${esc(ev.date)}">${esc(agendaDate(lang, ev.date))}</time>
            <h3 class="agenda-list__title"><a href="${esc(ev.url)}" rel="noopener noreferrer">${esc(ev.title)}</a></h3>
            <p class="agenda-list__where">${esc(placeLabel(ev.location, lang))}</p>
          </li>`,
    )
    .join('\n')
  const others = paysIndexables(pays, lang)
    .filter((k) => k !== key)
    .map((k) => `<a href="${agendaCountryPath(lang, k)}">${esc(countryLabel(k, lang))}</a>`)
    .join(' · ')
  const body = `    <main class="viewpage" data-agenda-pays="${key}">
      <div class="container">
        <h1 class="viewpage__title">${esc(s.title(country))}</h1>
        <p class="viewpage__intro">${esc(s.intro)}</p>
        <p class="viewpage__count">${esc(s.count(events.length))}</p>
      </div>
      <section class="section">
        <div class="container">
          <ul class="agenda-list">
${items}
          </ul>
        </div>
      </section>
      <div class="container">
        ${others ? `<p class="viewpage__also">${esc(s.others)} : ${others}</p>` : ''}
        <p class="viewpage__back"><a href="${pathFor(lang, 'agenda')}">${esc(s.all)}</a></p>
      </div>
    </main>`
  const head = agendaPaysHeadFor({
    siteId, lang, key, events,
    robots: indexable(events) ? null : 'noindex, follow',
  })
  const langHrefs = Object.fromEntries(ALL_LANGS.map((l) => [l, agendaCountryUrl(l, key)]))
  return pageShell({ siteId, lang, head, cssHref, body, langHrefs })
}

// Les pages d'UNE vitrine, dans ses langues. `pays` vient de paysDeLAgenda,
// calculé UNE fois pour les deux vitrines (build-sites.mjs) : deux horloges
// pourraient donner un pays au .ch et pas au .org, et les hreflang croisés
// pointeraient alors sur un 404.
export async function writeAgendaPaysPages(site, dist, pays, cssHref) {
  let n = 0
  for (const { lang } of site.pages) {
    for (const [key, events] of pays) {
      const dir = path.join(dist, agendaCountryPath(lang, key).replace(/^\/|\/$/g, ''))
      await mkdir(dir, { recursive: true })
      await writeFile(
        path.join(dir, 'index.html'),
        agendaPaysHtml({ siteId: site.id, lang, key, events, pays, cssHref }),
        'utf-8',
      )
      n++
    }
  }
  return n
}
