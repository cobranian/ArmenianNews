import { useI18n } from '../i18n.jsx'
import { VIEW_SEO } from '../seo.js'

// La page « Jeux » — squelette : le contenu (échecs, backgammon) arrive aux
// tâches suivantes. Le titre vient de VIEW_SEO, comme celui du <title>.
export function GamesPage() {
  const { lang } = useI18n()
  return (
    <main>
      <div className="container">
        <h1>{VIEW_SEO.games[lang].title}</h1>
      </div>
    </main>
  )
}
