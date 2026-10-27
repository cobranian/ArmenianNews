import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { worldCountryKey, countryFlag, countryLabel, placeLabel } from '../worldPlace.js'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import { Lightbox } from './Lightbox.jsx'
import { loadResume } from '../agendaResumes.js'
import { Motif, hash, THEMES } from './motifs.jsx'
import agenda from '../data/agenda.json'
import { pathFor, urlFor } from '../../sites.config.js'
import { eventAnchor } from '../agendaEvents.js'

// Un tableau vide stable : un `[]` neuf à chaque rendu relancerait le useMemo
// de la visionneuse.
const NO_EVENTS = []

// A single event rendered as a "broadsheet clipping" card that lives inside a
// horizontal, ‹ ›-scrollable track. A top banner shows the event's armenopole
// image (hotlinked); events with no image — or an image that fails to load —
// fall back to a deterministic Armenian motif, keeping every card the same
// height. The date pastille overlays the banner's bottom-left corner.
// Les dates passent par les formateurs du contexte, jamais par `locale` :
// 'hy-AM' est une locale que le navigateur accepte sans savoir la rendre, et un
// appel direct à toLocaleDateString ici afficherait ces pastilles dans la langue
// du lecteur au milieu d'une page arménienne (voir src/hyDate.js).
//
// Un clic ouvre l'affiche en grand dans la visionneuse des réseaux sociaux
// (Lightbox.jsx), d'où part le bouton « Voir sur armenopole ». La carte reste
// un vrai lien vers armenopole : sans JavaScript, dans le HTML prérendu que lit
// Google, et au clic du milieu ou avec Ctrl/Cmd (nouvel onglet), elle mène
// directement à l'événement — seul le clic simple est intercepté.
function EventCard({ ev, place, onOpen }) {
  const { formatDayNum, formatMonthAbbr, formatWeekdayTime } = useI18n()
  const d = ev.date ? new Date(ev.date) : null
  const day = d ? formatDayNum(d) : '–'
  const month = d ? formatMonthAbbr(d) : ''
  const when = d ? formatWeekdayTime(d) : null

  const [broken, setBroken] = useState(false)
  const showPhoto = ev.image && !broken
  const seed = hash(ev.url || ev.title || '')
  const theme = THEMES[seed % THEMES.length]

  return (
    <a
      className="agenda-card"
      href={ev.url || '#'}
      rel="noopener noreferrer"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        onOpen()
      }}
    >
      <div
        className={`agenda-card__media${showPhoto ? ' agenda-card__media--photo' : ''}`}
        style={{ '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
      >
        {showPhoto ? (
          <img
            className="agenda-card__photo"
            loading="lazy"
            src={ev.image}
            alt={ev.title}
            onError={() => setBroken(true)}
          />
        ) : (
          <svg className="agenda-card__motif" viewBox="0 0 100 100" aria-hidden="true">
            <Motif index={seed} />
          </svg>
        )}
        <span className="agenda-card__date">
          <span className="agenda-card__day">{day}</span>
          <span className="agenda-card__month">{month}</span>
        </span>
        {place && <span className="agenda-card__place">{place}</span>}
      </div>
      <div className="agenda-card__body">
        {/* h3, pas h4 : la section porte un h2 et rien entre les deux — un
            saut de niveau que Lighthouse signalait sur les quatre accueils.
            Le style est porté par la classe, pas par la balise. */}
        <h3 className="agenda-card__title">{ev.title}</h3>
        <div className="agenda-card__foot">
          {when && <span className="agenda-card__when">{when}</span>}
          <span className="agenda-card__go" aria-hidden="true">↗</span>
        </div>
      </div>
    </a>
  )
}

export function Agenda() {
  const { t, lang, formatDayNum, formatMonthAbbr, formatWeekdayTime } = useI18n()

  // Bucket every event under a canonical country key — Switzerland straight from
  // its own feed, the rest grouped by the country resolved from each event's
  // location (see worldPlace.js). Dedupe by URL: armenopole cross-lists the same
  // event on several country pages, so it arrives 2-3 times.
  const { order, groups, labelOf } = useMemo(() => {
    const groups = {}
    const rep = {} // key -> representative event, for labeling unmapped countries
    const seen = new Set()
    const push = (key, ev) => {
      const id = ev.url || `${ev.title}|${ev.date}`
      if (seen.has(id)) return
      seen.add(id)
      ;(groups[key] ||= []).push(ev)
      if (!rep[key]) rep[key] = ev
    }
    for (const ev of agenda.switzerland || []) push('switzerland', ev)
    for (const ev of agenda.world || []) push(worldCountryKey(ev), ev)

    const labelOf = (key) => countryLabel(key, lang, placeLabel(rep[key]?.location, lang))
    const foldLabel = (k) =>
      labelOf(k).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    // Every country on the same footing, alphabetical by localized name.
    // Switzerland used to be pinned to the top; it now takes its alphabetical
    // place like the rest, so the menu carries the same world-first framing as
    // the section subtitle and the Hero baseline.
    //
    // The order is NOT the default selection — that is `useState` below, which
    // still opens on Switzerland. Sorting and defaulting are deliberately kept
    // apart: `order[0]` would be an arbitrary country that CHANGES WITH THE
    // LANGUAGE (Allemagne in fr, Argentina in en), since the sort key is the
    // localized label. A default nobody chose, differing per language, is not
    // a world-first stance — just noise.
    const order = Object.keys(groups).sort((a, b) =>
      foldLabel(a).localeCompare(foldLabel(b)),
    )
    return { order, groups, labelOf }
  }, [lang])

  // Switzerland opens by default even though it is no longer first in the menu.
  // That split is the whole point: the ORDER carries the world-first framing,
  // the DEFAULT carries what the main readership actually came for. Do not
  // "tidy" this into `order[0]` — see the sort above for why that default would
  // differ per language.
  const [country, setCountry] = useState('switzerland')
  // Falls back to the first country when Switzerland has no upcoming event, so
  // the carousel is never empty.
  const active = groups[country] ? country : order[0]
  const events = active ? groups[active] : NO_EVENTS

  // La visionneuse parcourt les événements du pays affiché, comme celle des
  // réseaux sociaux parcourt un brin.
  const [box, setBox] = useState(null)
  const lbItems = useMemo(
    () =>
      events.map((ev) => {
        const seed = hash(ev.url || ev.title || '')
        const theme = THEMES[seed % THEMES.length]
        const d = ev.date ? new Date(ev.date) : null
        const day = d ? `${formatDayNum(d)} ${formatMonthAbbr(d)}` : ''
        const when = d ? formatWeekdayTime(d) : ''
        return {
          img: ev.image || null,
          alt: ev.title,
          title: ev.title,
          sub: [placeLabel(ev.location, lang), day, when].filter(Boolean).join(' · '),
          href: ev.url,
          cta: t('agenda.armenopole'),
          // Boutons de partage (src/share.js) : l'accueil de CE site, ancré
          // sur l'événement (#e-…). À l'arrivée, l'effet ci-dessous choisit
          // son pays, descend au carrousel et ouvre la visionneuse dessus —
          // jamais la page d'armenopole. « Voir sur Armenopole » reste la
          // sortie vers la billetterie.
          share: ev.url ? { url: `${urlFor(lang, 'home')}#${eventAnchor(ev)}`, title: ev.title } : undefined,
          // Le résumé n'est proposé que si le scrape l'a écrit dans cette
          // langue ; il n'est téléchargé qu'au premier dépli.
          summary: ev.resumeLangs?.includes(lang) ? () => loadResume(lang, ev.url) : undefined,
          seed,
          c1: theme.c1,
          c2: theme.c2,
          ink: theme.ink,
        }
      }),
    [events, formatDayNum, formatMonthAbbr, formatWeekdayTime, t, lang],
  )

  // Arrivée par un lien partagé (/#e-…) : le pays de l'événement, le carrousel
  // à l'écran, la visionneuse ouverte sur lui. AU MONTAGE seulement : le
  // prérendu ne connaît pas l'ancre (elle ne quitte jamais le navigateur), un
  // état initial qui en dépendrait casserait l'hydratation. Ancre inconnue
  // (événement passé, retiré) : l'accueil s'affiche normalement.
  useEffect(() => {
    const m = /^#(e-[0-9a-z]+)$/.exec(location.hash)
    if (!m) return
    for (const key of Object.keys(groups)) {
      const index = groups[key].findIndex((ev) => eventAnchor(ev) === m[1])
      if (index < 0) continue
      setCountry(key)
      setBox({ index, fromLink: true })
      document.getElementById('agenda')?.scrollIntoView({ block: 'start' })
      return
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une fois, au montage
  }, [])

  // Fermer la visionneuse ouverte par un lien retire l'ancre de l'adresse :
  // recharger la page ne la rouvrirait pas.
  const closeBox = () => {
    if (box?.fromLink && /^#e-[0-9a-z]+$/.test(location.hash)) {
      history.replaceState(null, '', location.pathname + location.search)
    }
    setBox(null)
  }

  return (
    <section className="section section--alt" id="agenda">
      <div className="container">
        <SectionHead
          eyebrow="Armenopole"
          title={t('agenda.title')}
          subtitle={t('agenda.subtitle')}
        />

        <div className="agenda reveal">
          {active ? (
            <Carousel
              titleControl
              resetKey={active}
              label={labelOf(active)}
              title={
                <span className="agenda-select">
                  <span className="agenda-select__flag" aria-hidden="true">
                    {countryFlag(active)}
                  </span>
                  <select
                    className="agenda-select__field"
                    aria-label={t('agenda.country')}
                    value={active}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    {order.map((k) => (
                      <option key={k} value={k}>
                        {labelOf(k)}
                      </option>
                    ))}
                  </select>
                  <span className="agenda-select__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              }
            >
              {events.map((ev, i) => (
                <EventCard
                  key={ev.url || i}
                  ev={ev}
                  place={placeLabel(ev.location, lang)}
                  onOpen={() => setBox({ index: i })}
                />
              ))}
            </Carousel>
          ) : (
            <div className="agenda__empty">
              <h3>
                <span className="agenda__flag">🌍</span>
                {t('agenda.title')}
              </h3>
              <p className="section__subtitle">{t('agenda.empty')}</p>
            </div>
          )}
        </div>

        {/* Le lien qui dit à Google laquelle des deux pages traite le sujet en
            profondeur. Son TEXTE porte la requête ; aucun nombre dedans, le
            compte d'événements bouge à chaque scrape horaire — voir Radio.jsx
            pour le même motif appliqué à /radio/. */}
        <p className="section__more">
          <a href={pathFor(lang, 'agenda')}>
            {t('agenda.more')} <span aria-hidden="true">→</span>
          </a>
        </p>
      </div>

      {box && (
        <Lightbox
          items={lbItems}
          startIndex={box.index}
          onClose={closeBox}
        />
      )}
    </section>
  )
}
