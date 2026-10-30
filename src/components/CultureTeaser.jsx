import { useEffect, useRef, useState } from 'react'
import TEASER from 'virtual:culture-teaser'
import { useI18n } from '../i18n.jsx'
import { culturePath, cultureImagePath } from '../../sites.config.js'
import { CULTURE_STRINGS } from '../cultureStrings.js'

// Le carrousel Culture de l'accueil : un article à la fois, image en grand,
// flèches à l'écran, flèches du clavier (quand le focus est dans le
// carrousel, jamais sur toute la page) et glissement au doigt. La boucle est
// voulue : après le dernier revient le premier.
//
// Les articles viennent du module virtuel de vite.config.js. Rien à afficher
// → rien de rendu. Toutes les diapositives sont dans le DOM (le prérendu les
// cuit, Google lit leurs liens) ; seules les inactives sont `inert`, donc
// hors du parcours clavier et de l'arbre d'accessibilité.
//
// `inert` est posé par la PROPRIÉTÉ DOM (effet sur l'index), pas par un
// attribut JSX : React 18 ne connaît pas l'attribut et React 19 en fait un
// booléen — une chaîne vide y vaut faux, et les diapositives cachées
// reviendraient dans le parcours clavier sans un mot. La propriété se reflète
// en attribut, que le prérendu cuit.

// Distance dans la boucle : la dernière diapositive est voisine de la première.
const ringDistance = (a, b, n) => Math.min((a - b + n) % n, (b - a + n) % n)
export function CultureTeaser() {
  const { lang } = useI18n()
  const items = TEASER[lang] ?? []
  const [index, setIndex] = useState(0)
  const [broken, setBroken] = useState({})
  // Tant que personne ne s'est approché du carrousel, toutes les images
  // restent différées (loading="lazy") : la section est sous le pli. Dès un
  // premier signe d'intérêt, la diapositive affichée et ses deux voisines
  // passent en chargement immédiat — sinon chaque image ne partirait qu'en
  // glissant à l'écran, et le cadre défilerait vide.
  const [warm, setWarm] = useState(false)
  const touch = useRef(null)
  const region = useRef(null)
  const track = useRef(null)
  useEffect(() => {
    const slides = track.current?.children ?? []
    for (let i = 0; i < slides.length; i++) slides[i].inert = i !== index
  }, [index, items.length])
  if (!items.length) return null
  const s = CULTURE_STRINGS[lang]
  const n = items.length
  const go = (d) => {
    // Le focus est sur un lien de la diapositive qui s'en va : elle va devenir
    // inert, le navigateur lâcherait le focus sur <body> et les flèches
    // suivantes n'atteindraient plus le carrousel. On le rend au carrousel.
    // Seulement depuis une DIAPOSITIVE : sur les boutons ‹ ›, le focus doit
    // rester où il est, pour qu'un second Entrée avance encore.
    if (track.current?.contains(document.activeElement)) region.current?.focus()
    setWarm(true)
    setIndex((x) => (x + d + n) % n)
  }
  const warmUp = () => setWarm(true)

  const onKeyDown = (e) => {
    if (n < 2 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (e.key === 'ArrowLeft') go(-1)
    else if (e.key === 'ArrowRight') go(1)
    else return
    e.preventDefault()
  }
  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const start = touch.current
    touch.current = null
    if (!start || n < 2) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    // Un geste surtout vertical fait défiler la page : on le laisse passer.
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(t.clientY - start.y)) go(dx < 0 ? 1 : -1)
  }

  return (
    <section className="culture-teaser container" id="culture" aria-labelledby="culture-teaser-title">
      <div className="culture-teaser__head">
        <h2 id="culture-teaser-title" className="culture-teaser__title">
          {s.teaser}
        </h2>
        <a className="culture-teaser__all" href={culturePath(lang)}>
          {s.all} →
        </a>
      </div>
      <div
        ref={region}
        className="cc"
        role="region"
        aria-roledescription="carousel"
        aria-label={s.carousel}
        tabIndex={n > 1 ? 0 : undefined}
        onKeyDown={onKeyDown}
        onFocus={warmUp}
        onPointerEnter={warmUp}
        onTouchStart={(e) => {
          warmUp()
          onTouchStart(e)
        }}
        onTouchEnd={onTouchEnd}
      >
        <div className="cc__viewport">
          <ul ref={track} className="cc__track" style={{ transform: `translateX(${-index * 100}%)` }}>
            {items.map((x, i) => {
              const href = culturePath(lang, x.slug)
              const active = i === index
              return (
                <li
                  key={x.slug}
                  className="cc__slide"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} / ${n}`}
                  aria-hidden={active ? undefined : 'true'}
                >
                  <a className="cc__media" href={href} tabIndex={-1} aria-hidden="true">
                    {x.image && !broken[x.slug] ? (
                      <img
                        loading={warm && ringDistance(i, index, n) <= 1 ? 'eager' : 'lazy'}
                        decoding="async"
                        src={cultureImagePath(x.slug, 'webp')}
                        alt=""
                        // Rognée en 4:3 : un portrait garde le haut
                        // (scripts/lib/culture-focus.mjs, calculé au build).
                        style={x.focus == null ? undefined : { objectPosition: `50% ${Math.round(x.focus * 100)}%` }}
                        onError={() => setBroken((b) => ({ ...b, [x.slug]: true }))}
                      />
                    ) : (
                      <span className="cc__motif" />
                    )}
                  </a>
                  <div className="cc__text">
                    <h3 className="cc__title">
                      <a href={href}>{x.title}</a>
                    </h3>
                    <p className="cc__desc">{x.description}</p>
                    <a className="cc__read" href={href}>
                      {s.read}
                    </a>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        {n > 1 && (
          <div className="cc__controls">
            <button type="button" className="shelf__arrow" onClick={() => go(-1)} aria-label={s.prev}>
              ‹
            </button>
            <p className="cc__count" aria-live="polite">
              {index + 1} / {n}
            </p>
            <button type="button" className="shelf__arrow" onClick={() => go(1)} aria-label={s.next}>
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
