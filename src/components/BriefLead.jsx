import BRIEFS from 'virtual:brief-lead'
import { useI18n } from '../i18n.jsx'
import { briefPath } from '../../sites.config.js'
import { BRIEF_STRINGS } from '../briefStrings.js'

// La brève du jour en tête de l'accueil de/it : ces langues lisent le fil
// français, la brève est leur seul texte du jour dans leur langue. App.jsx ne
// la monte que là (contentLang(lang) !== lang).
//
// Hydratation : rien ici ne dépend de l'heure. La date est celle du fichier,
// formatée à MIDI heure murale (`T12:00:00`, sans fuseau) — une date seule
// (« 2026-10-22 ») serait lue en UTC et deviendrait le 21 pour un lecteur à
// l'ouest de Greenwich, différente du prérendu.
//
// Le lien est un chemin (briefPath) et non l'URL absolue des données : même
// page, mais il reste sur l'hôte servi — preview, dev, production.
export function BriefLead() {
  const { lang, formatDate } = useI18n()
  const b = BRIEFS[lang]
  if (!b) return null
  const s = BRIEF_STRINGS[lang]
  const href = briefPath(lang, b.date)
  return (
    <section className="brief-lead container" id="brief" aria-labelledby="brief-lead-title">
      <h2 id="brief-lead-title" className="brief-lead__head">
        <span className="brief-lead__label">{s.latest}</span>
        <time className="brief-lead__date" dateTime={b.date}>
          {formatDate(`${b.date}T12:00:00`)}
        </time>
      </h2>
      <div className="brief-lead__body">
        {b.intro && <p className="brief-lead__intro">{b.intro}</p>}
        <ul className="brief-lead__topics">
          {b.topics.map((t) => (
            <li key={t.title} className="brief-lead__topic">
              {t.title}
            </li>
          ))}
        </ul>
        <a className="brief-lead__read" href={href}>
          {s.read}
        </a>
      </div>
    </section>
  )
}
