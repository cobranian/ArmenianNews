import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LanguageProvider } from './i18n.jsx'
import { PRERENDERING } from './renderClock.js'
import './styles/global.css'

const root = document.getElementById('root')
const app = (
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
)

// Une page prérendue (npm run prerender) arrive avec son HTML : React le
// REPREND au lieu de le jeter. Avec createRoot, le navigateur n'affichait rien
// tant que React n'avait pas refait toute la page — premier affichage observé
// 1 478 ms contre 233 ms sans JavaScript, LCP simulé mobile 9,9 s contre 2,3 s
// (Lighthouse, 17 octobre 2026). Une page non prérendue (npm run dev, build
// brut) a une racine vide : createRoot, comme avant.
//
// L'hydratation n'est un gain que si le premier rendu client produit EXACTEMENT
// le HTML cuit : au moindre texte divergent, React 18 abandonne et refait toute
// la racine — on retombe sur l'ancien coût. Tout ce qui varie entre le prérendu
// et la visite (l'heure, le thème, la largeur d'écran) doit donc attendre le
// montage : voir src/renderClock.js. `onRecoverableError` est la seule trace
// d'un écart en production, et scripts/hydration-check.mjs la compte.
if (PRERENDERING) {
  // Le prérendu (scripts/prerender.mjs) ne photographie plus la page montée :
  // ce DOM-là a déjà subi les effets (classes posées, états mis à jour) et
  // perd les séparateurs <!-- --> entre textes voisins — deux raisons pour que
  // l'hydratation diverge. renderToString produit exactement le premier rendu
  // qu'hydrateRoot attend. Import dynamique : un chunk à part, que seul le
  // navigateur du build télécharge.
  import('react-dom/server').then(({ renderToString }) => {
    root.innerHTML = renderToString(app)
    document.documentElement.dataset.prerendered = 'ok'
  })
} else if (root.hasChildNodes()) {
  ReactDOM.hydrateRoot(root, app, {
    onRecoverableError(error) {
      console.warn('[hydratation]', error?.message ?? error)
    },
  })
} else {
  ReactDOM.createRoot(root).render(app)
}
