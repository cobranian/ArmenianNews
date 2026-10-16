import TEASER from 'virtual:culture-teaser'
import { useI18n } from '../i18n.jsx'
import { culturePath } from '../../sites.config.js'
import { CULTURE_STRINGS } from '../cultureStrings.js'

// Les 3 derniers articles Culture de la langue (module virtuel de
// vite.config.js). Rien à afficher → rien de rendu : pas de section vide.
export function CultureTeaser() {
  const { lang } = useI18n()
  const items = TEASER[lang] ?? []
  if (!items.length) return null
  const s = CULTURE_STRINGS[lang]
  return (
    <section className="culture-teaser container" id="culture" aria-labelledby="culture-teaser-title">
      <h2 id="culture-teaser-title" className="culture-teaser__title">
        {s.teaser}
      </h2>
      <ul className="culture-list">
        {items.map((x) => (
          <li key={x.slug} className="culture-card">
            <a href={culturePath(lang, x.slug)}>
              <span className="culture-card__title">{x.title}</span>
              <span className="culture-card__desc">{x.description}</span>
            </a>
          </li>
        ))}
      </ul>
      <a className="culture-teaser__all" href={culturePath(lang)}>
        {s.all} →
      </a>
    </section>
  )
}
