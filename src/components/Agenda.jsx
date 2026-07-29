import { useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { worldCountryKey, countryFlag, countryLabel } from '../worldPlace.js'
import { SectionHead } from './SectionHead.jsx'
import { Carousel } from './Carousel.jsx'
import { Motif, hash, THEMES } from './motifs.jsx'
import agenda from '../data/agenda.json'

// A single event rendered as a "broadsheet clipping" card that lives inside a
// horizontal, ‹ ›-scrollable track. A top banner shows the event's armenopole
// image (hotlinked); events with no image — or an image that fails to load —
// fall back to a deterministic Armenian motif, keeping every card the same
// height. The date pastille overlays the banner's bottom-left corner.
// Les dates passent par les formateurs du contexte, jamais par `locale` :
// 'hy-AM' est une locale que le navigateur accepte sans savoir la rendre, et un
// appel direct à toLocaleDateString ici afficherait ces pastilles dans la langue
// du lecteur au milieu d'une page arménienne (voir src/hyDate.js).
function EventCard({ ev, place }) {
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
    >
      <div
        className={`agenda-card__media${showPhoto ? ' agenda-card__media--photo' : ''}`}
        style={{ '--c1': theme.c1, '--c2': theme.c2, '--ink': theme.ink }}
      >
        {showPhoto ? (
          <img
            className="agenda-card__photo"
            src={ev.image}
            alt={ev.title}
            loading="lazy"
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
        <h4 className="agenda-card__title">{ev.title}</h4>
        <div className="agenda-card__foot">
          {when && <span className="agenda-card__when">{when}</span>}
          <span className="agenda-card__go" aria-hidden="true">↗</span>
        </div>
      </div>
    </a>
  )
}

export function Agenda() {
  const { t, lang } = useI18n()

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

    const labelOf = (key) => countryLabel(key, lang, rep[key]?.location)
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
  const events = active ? groups[active] : []

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
                <EventCard key={ev.url || i} ev={ev} place={ev.location} />
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
      </div>
    </section>
  )
}
