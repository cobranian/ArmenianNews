import { useI18n } from '../i18n.jsx'
import { SITES, pathFor } from '../../sites.config.js'
import { SITE_ID } from '../site.js'
import { VIEW_SEO } from '../seo.js'
import { STATION_FACTS } from '../stations.js'
import { TAB_ORDER } from '../newsSources.js'

// La page « À propos » — qui édite, d'où, avec quelles sources et quelles
// règles. Ajoutée après l'audit SEO du 21 août 2026 : un agrégateur que
// personne ne signe se lit comme une ferme de liens, pour un lecteur comme
// pour un évaluateur qualité. Tout ce qui est affirmé ici est VÉRIFIABLE dans
// le dépôt (les sources dans scripts/sources/, les stations dans
// src/stations.js, les règles dans CLAUDE.md) ; rien n'est un slogan.
//
// Les rédactions sont listées TOUTES, dans l'ordre de TAB_ORDER, avec la
// langue d'interface sous laquelle chacune paraît — pas seulement celles de
// la langue courante : c'est la page qui explique le site entier.

// Page d'accueil de chaque rédaction. Hôtes repris des modules de scrape
// (scripts/sources/<id>.mjs) ; l'ordre d'affichage vient de TAB_ORDER.
const HOMES = {
  armenpress: 'https://armenpress.am',
  armenieinfotv: 'https://armenieinfo.tv',
  courrier: 'https://courrier.am/fr',
  armenews: 'https://www.armenews.com',
  artzakank: 'https://artzakank-echo.ch',
  californiacourier: 'https://www.thecaliforniacourier.com',
  civilnet: 'https://civilnet.am',
  armradio: 'https://en.armradio.am',
  newsam: 'https://news.am',
  asbarez: 'https://asbarez.com',
  armenianweekly: 'https://armenianweekly.com',
  oragark: 'https://www.oragark.com',
}

// Les rédactions dans l'ordre de leur première apparition dans TAB_ORDER
// (fr, puis en, hy, ru), chacune avec les langues sous lesquelles elle paraît.
function newsrooms() {
  const seen = new Map()
  for (const lang of ['fr', 'en', 'hy', 'ru']) {
    for (const id of TAB_ORDER[lang]) {
      if (!seen.has(id)) seen.set(id, [])
      seen.get(id).push(lang)
    }
  }
  return [...seen.entries()]
}

export function AboutPage() {
  const { t, lang } = useI18n()
  const site = SITES[SITE_ID]
  const other = Object.values(SITES).find((s) => s.id !== SITE_ID)
  const rooms = newsrooms()
  const stations = Object.keys(STATION_FACTS).length

  return (
    <main className="viewpage about">
      <div className="container">
        <h1 className="viewpage__title">{t('about.h1')}</h1>
        <p className="viewpage__intro">{t('about.intro')}</p>
      </div>

      <section className="section" id="quoi">
        <div className="container about__body">
          <h2 className="section__title">{t('about.what.title')}</h2>
          <p>{t('about.what.body')}</p>
          <ul className="about__list">
            <li>
              <a href={pathFor(lang, 'home')}>{t('footer.home')}</a> — {t('about.what.news')}
            </li>
            <li>
              <a href={pathFor(lang, 'radio')}>{VIEW_SEO.radio[lang].title}</a> —{' '}
              {t('about.what.radio').replace('{n}', String(stations))}
            </li>
            <li>
              <a href={pathFor(lang, 'agenda')}>{VIEW_SEO.agenda[lang].title}</a> —{' '}
              {t('about.what.agenda')}
            </li>
            <li>{t('about.what.social')}</li>
          </ul>
          <p>
            {t('about.what.sites')}{' '}
            <a href={site.host + '/'}>{site.brand}</a> ·{' '}
            <a href={other.host + '/'} hrefLang={other.pages[0].lang}>
              {other.brand}
            </a>
          </p>
        </div>
      </section>

      <section className="section" id="regles">
        <div className="container about__body">
          <h2 className="section__title">{t('about.rules.title')}</h2>
          <ul className="about__list">
            <li>{t('about.rules.links')}</li>
            <li>{t('about.rules.hourly')}</li>
            <li>{t('about.rules.noads')}</li>
            <li>{t('about.rules.facts')}</li>
          </ul>
        </div>
      </section>

      <section className="section" id="sources">
        <div className="container about__body">
          <h2 className="section__title">{t('about.sources.title')}</h2>
          <p>{t('about.sources.body')}</p>
          <ul className="about__sources">
            {rooms.map(([id, langs]) => (
              <li key={id}>
                <a href={HOMES[id]} rel="noopener noreferrer">
                  {t(`browser.${id}`)}
                </a>
                <span className="about__langs" aria-label={t('about.sources.langs')}>
                  {langs.map((l) => l.toUpperCase()).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          <p>{t('about.sources.other')}</p>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="container about__body">
          <h2 className="section__title">{t('about.contact.title')}</h2>
          <p>
            {t('about.contact.body')} <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
          <p className="viewpage__back">
            <a href={pathFor(lang, 'home')}>{t('footer.home')}</a>
          </p>
        </div>
      </section>

      {/* AboutPage schema.org : la page parle de l'Organization que site-meta
          pose déjà sur toutes les pages (@id …#organization). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: `${VIEW_SEO.about[lang].title} · ${site.brand}`,
            url: site.host + pathFor(lang, 'about'),
            inLanguage: lang,
            about: { '@id': `${site.host}/#organization` },
          }).replace(/</g, '\\u003c'),
        }}
      />
    </main>
  )
}
