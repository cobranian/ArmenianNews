import { useEffect, useState } from 'react'
import { useI18n, LANGS } from '../i18n.jsx'
import { KnotMark } from './Ornament.jsx'

export function Nav() {
  const { t, lang, setLang } = useI18n()
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
    ['#facebook', t('nav.facebook')],
    ['#instagram', t('nav.instagram')],
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
          <div className="lang" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                aria-pressed={lang === l.code}
                title={l.name}
              >
                {l.label}
              </button>
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
