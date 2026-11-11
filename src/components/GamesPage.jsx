import { useI18n } from '../i18n.jsx'
import { VIEW_SEO } from '../seo.js'
import { GAMES } from '../games.js'

// La page « Jeux » : un bloc par jeu (vignette, angle arménien, « Jouer »,
// règles repliées). Elle porte le style du site ; les jeux, servis à part sous
// /play/<id>/ (hors du bundle — rien n'en est importé ici), gardent le leur.
//
// Le lien transmet la langue de la page (`?lang=`) : le jeu s'ouvre dans la
// même langue que l'onglet qui l'a lancé. Le clic est compté par GA
// (`jeu_ouvert`) ; `gtag` est absent au prérendu et sans consentement, d'où `?.`.
//
// Rien ici ne dépend de l'heure, du thème ni de l'écran : le HTML prérendu est
// hydraté tel quel (voir CLAUDE.md).
export function GamesPage() {
  const { t, lang } = useI18n()

  return (
    <main className="viewpage games">
      <div className="container">
        <h1 className="viewpage__title">{VIEW_SEO.games[lang].title}</h1>
      </div>

      {GAMES.map((g) => {
        const txt = g.text[lang] ?? g.text.fr
        const href = `${g.path}?lang=${lang}`
        const titleId = `jeu-${g.id}`
        const open = () => window.gtag?.('event', 'jeu_ouvert', { jeu: g.id })
        return (
          <section className="section game" key={g.id} aria-labelledby={titleId}>
            <div className="container game__inner">
              {/* La vignette mène au jeu, comme « Jouer » ; retirée du parcours
                  clavier et de l'arbre d'accessibilité pour ne pas doubler le
                  lien. Pas de chargement différé : la première est au premier
                  écran, et il n'y en a que deux. */}
              <a className="game__shot" href={href} onClick={open} tabIndex={-1} aria-hidden="true">
                {/* Vignette de la langue de la page : le nom du jeu y est écrit. */}
                <img src={`/play/vignettes/${lang}/${g.id}.png`} width="640" height="400" alt="" />
              </a>
              <div className="game__body">
                <h2 className="game__title" id={titleId}>
                  {txt.title}
                </h2>
                {txt.intro.map((p, i) => (
                  <p className="game__intro" key={i}>
                    {p.text}
                  </p>
                ))}
                <p className="game__actions">
                  <a className="btn-gold game__play" href={href} onClick={open} aria-describedby={titleId}>
                    {t('games.play')} <span aria-hidden="true">→</span>
                  </a>
                </p>
                <details className="game__rules">
                  <summary>{t('games.rules')}</summary>
                  <ol>
                    {txt.rules.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ol>
                </details>
              </div>
            </div>
          </section>
        )
      })}
    </main>
  )
}
