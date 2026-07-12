import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { SectionHead } from './SectionHead.jsx'

/* Live broadcast console — a native HTML5 <audio> player for Public Radio of
 * Armenia. We deliberately do NOT embed player.armradio.am (an old jQuery/jPlayer
 * widget that ships Google Analytics, third-party cookies and a Cloudflare
 * challenge, and can't be restyled). Instead we stream the same Shoutcast mounts
 * directly — HTTPS only, no third-party JS, fully on-brand.
 *
 * Stream URLs come from player.armradio.am/index.php?c=all. The upstream also
 * lists "Yezidi Radio" on http://46.182.174.131:8002/music — deliberately left
 * out: a plain-HTTP stream would be blocked as mixed content on our HTTPS site. */
const STATIONS = [
  { id: 'public', stream: 'https://eu1.stream4cast.com/proxy/publicra/stream' },
  { id: 'im', stream: 'https://eu1.stream4cast.com/proxy/aamiry02/stream' },
  { id: 'arevik', stream: 'https://eu1.stream4cast.com/proxy/aamiryan/stream' },
  { id: 'culture', stream: 'https://eu1.stream4cast.com/proxy/aamiry01/stream' },
]

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

// A live Yerevan clock — "broadcasting from Erevan, right now".
function useYerevanClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = () => {
      try {
        setTime(
          new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Asia/Yerevan',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date()),
        )
      } catch {
        setTime('')
      }
    }
    fmt()
    const id = setInterval(fmt, 15000)
    return () => clearInterval(id)
  }, [])
  return time
}

export function Radio() {
  const { t } = useI18n()
  const time = useYerevanClock()

  const audioRef = useRef(null)
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(0)

  const [stationId, setStationId] = useState('public')
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [volume, setVolume] = useState(0.85)

  const station = STATIONS.find((s) => s.id === stationId) || STATIONS[0]

  // --- Web Audio wiring (built once, on first user gesture) ---
  function ensureGraph() {
    if (analyserRef.current || !audioRef.current) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      const ctx = new AC()
      const source = ctx.createMediaElementSource(audioRef.current)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.82
      source.connect(analyser)
      analyser.connect(ctx.destination)
      ctxRef.current = ctx
      analyserRef.current = analyser
    } catch {
      /* Web Audio unavailable — audio still plays through the element. */
    }
  }

  async function play() {
    const audio = audioRef.current
    if (!audio) return
    setError(false)
    setLoading(true)
    if (audio.src !== station.stream) audio.src = station.stream
    ensureGraph()
    try {
      if (ctxRef.current?.state === 'suspended') await ctxRef.current.resume()
      await audio.play()
    } catch {
      setLoading(false)
      setError(true)
    }
  }

  function pause() {
    audioRef.current?.pause()
  }

  function toggle() {
    if (playing) pause()
    else play()
  }

  function pick(id) {
    if (id === stationId) return
    setStationId(id)
    const audio = audioRef.current
    if (!audio) return
    const next = STATIONS.find((s) => s.id === id)
    audio.src = next.stream
    if (playing || loading) {
      setLoading(true)
      setError(false)
      audio.play().catch(() => {
        setLoading(false)
        setError(true)
      })
    }
  }

  // Keep the element volume in sync.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Wire <audio> events to UI state.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlaying = () => {
      setPlaying(true)
      setLoading(false)
      setError(false)
    }
    const onWaiting = () => setLoading(true)
    const onPause = () => setPlaying(false)
    const onError = () => {
      setPlaying(false)
      setLoading(false)
      setError(true)
    }
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('stalled', onWaiting)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('stalled', onWaiting)
      audio.removeEventListener('error', onError)
    }
  }, [])

  // --- Spectrum visualizer ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    let width = 0
    let height = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      width = r.width
      height = r.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const accent = () =>
      getComputedStyle(canvas).getPropertyValue('--apricot').trim() || '#f2a93b'
    const bars = 48
    const gap = 3
    const reduced = prefersReducedMotion()

    const draw = () => {
      ctx2d.clearRect(0, 0, width, height)
      const bw = (width - gap * (bars - 1)) / bars
      const col = accent()
      const analyser = analyserRef.current
      const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
      if (analyser && playing && !reduced) analyser.getByteFrequencyData(data)

      for (let i = 0; i < bars; i++) {
        let v
        if (analyser && playing && !reduced) {
          // sample across the spectrum, weight the low-mids
          const idx = Math.floor((i / bars) * (data.length * 0.8))
          v = data[idx] / 255
        } else if (playing) {
          // reduced-motion but live: a calm steady pulse
          v = 0.28 + 0.12 * Math.sin(i * 0.6)
        } else {
          // idle baseline
          v = 0.06 + 0.05 * Math.sin(i * 0.5)
        }
        const bh = Math.max(2, v * height)
        const x = i * (bw + gap)
        const y = (height - bh) / 2
        ctx2d.fillStyle = col
        ctx2d.globalAlpha = playing ? 0.9 : 0.35
        ctx2d.fillRect(x, y, bw, bh)
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [playing])

  // Teardown on unmount.
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      audioRef.current?.pause()
      ctxRef.current?.close?.()
    }
  }, [])

  const stationName = (id) => t(`radio.st.${id}`)

  return (
    <section className="section radio-section" id="direct">
      <div className="container">
        <SectionHead
          eyebrow={t('radio.eyebrow')}
          title={t('radio.title')}
          subtitle={t('radio.subtitle')}
        />

        <div className="radio reveal">
          <div className="radio__console">
            <button
              type="button"
              className={`radio__play${playing ? ' is-playing' : ''}`}
              onClick={toggle}
              aria-pressed={playing}
              aria-label={playing ? t('radio.pause') : t('radio.play')}
            >
              <span className="radio__play-glyph" aria-hidden="true">
                {playing ? '❚❚' : '▶'}
              </span>
            </button>

            <div className="radio__body">
              <div className="radio__meta">
                <span
                  className={`radio__onair${playing ? ' is-live' : ''}`}
                  aria-live="polite"
                >
                  <span className="radio__dot" aria-hidden="true" />
                  {t('radio.onair')}
                </span>
                <span className="radio__now">{stationName(stationId)}</span>
                {time && (
                  <span className="radio__clock">
                    {t('radio.tz')} {time}
                  </span>
                )}
              </div>

              <canvas
                className="radio__viz"
                ref={canvasRef}
                aria-hidden="true"
              />

              <div className="radio__status" role="status">
                {error
                  ? t('radio.error')
                  : loading
                    ? t('radio.loading')
                    : playing
                      ? `${t('radio.onair')} · ${stationName(stationId)}`
                      : t('radio.play')}
                {error && (
                  <button type="button" className="radio__retry" onClick={play}>
                    {t('radio.retry')}
                  </button>
                )}
              </div>
            </div>

            <label className="radio__volume">
              <span className="radio__volume-icon" aria-hidden="true">
                ♪
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label={t('radio.volume')}
              />
            </label>
          </div>

          <div
            className="radio__stations"
            role="radiogroup"
            aria-label={t('radio.station')}
          >
            {STATIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`radio__chip${s.id === stationId ? ' is-active' : ''}`}
                role="radio"
                aria-checked={s.id === stationId}
                onClick={() => pick(s.id)}
              >
                {stationName(s.id)}
              </button>
            ))}
          </div>
        </div>

        {/* one shared element; crossOrigin lets the analyser read the stream */}
        <audio ref={audioRef} crossOrigin="anonymous" preload="none" />
      </div>
    </section>
  )
}
