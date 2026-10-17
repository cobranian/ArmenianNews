// scripts/lib/culture-pages.mjs
/**
 * Les pages de la section Culture — HTML complets écrits au build, hors du
 * bundle React et hors du prérendu, sur le modèle de brief-pages.mjs : même
 * coquille (static-shell.mjs), même feuille CSS, en-tête par site-meta.mjs
 * (cultureHeadFor).
 *
 * L'image d'un article est copiée UNE fois par vitrine, à /culture/<slug>/.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { culturePath, cultureImagePath, siteOf } from '../../sites.config.js'
import { CULTURE_STRINGS } from '../../src/cultureStrings.js'
import { cultureHeadFor } from './site-meta.mjs'
import { cultureLangsBySlug } from './culture-links.mjs'
import { longDate } from './brief-links.mjs'
import { renderMarkdown } from './culture-markdown.mjs'
import { esc, pageShell } from './static-shell.mjs'
import { validEvent } from './culture-validate.mjs'

const card = (lang) => (x) =>
  `<li class="culture-card"><a href="${culturePath(lang, x.slug)}"><span class="culture-card__title">${esc(x.langs[lang].title)}</span><span class="culture-card__desc">${esc(x.langs[lang].description)}</span></a></li>`

function figure(lang, article) {
  const img = article.image
  if (!img) return '<div class="culture__figure culture__figure--motif" aria-hidden="true"></div>'
  const s = CULTURE_STRINGS[lang]
  return `<figure class="culture__figure">
        <img src="${cultureImagePath(article.slug, 'webp')}" alt="${esc(article.langs[lang].title)}" width="${Number(img.width) || 1200}" height="${Number(img.height) || 800}" decoding="async">
        <figcaption class="culture__credit">${esc(s.image)} : ${esc(img.author)} — <a href="${esc(img.commonsUrl)}" rel="noopener">${esc(img.license)}</a></figcaption>
      </figure>`
}

function eventBlock(lang, raw, now) {
  const ev = validEvent(raw)
  if (!ev) return ''
  if (!(new Date(ev.date).getTime() >= now)) return ''
  const s = CULTURE_STRINGS[lang]
  return `<p class="culture__event">${esc(s.event)} : <a href="${esc(ev.url)}" rel="noopener">${esc(ev.title)}</a> — ${esc(longDate(lang, ev.date.slice(0, 10)))}${ev.location ? `, ${esc(ev.location)}` : ''}</p>`
}

// Étiquette d'une source selon son `kind`. Absent = Wikipedia : les articles
// déjà publiés n'ont pas de `kind` et doivent s'afficher comme avant.
function sourceLabel(x) {
  if (x.kind === 'hse') return ' (ՀՍՀ, Wikisource)'
  if (x.kind === 'unesco') return ' (UNESCO)'
  return x.lang ? ` (Wikipedia ${esc(x.lang)})` : ''
}

export function cultureArticleHtml({ siteId, lang, article, list, bySlug, cssHref, now = Date.now() }) {
  const s = CULTURE_STRINGS[lang]
  const a = article.langs[lang]
  const sources = article.sources
    .map((x) => `<li><a href="${esc(x.url)}" rel="noopener">${esc(x.title ?? x.url)}</a>${sourceLabel(x)}</li>`)
    .join('')
  const more = list
    .filter((x) => x.slug !== article.slug && x.langs[lang])
    .slice(0, 3)
    .map(card(lang))
    .join('')
  const body = `    <main class="container culture" data-culture="${article.slug}">
      <p class="culture__kicker"><a href="${culturePath(lang)}">${esc(s.title)}</a></p>
      <h1 class="culture__title">${esc(a.title)}</h1>
      <p class="culture__date"><time datetime="${a.date}">${esc(longDate(lang, a.date))}</time></p>
      ${figure(lang, article)}
      <div class="culture__body">
${renderMarkdown(a.body)}
      </div>
      ${eventBlock(lang, article.meta?.agendaEvent, now)}
      <section class="culture__sources">
        <h2>${esc(s.sources)}</h2>
        <ul>${sources}</ul>
        <p>${esc(s.sourcesNote)}</p>
        <p>${esc(s.aiNote)}</p>
      </section>
      ${more ? `<section class="culture__more"><h2>${esc(s.readAlso)}</h2><ul class="culture-list">${more}</ul></section>` : ''}
    </main>`
  const head = cultureHeadFor({ siteId, lang, slug: article.slug, article, bySlug })
  return pageShell({ siteId, lang, head, cssHref, body })
}

export function cultureIndexHtml({ siteId, lang, list, bySlug, cssHref }) {
  const s = CULTURE_STRINGS[lang]
  const items = list.filter((x) => x.langs[lang])
  const content = items.length
    ? `<ul class="culture-list">${items.map(card(lang)).join('')}</ul>`
    : `<p class="culture__intro">${esc(s.empty)}</p>`
  const body = `    <main class="container culture" data-culture="index">
      <h1 class="culture__title">${esc(s.title)}</h1>
      <p class="culture__intro">${esc(s.description)}</p>
      ${content}
    </main>`
  const head = cultureHeadFor({ siteId, lang, bySlug, robots: items.length ? null : 'noindex, follow' })
  return pageShell({ siteId, lang, head, cssHref, body })
}

// Les pages d'UNE vitrine : seulement ses langues. Les images ne sont copiées
// que pour les articles publiés dans au moins une de ses langues.
export async function writeCulturePages(site, dist, articles, cssHref, srcDir, now = Date.now()) {
  const bySlug = cultureLangsBySlug(articles)
  let n = 0
  const put = async (rel, html) => {
    const dir = path.join(dist, rel.replace(/^\/|\/$/g, ''))
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html, 'utf-8')
    n++
  }
  const langs = site.pages.map((p) => p.lang).filter((l) => siteOf(l) === site.id)
  for (const lang of langs) {
    await put(culturePath(lang), cultureIndexHtml({ siteId: site.id, lang, list: articles, bySlug, cssHref }))
    for (const article of articles.filter((a) => a.langs[lang]))
      await put(
        culturePath(lang, article.slug),
        cultureArticleHtml({ siteId: site.id, lang, article, list: articles, bySlug, cssHref, now }),
      )
  }
  for (const a of articles) {
    if (!a.image || !langs.some((l) => a.langs[l])) continue
    for (const ext of ['webp', 'jpg']) {
      const to = path.join(dist, cultureImagePath(a.slug, ext).replace(/^\//, ''))
      await mkdir(path.dirname(to), { recursive: true })
      await copyFile(path.join(srcDir, a.slug, `image.${ext}`), to)
    }
  }
  return n
}
