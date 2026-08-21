/**
 * La page 404 d'une vitrine — `dist/<siteId>/404.html`.
 *
 * Firebase Hosting la sert, avec un vrai statut 404, à toute URL qui ne
 * correspond à aucun fichier. C'est tout le sens du retrait du rewrite
 * `**` → /index.html dans firebase.json : avec lui, l'accueil répondait 200 à
 * n'importe quelle adresse — un « soft 404 » pour Google, et un doublon de
 * l'accueil par URL fantaisiste ou par lien cassé (mesuré le 21 août 2026 :
 * /does-not-exist, /foo/bar/, armenieinfo.ch/events/, armenianews.org/fr/ —
 * tous en 200).
 *
 * Un HTML complet, hors du bundle React, comme les cartes de liens de pages/ :
 * elle doit rester servable si le bundle change de hachage, et peser presque
 * rien. Pas de Google Fonts, pas de mesure d'audience, pas de canonical (elle
 * répond à des milliers d'adresses), et `noindex`.
 *
 * Elle parle la langue du domaine et mène aux trois vues de CHAQUE langue que
 * le site sert : un lecteur arrivé sur /hy/radio-typo/ lit l'anglais mais
 * trouve sa ligne arménienne juste en dessous.
 */
import { SITES, pathFor, primaryLang, LANGS } from '../../sites.config.js'
import { VIEW_SEO } from '../../src/seo.js'

// Les chaînes de la page, par langue. Courtes et factuelles : c'est une page
// qu'on quitte aussitôt. Un titre manquant ne retombe PAS sur le français en
// silence — test/not-found.test.mjs exige que chaque langue écrive la sienne.
const STRINGS = {
  fr: {
    title: 'Page introuvable',
    lead: 'Cette adresse ne mène nulle part : la page n’existe pas, ou plus.',
    home: 'Accueil',
  },
  en: {
    title: 'Page not found',
    lead: 'This address leads nowhere: the page does not exist, or no longer does.',
    home: 'Home',
  },
  hy: {
    title: 'Էջը չի գտնվել',
    lead: 'Այս հասցեն ոչ մի տեղ չի տանում․ էջը գոյություն չունի, կամ այլևս չկա։',
    home: 'Գլխավոր էջ',
  },
  ru: {
    title: 'Страница не найдена',
    lead: 'Этот адрес никуда не ведёт: такой страницы нет, или больше нет.',
    home: 'Главная',
  },
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

export function notFoundHtml(siteId) {
  const site = SITES[siteId]
  if (!site) throw new Error(`vitrine inconnue : ${siteId}`)
  const lang = primaryLang(siteId)
  const s = STRINGS[lang]
  if (!s) throw new Error(`pas de chaînes 404 pour ${lang}`)

  const rows = site.pages
    .map((p) => {
      const name = LANGS.find((l) => l.code === p.lang)?.name ?? p.lang
      const t = STRINGS[p.lang]
      if (!t) throw new Error(`pas de chaînes 404 pour ${p.lang}`)
      const links = [
        [pathFor(p.lang, 'home'), t.home],
        [pathFor(p.lang, 'radio'), VIEW_SEO.radio[p.lang].title],
        [pathFor(p.lang, 'agenda'), VIEW_SEO.agenda[p.lang].title],
      ]
        .map(([href, label]) => `<a href="${href}" hreflang="${p.lang}">${esc(label)}</a>`)
        .join('')
      return `<li lang="${p.lang}"><span class="lang">${esc(name)}</span>${links}</li>`
    })
    .join('\n      ')

  // Le thème suit le même interrupteur que le site (clé `theme` en
  // localStorage, posée par /theme-init.js — script externe, parce que la CSP
  // est en script-src 'self' sans 'unsafe-inline'). Nuit par défaut, comme le
  // site ; jour si le système ou le lecteur le demande.
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(s.title)} · ${esc(site.brand)}</title>
<meta name="robots" content="noindex, follow">
<meta name="theme-color" content="#100f0d">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script src="/theme-init.js"></script>
<style>
:root{--bg:#100f0d;--ink:#f1e9de;--muted:#a79c90;--accent:#f0a04b;--rule:#2e2823;
  --serif:Georgia,'Noto Serif Armenian','Times New Roman',serif;
  --sans:system-ui,-apple-system,'Segoe UI','Noto Sans Armenian',sans-serif}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#faf6ef;--ink:#1e1916;--muted:#6d635b;--accent:#b5651d;--rule:#e5dcd0}}
:root[data-theme="light"]{--bg:#faf6ef;--ink:#1e1916;--muted:#6d635b;--accent:#b5651d;--rule:#e5dcd0}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5;padding:32px 20px}
main{max-width:40rem;width:100%}
.brand{font-family:var(--serif);font-style:italic;font-size:1.1rem;color:var(--accent);text-decoration:none;letter-spacing:.01em}
h1{font-family:var(--serif);font-weight:600;font-size:clamp(2rem,6vw,3rem);line-height:1.1;margin:.6em 0 .3em;text-wrap:balance}
.code{font-family:ui-monospace,Consolas,monospace;font-size:.8rem;letter-spacing:.14em;color:var(--muted);text-transform:uppercase}
p{margin:0 0 1.6em;color:var(--muted);max-width:36rem}
ul{list-style:none;padding:0;margin:0;border-top:1px solid var(--rule)}
li{display:flex;flex-wrap:wrap;gap:.4em 1.2em;align-items:baseline;padding:.8em 0;border-bottom:1px solid var(--rule)}
.lang{flex:0 0 7.5em;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
li a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--accent)}
li a:hover,li a:focus-visible{color:var(--accent);outline:none}
li a:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-bottom-color:transparent}
</style>
</head>
<body>
<main>
  <a class="brand" href="${pathFor(lang, 'home')}">${esc(site.brand)}</a>
  <div class="code">404</div>
  <h1>${esc(s.title)}</h1>
  <p>${esc(s.lead)}</p>
  <ul>
      ${rows}
  </ul>
</main>
</body>
</html>
`
}
