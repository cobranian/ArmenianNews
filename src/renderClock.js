// Ce que le PREMIER rendu doit voir pour reproduire exactement le HTML cuit.
//
// main.jsx hydrate la page prérendue (hydrateRoot) au lieu de la refaire. Au
// moindre texte qui diffère entre le HTML cuit et le premier rendu client,
// React 18 abandonne et refait toute la racine : on retombe sur l'ancienne
// lenteur, sans un message pour le lecteur. Tout ce qui dépend du moment ou de
// la machine de la visite doit donc partir de la valeur du prérendu, puis
// prendre la valeur réelle APRÈS le montage :
//
//   - l'heure (âge des dépêches, événements « à venir ») : RENDER_NOW, l'instant
//     inscrit par scripts/prerender.mjs dans <div id="root" data-now="…">, et
//     useClientNow() qui passe à l'heure réelle au montage ;
//   - le thème : le prérendu est rendu en thème sombre (pas de localStorage
//     dans le navigateur du build), voir Nav.jsx.
//
// Module JS plat, sans React — même raison que src/seo.js (lint, voir CLAUDE.md).
// Le hook vit donc ailleurs (useClientNow.js).

const root = typeof document !== 'undefined' ? document.getElementById('root') : null

// Le navigateur du prérendu pose window.__PRERENDER__ = { now } avant tout
// script : c'est l'instant que le HTML cuit fige, et que data-now transmet.
const prerender = typeof window !== 'undefined' ? window.__PRERENDER__ : undefined

export const PRERENDERING = prerender != null

// Vrai quand la racine arrive avec du HTML cuit : main.jsx hydrate.
export const HYDRATING = !PRERENDERING && !!root?.hasChildNodes()

function bakedNow() {
  if (PRERENDERING) return prerender.now
  const n = Number(root?.dataset.now)
  return HYDRATING && Number.isFinite(n) && n > 0 ? n : null
}

// L'heure du premier rendu : celle du prérendu si la page en vient, sinon
// maintenant. Lue UNE fois au chargement, pour que tous les composants rendent
// le même instant.
export const RENDER_NOW = bakedNow() ?? Date.now()

// Faut-il, au montage, passer à l'heure réelle ? Jamais pendant le prérendu :
// le HTML cuit doit rester celui du premier rendu.
export const SHOULD_TICK = !PRERENDERING
