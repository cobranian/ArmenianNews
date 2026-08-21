import { useEffect } from 'react'
import { useReveal } from './hooks/useReveal.js'
import { useI18n } from './i18n.jsx'
import { SITE_ID } from './site.js'
import { viewFromPath } from '../sites.config.js'
import { Nav } from './components/Nav.jsx'
import { Hero } from './components/Hero.jsx'
import { Radio } from './components/Radio.jsx'
import { News } from './components/News.jsx'
import { Agenda } from './components/Agenda.jsx'
import { Social } from './components/Social.jsx'
import { RadioPage } from './components/RadioPage.jsx'
import { AgendaPage } from './components/AgendaPage.jsx'
import { AboutPage } from './components/AboutPage.jsx'
import { Footer } from './components/Footer.jsx'

// La vue vient de l'URL, comme la langue — lue une fois au montage. Il n'y a pas
// de routeur client : chaque vue est un fichier HTML distinct, servi par
// Firebase, exactement comme /hy/ et /ru/. Naviguer entre les vues est une
// navigation de document, pas un changement d'état.
export default function App() {
  const { lang } = useI18n()
  const view = viewFromPath(SITE_ID, window.location.pathname)
  useReveal(lang)

  // Une arrivée à froid sur /#instagram atterrit en haut : le navigateur cherche
  // la cible pendant que #root est encore vide, renonce, et ne réessaie jamais.
  // On rejoue le hash une fois les sections montées.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }, [])

  return (
    // `data-view` n'est pas décoratif : c'est ce que scripts/prerender.mjs lit
    // pour refuser de cuire l'accueil dans le fichier d'une page de vue. Voir la
    // garde de la Task 6, jumelle de celle qui existe déjà sur <html lang>.
    <div key={`${lang}-${view}`} data-view={view}>
      <Nav view={view} />
      {view === 'radio' ? (
        <RadioPage />
      ) : view === 'agenda' ? (
        <AgendaPage />
      ) : view === 'about' ? (
        <AboutPage />
      ) : (
        <>
          <Hero />
          <main>
            <Radio />
            <News />
            <Agenda />
            <Social />
          </main>
        </>
      )}
      <Footer />
    </div>
  )
}
