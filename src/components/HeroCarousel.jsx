import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import news from '../data/news.json'

// Each slide auto-advances after this long; the tuning-dial sweep is synced to it.
const DURATION = 6000

// Build the "À la une" lead set: the picture-lead of each Courrier section
// interleaved with the freshest ArmRadio dispatches, so print (FR) and radio
// (EN) alternate. Deduped by URL and capped so the dial stays legible.
function buildLead(t) {
  const courrier = (news.sections || [])
    .map((s) => {
      const a = (s.articles || []).find((x) => x.image) || (s.articles || [])[0]
      if (!a) return null
      return {
        source: 'courrier',
        outlet: 'Courrier',
        lang: 'FR',
        category: t(`sections.${s.sectionKey}`),
        title: a.title,
        url: a.url,
        image: a.image || null,
      }
    })
    .filter(Boolean)

  const armradio = (news.armradio || []).map((a) => ({
    source: 'armradio',
    outlet: 'ArmRadio',
    lang: 'EN',
    category: a.category || null,
    title: a.title,
    url: a.url,
    image: a.image || null,
  }))

  const woven = []
  for (let i = 0; i < Math.max(courrier.length, armradio.length); i++) {
    if (courrier[i]) woven.push(courrier[i])
    if (armradio[i]) woven.push(armradio[i])
  }
  const seen = new Set()
  return woven.filter((s) => s.url && !seen.has(s.url) && seen.add(s.url)).slice(0, 7)
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

// A faint broadcast waveform, drawn behind image-less ArmRadio bulletins so a
// radio dispatch reads as a radio dispatch rather than a blank card.
function Waveform() {
  const bars = 48
  return (
    <svg className="lead__wave" viewBox="0 0 480 120" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        // deterministic pseudo-waveform — no Math.random so it never jumps
        const h = 12 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 92
        return <rect key={i} x={i * 10 + 2} y={(120 - h) / 2} width="4" height={h} rx="2" />
      })}
    </svg>
  )
}

export function HeroCarousel() {
  const { t, lang } = useI18n()
  const slides = useMemo(() => buildLead(t), [lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const n = slides.length

  const [index, setIndex] = useState(0)
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const reduced = usePrefersReducedMotion()

  const fillRef = useRef(null)
  const touchX = useRef(null)

  const paused = hover || focus || hidden || userPaused
  const auto = !paused && !reduced && n > 1

  // Pause when the tab is backgrounded (no point advancing off-screen).
  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  // rAF-driven auto-advance. Re-arms on every index/pause change, so hovering
  // freezes the sweep where it is and the next slide starts fresh.
  useEffect(() => {
    if (!auto) return // paused: leave the sweep frozen where it is
    if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)'
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / DURATION, 1)
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`
      if (p >= 1) {
        setIndex((i) => (i + 1) % n)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [index, auto, n, reduced])

  if (!n) return null

  const go = (i) => setIndex((i + n) % n)
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      go(index + 1)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      go(index - 1)
      e.preventDefault()
    }
  }
  const onTouchStart = (e) => (touchX.current = e.touches[0]?.clientX ?? null)
  const onTouchEnd = (e) => {
    if (touchX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current
    if (Math.abs(dx) > 44) go(index + (dx < 0 ? 1 : -1))
    touchX.current = null
  }

  return (
    <section className="lead" aria-label={t('lead.carousel')}>
      <div className="container">
        <div
          className="lead__frame reveal"
          role="group"
          aria-roledescription="carousel"
          aria-label={t('lead.carousel')}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setFocus(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false)
          }}
          onKeyDown={onKeyDown}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="lead__stage" aria-live={auto ? 'off' : 'polite'}>
            {slides.map((s, i) => {
              const active = i === index
              const badge = [s.category, s.lang].filter(Boolean).join(' · ')
              return (
                <a
                  key={s.url}
                  className={`lead__slide lead__slide--${s.source} ${
                    s.image ? 'is-photo' : 'is-bulletin'
                  } ${active ? 'is-active' : ''}`}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-hidden={active ? undefined : true}
                  tabIndex={active ? undefined : -1}
                  aria-roledescription="slide"
                  aria-label={`${s.outlet} — ${s.title}`}
                >
                  <div className="lead__media">
                    {s.image ? (
                      // no Referer: ArmRadio's CDN 403s hotlinked images otherwise
                      <img
                        src={s.image}
                        alt=""
                        loading={i === 0 ? 'eager' : 'lazy'}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Waveform />
                    )}
                  </div>
                  <div className="lead__copy">
                    <div className="lead__meta">
                      <span className="lead__outlet">{s.outlet}</span>
                      {s.source === 'armradio' && (
                        <span className="lead__live">
                          <span className="lead__live-dot" />
                          {t('lead.onair')}
                        </span>
                      )}
                      {badge && <span className="lead__badge">{badge}</span>}
                    </div>
                    <h3 className="lead__title">{s.title}</h3>
                    <span className="lead__more">{t('news.readmore')}</span>
                  </div>
                </a>
              )
            })}
          </div>

          <div className="lead__controls">
            <button
              className="lead__btn"
              type="button"
              onClick={() => go(index - 1)}
              aria-label={t('news.prev')}
            >
              ‹
            </button>
            <button
              className="lead__btn lead__btn--play"
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-label={userPaused ? t('lead.play') : t('lead.pause')}
              aria-pressed={userPaused}
            >
              {userPaused ? '►' : '❚❚'}
            </button>
            <button
              className="lead__btn"
              type="button"
              onClick={() => go(index + 1)}
              aria-label={t('news.next')}
            >
              ›
            </button>
          </div>

          {/* Signature: an analog tuning dial. Each dispatch is a station on a
              frequency ruler; the needle tunes to the active one and the sweep
              beneath counts down to the next auto-advance. */}
          <div className="lead__dial">
            <div className="lead__ruler" aria-hidden="true" />
            <div
              className="lead__needle"
              aria-hidden="true"
              style={{ left: `${((index + 0.5) / n) * 100}%` }}
            />
            <div className="lead__stations">
              {slides.map((s, i) => (
                <button
                  key={s.url}
                  type="button"
                  className={`lead__station ${i === index ? 'is-active' : ''} lead__station--${s.source}`}
                  onClick={() => go(i)}
                  aria-current={i === index ? 'true' : undefined}
                  aria-label={`${t('lead.tune')} ${s.outlet} — ${s.title}`}
                >
                  <span className="lead__station-tick" aria-hidden="true" />
                  <span className="lead__station-label" aria-hidden="true">
                    {s.outlet === 'ArmRadio' ? 'AR' : 'CE'}
                    <b>{String(i + 1).padStart(2, '0')}</b>
                  </span>
                </button>
              ))}
            </div>
            <div className="lead__sweep" aria-hidden="true">
              <span ref={fillRef} className="lead__sweep-fill" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
