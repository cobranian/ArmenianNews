import { useEffect, useState } from 'react'
import { RENDER_NOW, RENDER_TZ, SHOULD_TICK } from './renderClock.js'

// L'heure courante pour un rendu qui en dépend (âge d'une dépêche, événement à
// venir). Premier rendu : RENDER_NOW, l'instant figé dans le HTML prérendu —
// sinon l'hydratation diverge et React refait toute la page (renderClock.js).
// Au montage : l'heure réelle, puis un tic tous les `step` ms.
export function useClientNow(step = 60000) {
  const [now, setNow] = useState(RENDER_NOW)
  useEffect(() => {
    if (!SHOULD_TICK) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), step)
    return () => clearInterval(id)
  }, [step])
  return now
}

// L'heure ET le fuseau dans lequel lire une heure murale (l'agenda). Premier
// rendu : ceux du prérendu ; au montage : maintenant, fuseau de la machine.
export function useClientClock(step = 60000) {
  const [clock, setClock] = useState({ now: RENDER_NOW, tz: RENDER_TZ })
  useEffect(() => {
    if (!SHOULD_TICK) return undefined
    setClock({ now: Date.now(), tz: undefined })
    const id = setInterval(() => setClock({ now: Date.now(), tz: undefined }), step)
    return () => clearInterval(id)
  }, [step])
  return clock
}
