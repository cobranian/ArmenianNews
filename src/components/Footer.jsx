import { useI18n } from '../i18n.jsx'
import { KnotMark } from './Ornament.jsx'

const SOURCES = [
  ['Le Courrier d’Erevan', 'https://courrier.am/fr'],
  ['Public Radio of Armenia', 'https://en.armradio.am/'],
  ['Artzakank', 'https://artzakank-echo.ch/'],
  ['ArménieInfo.tv', 'https://armenieinfo.tv/'],
  ['Armenopole', 'https://armenopole.com/armenian/events/switzerland'],
  ['Arméniens de Lausanne', 'https://armeniensdelausanne.ch/#evenements'],
  ['École arménienne de Lausanne', 'https://ecolearmeniennedelausanne.ch/'],
  ['Centre arménien de Genève', 'https://www.centre-armenien-geneve.ch/'],
  ['Don Narek', 'https://www.facebook.com/DonNarek'],
]

const CONTACT = 'contact@armenieinfo.ch'

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="footer">
      <div className="container">
        <KnotMark />
        <div className="footer__title">{t('site.title')}</div>
        <nav className="footer__sources" aria-label={t('footer.sources')}>
          {SOURCES.map(([label, url]) => (
            <a key={url} href={url} rel="noopener noreferrer">
              {label}
            </a>
          ))}
        </nav>
        {/* The one thing here you can act on, so it carries the apricot — the
            sources are dim, the colophon fainter still. */}
        <p className="footer__contact">
          {t('footer.write')}{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
        <p className="footer__note">{t('footer.built')}</p>
      </div>
    </footer>
  )
}
