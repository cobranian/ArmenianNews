// Load an external script once (deduped by src) and resolve when ready.
const cache = new Map()

export function loadScript(src, { id, attrs } = {}) {
  if (cache.has(src)) return cache.get(src)

  const promise = new Promise((resolve, reject) => {
    const existing = id && document.getElementById(id)
    if (existing) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.defer = true
    if (id) s.id = id
    if (attrs) Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v))
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.body.appendChild(s)
  })

  cache.set(src, promise)
  return promise
}
