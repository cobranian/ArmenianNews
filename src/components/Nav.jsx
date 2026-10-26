import { useEffect, useState } from 'react'
import { useI18n, LANGS } from '../i18n.jsx'
import { orderedLangs, SITE_ID } from '../site.js'
import { LANG_SWITCH_LABEL, langPath, pathFor, urlFor, briefPath, culturePath } from '../../sites.config.js'
import { BRIEF_STRINGS } from '../briefStrings.js'
import { CULTURE_STRINGS } from '../cultureStrings.js'
import { KnotMark } from './Ornament.jsx'
import { HYDRATING, PRERENDERING } from '../renderClock.js'

export function Nav({ view = 'home' }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  // Sélecteur de langue replié (≤900px, voir .lang-fold dans global.css) :
  // fermé au prérendu comme à l'hydratation, il ne s'ouvre qu'au toucher.
  const [langOpen, setLangOpen] = useState(false)
  const current = LANGS.find((l) => l.code === lang)
  // Le premier rendu d'une page hydratée doit reproduire le HTML cuit, et le
  // prérendu est fait en thème SOMBRE (aucun localStorage dans le navigateur du
  // build). Lire ici le thème du lecteur ferait diverger le bouton (☀/☾,
  // aria-pressed) et React referait toute la page (src/renderClock.js). Le
  // vrai thème — déjà appliqué par theme-init.js avant le premier affichage,
  // donc sans flash — est lu au montage.
  const [theme, setTheme] = useState(() =>
    HYDRATING || PRERENDERING ? 'dark' : document.documentElement.dataset.theme || 'dark',
  )
  useEffect(() => {
    const t = document.documentElement.dataset.theme
    if (t === 'light' || t === 'dark') setTheme(t)
  }, [])

  // Appliquer + enregistrer AU CLIC, pas dans un effet sur `theme` : un effet
  // écrirait le « sombre » du premier rendu dans <html> et dans localStorage
  // avant que le montage n'ait relu le thème du lecteur — et l'effacerait.
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* ignore */
    }
    setTheme(next)
  }

  // Hors de l'accueil, les ancres ne désignent rien : /radio n'a ni #actualites
  // ni #agenda. Elles doivent donc porter le chemin de l'accueil de LA LANGUE
  // COURANTE — '/' sur le .ch, '/hy/' sur la page arménienne. Sans cela les
  // pages de vue ont une nav morte, et une page sans lien entrant interne ne
  // circule pas.
  const home = view === 'home' ? '' : langPath(SITE_ID, lang)
  // Sur l'accueil, « En direct » et « Agenda » font défiler vers leur section
  // (qui porte elle-même le lien vers la page pilier). Hors de l'accueil, ils
  // mènent à la PAGE pilier de la langue courante (/radio/, /agenda/), pas à
  // une ancre de l'accueil : c'est là qu'est la matière, et c'est ce qui relie
  // radio ⇄ agenda entre elles — l'audit du 21 août 2026 avait mesuré qu'aucune
  // des deux ne liait l'autre.
  const links = [
    [view === 'home' ? '#direct' : pathFor(lang, 'radio'), t('nav.radio')],
    [`${home}#actualites`, t('nav.news')],
    [view === 'home' ? '#agenda' : pathFor(lang, 'agenda'), t('nav.agenda')],
    [briefPath(lang), BRIEF_STRINGS[lang].nav],
    [culturePath(lang), CULTURE_STRINGS[lang].nav],
    [`${home}#reseaux`, t('nav.social')],
  ]

  return (
    <nav className="nav">
      <div className="container nav__inner">
        {/* `home` EST déjà le chemin de l'accueil hors de l'accueil, et '' sur
            l'accueil : le recalculer dirait la même chose deux fois. */}
        <a className="nav__brand" href={home || '#top'} aria-label={t('site.title')}>
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

        <div className="nav__tools">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-pressed={theme === 'light'}
            aria-label={theme === 'dark' ? 'Mode jour' : 'Mode nuit'}
            title={theme === 'dark' ? 'Mode jour' : 'Mode nuit'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {/* Chaque langue a son URL — le sélecteur navigue, il ne bascule pas
              un état. Ce sont donc des liens en dur (un par langue) dans le HTML de chaque
              page : le maillage réciproque entre les deux domaines, que Google
              attend en plus des hreflang. L'ordre vient du domaine (voir
              orderedLangs), pas de la langue affichée : la barre reste stable
              quand on navigue à l'intérieur du .org.

              Six pastilles ne tiennent pas à côté de la marque, du thème et
              du menu sur un téléphone (mesuré : 427px de large à 360 et 390).
              Sous 900px (pourquoi 900 : global.css, .lang-fold), le bouton
              ne montre que la langue courante et déplie les six liens dans
              une bande sous la barre, comme le menu. Les
              liens restent dans le HTML de chaque page, repli ou pas : le
              maillage entre langues ne dépend pas du toucher. Sur grand
              écran, les deux enveloppes sont en `display: contents` — la
              barre est celle d'avant. */}
          <div className={`lang-fold${langOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="lang-fold__toggle"
              aria-expanded={langOpen}
              aria-controls="nav-lang"
              aria-label={`${LANG_SWITCH_LABEL[lang]} (${current.label})`}
              onClick={() => {
                setLangOpen((o) => !o)
                setOpen(false)
              }}
            >
              <span lang={lang}>{current.label}</span>
            </button>
            <div className="lang-fold__panel" id="nav-lang">
              <div className="lang" role="group" aria-label={LANG_SWITCH_LABEL[lang]}>
                {orderedLangs(LANGS).map((l) => (
                  // `lang` et `hrefLang` ne disent pas la même chose et les deux
                  // sont justes : hrefLang qualifie la page VISÉE, lang l'écriture
                  // du libellé lui-même. « ՀԱՅ » est de l'arménien et « РУ » du
                  // russe sur toutes les pages, y compris la française. C'est ce
                  // qui permet à global.css de rattraper leur taille optique, et
                  // ce qui fait prononcer ces deux libellés correctement par un
                  // lecteur d'écran au lieu de les épeler en français.
                  <a
                    key={l.code}
                    // La MÊME vue dans l'autre langue (/radio/ → /hy/radio/,
                    // /agenda/ → /events/), pas son accueil — comme le font déjà
                    // les pages statiques (brève, Culture : langHrefsFor). Toutes
                    // les vues existent dans chaque langue, donc jamais de 404.
                    href={urlFor(l.code, view)}
                    // L'ancre (#agenda, #reseaux…) suit aussi : les id de section
                    // sont les mêmes dans toutes les langues. Ajoutée au clic et
                    // non au rendu, pour que le href cuit par le prérendu reste
                    // identique à celui de l'hydratation. On part du href COURANT,
                    // pas de urlFor : gtag l'a déjà décoré au mousedown (?_gl=…,
                    // le lien inter-domaines de GA), et le recomposer l'effacerait.
                    onClick={(e) => {
                      const a = e.currentTarget
                      if (location.hash) a.href = a.href.split('#')[0] + location.hash
                    }}
                    hrefLang={l.code}
                    lang={l.code}
                    aria-current={lang === l.code ? 'page' : undefined}
                    title={l.name}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <button
            className="nav__toggle"
            onClick={() => {
              setOpen((o) => !o)
              setLangOpen(false)
            }}
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
