import { useEffect, useState } from 'react'
import { useI18n, LANGS } from '../i18n.jsx'
import { orderedLangs } from '../site.js'
import { LANG_URL } from '../../sites.config.js'
import { KnotMark } from './Ornament.jsx'

export function Nav() {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark',
  )

  // Apply + persist the day/night theme (set on <html> so CSS variables cascade).
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const links = [
    ['#direct', t('nav.radio')],
    ['#actualites', t('nav.news')],
    ['#agenda', t('nav.agenda')],
    ['#reseaux', t('nav.social')],
  ]

  return (
    <nav className="nav">
      <div className="container nav__inner">
        <a className="nav__brand" href="#top" aria-label={t('site.title')}>
          <KnotMark />
          <span>{t('site.title')}</span>
        </a>

        <ul className={`nav__links ${open ? 'is-open' : ''}`}>
          {links.map(([href, label]) => (
            <li key={href}>
              <a href={href} onClick={() => setOpen(false)}>
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="theme-toggle"
            onClick={() => setTheme((c) => (c === 'dark' ? 'light' : 'dark'))}
            aria-pressed={theme === 'light'}
            aria-label={theme === 'dark' ? 'Mode jour' : 'Mode nuit'}
            title={theme === 'dark' ? 'Mode jour' : 'Mode nuit'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {/* Chaque langue a son URL — le sélecteur navigue, il ne bascule pas
              un état. Ce sont donc quatre liens en dur dans le HTML de chaque
              page : le maillage réciproque entre les deux domaines, que Google
              attend en plus des hreflang. L'ordre vient du domaine (voir
              orderedLangs), pas de la langue affichée : la barre reste stable
              quand on navigue à l'intérieur du .org. */}
          <div className="lang" role="group" aria-label="Language">
            {orderedLangs(LANGS).map((l) => (
              <a
                key={l.code}
                href={LANG_URL[l.code]}
                hrefLang={l.code}
                aria-current={lang === l.code ? 'page' : undefined}
                title={l.name}
              >
                {l.label}
              </a>
            ))}
          </div>
          <button
            className="nav__toggle"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>
    </nav>
  )
}
