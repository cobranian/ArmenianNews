// Les flèches du clavier sur une page article Culture : ← article précédent,
// → article suivant. Elles suivent les liens rel="prev" / rel="next" que
// scripts/lib/culture-pages.mjs pose dans .culture-pager — sans eux (un seul
// article dans la langue), rien ne se passe.
//
// Fichier à part, pas un <script> en ligne : la CSP (firebase.json) est en
// script-src 'self' sans 'unsafe-inline'.
document.addEventListener('keydown', function (e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  var rel = e.key === 'ArrowLeft' ? 'prev' : e.key === 'ArrowRight' ? 'next' : null
  if (!rel) return
  // Jamais pendant une saisie, ni quand un élément qui se sert des flèches
  // a le focus (un champ, un menu déroulant, un lecteur multimédia).
  var t = e.target
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|AUDIO|VIDEO)$/.test(t.tagName))) return
  var link = document.querySelector('.culture-pager a[rel="' + rel + '"]')
  if (!link) return
  e.preventDefault()
  window.location.href = link.href
})
