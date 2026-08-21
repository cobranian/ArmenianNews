import { useI18n } from '../i18n.jsx'
import { pathFor } from '../../sites.config.js'
import { VIEW_SEO } from '../seo.js'
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
]

const CONTACT = 'contact@armenieinfo.ch'

export function Footer() {
  const { t, lang } = useI18n()
  // Les trois pages du site, dans la langue de la page — sur les douze pages.
  // Avant l'audit du 21 août 2026, l'accueil portait 264 liens sortants pour
  // DEUX liens vers ses propres pages piliers, et /radio/ ne liait jamais
  // /agenda/ : le PageRank interne restait sur l'accueil. Les libellés sont
  // ceux des <title> des vues (VIEW_SEO), pour que l'ancre dise ce que la page
  // cible annonce à Google.
  const pages = [
    [pathFor(lang, 'home'), t('footer.home')],
    [pathFor(lang, 'radio'), VIEW_SEO.radio[lang].title],
    [pathFor(lang, 'agenda'), VIEW_SEO.agenda[lang].title],
  ]
  return (
    <footer className="footer">
      <div className="container">
        <KnotMark />
        <div className="footer__title">{t('site.title')}</div>
        <nav className="footer__pages" aria-label={t('footer.pages')}>
          {pages.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
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

        {/* Politique de confidentialité — un <details>, délibérément.
            Repliée, elle n'encombre pas le pied de page ; dépliée, elle reste
            sur la même URL. Le contenu est dans le DOM même fermé, donc il
            part dans le HTML prérendu et se lit sans JavaScript — ce qui
            compte pour une information légalement due.
            L'ancre #confidentialite la rend partageable par lien. */}
        <details className="privacy" id="confidentialite">
          <summary>{t('privacy.title')}</summary>
          <div className="privacy__body">
            <p>{t('privacy.intro')}</p>

            <h3>{t('privacy.analytics.title')}</h3>
            <p>{t('privacy.analytics.body')}</p>
            <p>{t('privacy.analytics.optout')}</p>

            <h3>{t('privacy.storage.title')}</h3>
            <p>{t('privacy.storage.body')}</p>

            <h3>{t('privacy.content.title')}</h3>
            <p>{t('privacy.content.body')}</p>

            <h3>{t('privacy.rights.title')}</h3>
            <p>{t('privacy.rights.body')}</p>

            <p>
              {t('privacy.contact')} <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
            </p>
          </div>
        </details>
      </div>
    </footer>
  )
}
