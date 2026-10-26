// La barre de partage des pages STATIQUES (articles Culture, brève du jour).
// Liens simples vers les pages de partage des réseaux (src/share.js) ;
// Instagram, qui n'en a pas, est un bouton que public/share.js anime (feuille
// de partage du téléphone, sinon copie du lien) — masqué sans JavaScript
// (.share__copy, html.js). La page doit donc charger '/share.js'.
// Jumelle React : src/components/ShareBar.jsx (même balisage, mêmes classes).
import { SHARE_NETWORKS, SHARE_NAMES, SHARE_ICONS, SHARE_STRINGS, shareHref } from '../../src/share.js'
import { esc } from './static-shell.mjs'

export const SHARE_SCRIPT = '/share.js'

export function shareBarHtml(lang, { url, title }) {
  const s = SHARE_STRINGS[lang]
  const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${SHARE_ICONS[n]}"/></svg>`
  const items = SHARE_NETWORKS.map((n) => {
    const label = esc(s.on(SHARE_NAMES[n]))
    const href = shareHref(n, { url, title })
    return href
      ? `<li><a class="share__btn" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${icon(n)}</a></li>`
      : `<li class="share__copy"><button type="button" class="share__btn" data-share-url="${esc(url)}" data-share-title="${esc(title)}" data-share-copied="${esc(s.copied)}" aria-label="${label}" title="${label}">${icon(n)}</button></li>`
  }).join('')
  return `<div class="share"><p class="share__label">${esc(s.share)}</p><ul class="share__list">${items}</ul><p class="share__msg" role="status" aria-live="polite"></p></div>`
}
