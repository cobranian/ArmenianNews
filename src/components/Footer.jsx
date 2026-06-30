import { useI18n } from '../i18n.jsx'
import { KnotMark } from './Ornament.jsx'

const SOURCES = [
  ['Le Courrier d’Erevan', 'https://courrier.am/fr'],
  ['Public Radio of Armenia', 'https://en.armradio.am/'],
  ['Armenopole', 'https://armenopole.com/armenian/events/switzerland'],
  ['Arméniens de Lausanne', 'https://armeniensdelausanne.ch/#evenements'],
  ['Don Narek', 'https://www.facebook.com/DonNarek'],
]

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="footer">
      <div className="container">
        <KnotMark />
        <div className="footer__title">{t('site.title')}</div>
        <nav className="footer__sources" aria-label={t('footer.sources')}>
          {SOURCES.map(([label, url]) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ))}
        </nav>
        <p className="footer__note">{t('footer.built')}</p>
      </div>
    </footer>
  )
}
