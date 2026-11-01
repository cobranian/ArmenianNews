import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'
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
// l'adresse vise le mur ou un endroit plus bas (voir `wantsWallNow`).
//
// L'hydratation n'en souffre pas : le prérendu ET le premier rendu client
// produisent la section vide (`ready` vaut false jusqu'au montage), donc le
// HTML cuit et le client concordent. Ne passez pas `ready` à true avant le
// montage : l'écart ferait refaire toute la page à React (voir main.jsx).
const SocialWall = lazy(() => import('./Social.jsx').then((m) => ({ default: m.SocialWall })))

// Une ancre qui n'existe pas encore sur l'accueil est une ancre du mur
// (#facebook, #instagram-…, et toute étagère ajoutée demain : aucune liste à
// tenir). Une ancre située APRÈS la section (#newsletter-email au pied de
// page) charge aussi le mur d'emblée : il la repousserait sinon de plusieurs
// milliers de pixels pendant la lecture. Social.jsx rejoue ensuite l'ancre.
function wantsWallNow(section) {
  const id = decodeURIComponent(window.location.hash.slice(1))
  if (!id) return false
  const el = document.getElementById(id)
  if (!el) return true
  return Boolean(section.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && !section.contains(el)
}

// Un fichier de mur introuvable (un déploiement horaire a remplacé ses
// fichiers pendant la lecture) ne doit coûter que le mur : sans cette
// barrière, l'erreur de chargement démonte TOUTE la page.
class WallBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('[mur réseaux]', error?.message ?? error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function SocialSection() {
  const { t } = useI18n()
  const ref = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const section = ref.current
    if (wantsWallNow(section) || !('IntersectionObserver' in window)) {
      setReady(true)
      return
    }
    // Une ancre posée sans rechargement (lien interne, retour arrière).
    const onHash = () => wantsWallNow(section) && setReady(true)
    window.addEventListener('hashchange', onHash)
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setReady(true)
      },
      { rootMargin: '1200px 0px' },
    )
    io.observe(section)
    return () => {
      io.disconnect()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  // Tant que le mur n'est pas là, la place est réservée (.social-pending,
  // global.css) : son arrivée ne pousse pas le pied de page sous les yeux du
  // lecteur arrivé vite par le lien « Réseaux ».
  const pending = <div className="social-pending" aria-hidden="true" />
  return (
    <section className="section" id="reseaux" ref={ref}>
      <div className="container">
        <SectionHead
          eyebrow="Instagram · Facebook"
          title={t('social.title')}
          subtitle={t('social.subtitle')}
        />
        {ready ? (
          <WallBoundary>
            <Suspense fallback={pending}>
              <SocialWall />
            </Suspense>
          </WallBoundary>
        ) : (
          pending
        )}
      </div>
    </section>
  )
}
