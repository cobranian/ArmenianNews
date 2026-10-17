// Les flèches du clavier sur une page article Culture : ← article précédent,
// → article suivant. Elles suivent les liens data-step="prev" / "next" que
// scripts/lib/culture-pages.mjs pose dans .culture-pager — sans eux (un seul
// article dans la langue), rien ne se passe.
//
// Fichier à part, pas un <script> en ligne : la CSP (firebase.json) est en
// script-src 'self' sans 'unsafe-inline'.

// Les rôles ARIA dont les flèches sont le mode d'emploi.
var ARROW_ROLES = '[role="slider"],[role="tablist"],[role="listbox"],[role="menu"],[role="menubar"],[role="radiogroup"],[role="grid"],[role="tree"],[role="spinbutton"]'

// Un élément qui défile en largeur (un tableau large, un bloc de code) se lit
// avec ← → : la page ne doit pas partir pendant qu'on le fait défiler.
function scrollsSideways(el) {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth) continue
    var ox = getComputedStyle(el).overflowX
    if (ox === 'auto' || ox === 'scroll') return true
  }
  return false
}

document.addEventListener('keydown', function (e) {
  // e.repeat : une touche maintenue enfoncée ne doit pas enchaîner les pages.
  if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  var step = e.key === 'ArrowLeft' ? 'prev' : e.key === 'ArrowRight' ? 'next' : null
  if (!step) return
  // Jamais pendant une saisie, ni quand un élément qui se sert des flèches
  // a le focus (un champ, un menu déroulant, un lecteur, un widget ARIA).
  var t = e.target
  if (t && t.nodeType === 1) {
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|AUDIO|VIDEO)$/.test(t.tagName)) return
    if (t.closest(ARROW_ROLES) || scrollsSideways(t)) return
  }
  var link = document.querySelector('.culture-pager a[data-step="' + step + '"]')
  if (!link) return
  e.preventDefault()
  window.location.href = link.href
})
