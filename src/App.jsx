import { useReveal } from './hooks/useReveal.js'
import { useI18n } from './i18n.jsx'
import { Nav } from './components/Nav.jsx'
import { Hero } from './components/Hero.jsx'
import { Radio } from './components/Radio.jsx'
import { News } from './components/News.jsx'
import { Agenda } from './components/Agenda.jsx'
import { Social } from './components/Social.jsx'
import { Footer } from './components/Footer.jsx'

export default function App() {
  // re-run reveal observer when language changes (content swaps)
  const { lang } = useI18n()
  useReveal(lang)

  return (
    <div key={lang}>
      <Nav />
      <Hero />
      <main>
        <Radio />
        <News />
        <Agenda />
        <Social />
      </main>
      <Footer />
    </div>
  )
}
