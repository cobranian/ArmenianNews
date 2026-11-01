import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'

// Le mur Instagram · Facebook arrive APRÈS l'affichage de l'accueil (1er nov.
// 2026). Il pesait 122 ko sur les 285 ko du HTML prérendu, et ses données, ses
// cartes et ses images dans le script principal — pour une section tout en bas
// de page, sans valeur de référencement (des vignettes qui renvoient ailleurs).
//
// Ce qui reste dans la page cuite : la section, son titre et l'ancre #reseaux
// (lien « Réseaux » de la barre du haut). Le corps (Social.jsx) est un fichier
// à part, demandé quand le lecteur approche de la section — ou tout de suite si
// l'adresse vise le mur (#facebook, #instagram… depuis les cartes de liens).
//
// L'hydratation n'en souffre pas : le prérendu ET le premier rendu client
// produisent la section vide (`ready` vaut false jusqu'au montage), donc le
// HTML cuit et le client concordent. Ne passez pas `ready` à true avant le
// montage : l'écart ferait refaire toute la page à React (voir main.jsx).
const SocialWall = lazy(() => import('./Social.jsx').then((m) => ({ default: m.SocialWall })))

// Les ancres que pose le mur lui-même : y arriver doit le charger sans attendre.
const WALL_ANCHOR = /^#(facebook|instagram[\w-]*)$/

export function SocialSection() {
  const { t } = useI18n()
  const ref = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (WALL_ANCHOR.test(window.location.hash) || !('IntersectionObserver' in window)) {
      setReady(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true)
          io.disconnect()
        }
      },
      { rootMargin: '1200px 0px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  return (
    <section className="section" id="reseaux" ref={ref}>
      <div className="container">
        <SectionHead
          eyebrow="Instagram · Facebook"
          title={t('social.title')}
          subtitle={t('social.subtitle')}
        />
        {ready && (
          <Suspense fallback={null}>
            <SocialWall />
          </Suspense>
        )}
      </div>
    </section>
  )
}
