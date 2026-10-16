// La coquille HTML des pages statiques (brève, Culture) : même feuille CSS
// hachée, theme-init.js, balises GA et Cloudflare de la vitrine, et une nav
// commune. Une seule copie — deux coquilles divergeraient (nav, balises).
import { pathFor, langPath, briefPath, culturePath } from '../../sites.config.js'
import { BRIEF_STRINGS } from '../../src/briefStrings.js'
import { CULTURE_STRINGS } from '../../src/cultureStrings.js'
import { beaconTag, gaTag } from './site-meta.mjs'
import { esc } from './culture-markdown.mjs'

export { esc }

export function pageShell({ siteId, lang, head, cssHref, body }) {
  const s = BRIEF_STRINGS[lang]
  const nav = [
    [langPath(siteId, lang), s.home],
    [pathFor(lang, 'radio'), s.radio],
    [pathFor(lang, 'agenda'), s.agenda],
    [briefPath(lang), s.nav],
    [culturePath(lang), CULTURE_STRINGS[lang].nav],
  ]
    .map(([href, label]) => `<a href="${href}">${esc(label)}</a>`)
    .join('')
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#100f0d" />
    ${head}
    ${gaTag(siteId)}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <script src="/theme-init.js"></script>
    <link rel="stylesheet" href="${cssHref}">
  </head>
  <body class="brief-body">
    <header class="brief-nav">
      <div class="container brief-nav__inner">
        <a class="brief-nav__brand" href="${langPath(siteId, lang)}">${esc(s.brand)}</a>
        <nav class="brief-nav__links">${nav}</nav>
      </div>
    </header>
${body}
    ${beaconTag(siteId)}
  </body>
</html>
`
}
