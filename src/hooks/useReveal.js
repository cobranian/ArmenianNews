import { useEffect } from 'react'

// Adds .is-visible to .reveal elements as they scroll into view.
// Pass a changing `dep` (e.g. language) to re-observe after a remount.
// `scope` (a ref) limits the scan to one subtree: content mounted after the
// page (the deferred social wall) observes only its own elements instead of
// every .reveal the page already handles.
export function useReveal(dep, scope = null) {
  useEffect(() => {
    const root = scope ? scope.current : document
    if (!root) return
    const els = root.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [dep, scope])
}
