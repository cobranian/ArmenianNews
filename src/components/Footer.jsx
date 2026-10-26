import { useI18n } from '../i18n.jsx'
import { pathFor, briefPath, culturePath, SITES } from '../../sites.config.js'
import { SITE_ID } from '../site.js'
import { BRIEF_STRINGS } from '../briefStrings.js'
import { CULTURE_STRINGS } from '../cultureStrings.js'
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

// Les comptes de la vitrine bâtie (sites.config.js `social`). Icônes tracées
// ici, en currentColor : ni police d'icônes ni requête vers Meta.
const SOCIAL_ICONS = {
  facebook: (
    <path
      fill="currentColor"
      d="M13.4 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z"
    />
  ),
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </g>
  ),
}
const SOCIAL_NAMES = { facebook: 'Facebook', instagram: 'Instagram' }
const social = Object.entries(SITES[SITE_ID]?.social ?? {})

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
    [briefPath(lang), BRIEF_STRINGS[lang].title],
    [culturePath(lang), CULTURE_STRINGS[lang].title],
    [pathFor(lang, 'about'), VIEW_SEO.about[lang].title],
  ]
  return (
    <footer className="footer">
      <div className="container">
        <KnotMark />
        <div className="footer__title">{t('site.title')}</div>
        {social.length > 0 && (
          <ul className="footer__social">
            {social.map(([platform, url]) => (
              <li key={platform}>
                <a href={url} rel="noopener noreferrer" aria-label={SOCIAL_NAMES[platform]} title={SOCIAL_NAMES[platform]}>
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                    {SOCIAL_ICONS[platform]}
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        )}
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
