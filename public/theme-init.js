// Apply the saved day/night theme before paint to avoid a flash.
// External (not inline) so the Content-Security-Policy can use script-src 'self'
// without allowing arbitrary inline scripts.
try {
  var t = localStorage.getItem('theme')
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t
} catch {
  /* no localStorage (private mode, blocked cookies) — keep the default theme */
}

// Signale que JavaScript tourne : les blocs « révélés au défilement » ne sont
// masqués que sous html.js (global.css). Posé ici, avant le premier affichage
// et hors de la racine React, pour ne créer aucun écart d'hydratation.
document.documentElement.classList.add('js')
