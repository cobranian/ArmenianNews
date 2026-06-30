import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'
import agenda from '../data/agenda.json'

// Recurring Lausanne gatherings (from armeniensdelausanne.ch).
const RECURRING = {
  fr: ['Cours de danse · Dimanche 9h–10h, Studio 2 (Lausanne)', 'Cours de danse · Mardi 18h–19h, Maison de quartier des Faverges'],
  en: ['Dance class · Sunday 9–10am, Studio 2 (Lausanne)', 'Dance class · Tuesday 6–7pm, Faverges community house'],
  hy: ['Պարի դաս · Կիրակի 9:00–10:00, Studio 2 (Լոզան)', 'Պարի դաս · Երեքշաբթի 18:00–19:00, Faverges'],
}

function EventRow({ ev, locale, place }) {
  const d = ev.date ? new Date(ev.date) : null
  const day = d ? d.toLocaleDateString(locale, { day: 'numeric' }) : '–'
  const month = d ? d.toLocaleDateString(locale, { month: 'short' }).replace('.', '') : ''

  return (
    <a
      className="event"
      href={ev.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'inherit' }}
    >
      <span className="event__date">
        <span className="event__day">{day}</span>
        <span className="event__month">{month}</span>
      </span>
      <span>
        <span className="event__title">{ev.title}</span>
        <span className="event__meta">
          {place && <span>{place}</span>}
          {ev.date && (
            <span>
              {new Date(ev.date).toLocaleDateString(locale, {
                weekday: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </span>
      </span>
    </a>
  )
}

export function Agenda() {
  const { t, lang, locale } = useI18n()
  const recurring = RECURRING[lang] || RECURRING.fr

  return (
    <section className="section section--alt" id="agenda">
      <div className="container">
        <SectionHead
          eyebrow="Armenopole"
          title={t('agenda.title')}
          subtitle={t('agenda.subtitle')}
        />
        <div className="agenda reveal">
          <div className="agenda__col">
            <h3>
              <span className="agenda__flag">🇨🇭</span>
              {t('agenda.switzerland')}
            </h3>
            {agenda.switzerland?.length ? (
              agenda.switzerland.map((ev, i) => (
                <EventRow key={i} ev={ev} locale={locale} place={ev.location} />
              ))
            ) : (
              <p className="section__subtitle">{t('agenda.empty')}</p>
            )}

            <div className="recurring">
              <h4>{t('agenda.recurring')}</h4>
              <ul>
                {recurring.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="agenda__col">
            <h3>
              <span className="agenda__flag">🌍</span>
              {t('agenda.world')}
            </h3>
            {agenda.world?.length ? (
              agenda.world.map((ev, i) => (
                <EventRow
                  key={i}
                  ev={ev}
                  locale={locale}
                  place={ev.location || ev.country}
                />
              ))
            ) : (
              <p className="section__subtitle">{t('agenda.empty')}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
