// Apply the saved day/night theme before paint to avoid a flash.
// External (not inline) so the Content-Security-Policy can use script-src 'self'
// without allowing arbitrary inline scripts.
try {
  var t = localStorage.getItem('theme')
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t
} catch {
  /* no localStorage (private mode, blocked cookies) — keep the default theme */
}
