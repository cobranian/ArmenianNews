/**
 * Les pages de la brève quotidienne — HTML complets écrits au build, hors du
 * bundle React et hors du prérendu (une page par jour et par langue : ~1 460
 * par an, que Puppeteer cuirait à chaque heure).
 *
 * Elles réutilisent la feuille CSS que Vite a produite (nom haché, lu dans le
 * index.html bâti) et theme-init.js : même palette, mêmes polices, même thème
 * jour/nuit que le site, sans son JavaScript. L'en-tête vient de
 * site-meta.mjs (briefHeadFor), comme pour toutes les pages bâties.
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ALL_LANGS, briefPath, briefUrl, langHrefsFor, siteOf } from '../../sites.config.js'
import { BRIEF_STRINGS } from '../../src/briefStrings.js'
import { RUBRIC_LABELS } from '../../src/rubricLabels.js'
import { RUBRICS } from '../../src/rubrics.js'
import { SOURCE_NAMES } from '../../src/newsLangs.js'
import { briefHeadFor } from './site-meta.mjs'
import { briefLangsByDate, longDate } from './brief-links.mjs'
import { esc, pageShell } from './static-shell.mjs'

// Le sélecteur de langue d'une brève : la brève du MÊME jour dans l'autre
// langue si elle a paru, sinon l'index de cette langue (les quatre langues ne
// paraissent pas toujours le même jour — voir brief-links.mjs).
export function briefLangHrefs(date, byDate) {
  return langHrefsFor(date === null ? ALL_LANGS : (byDate.get(date) ?? []), briefUrl, date)
}

const DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/

const nonEmpty = (v) => typeof v === 'string' && v.trim() !== ''

// Valide EN PROFONDEUR et renvoie la brève nettoyée (ou lève). Le JSON peut
// avoir été édité à la main : un sujet sans `sources` ferait lever le rendu et
// le JSON-LD, donc tout le build, donc le déploiement horaire.
function cleanBrief(b, lang, date) {
  if (!b || b.date !== date || b.lang !== lang || !Array.isArray(b.topics))
    throw new Error('contenu incohérent')
  if (typeof b.generatedAt !== 'string' || Number.isNaN(Date.parse(b.generatedAt)))
    throw new Error('generatedAt absent ou illisible')
  const topics = []
  for (const t of b.topics) {
    if (!nonEmpty(t?.title) || !nonEmpty(t?.text) || !Array.isArray(t.sources)) continue
    const sources = t.sources.filter(
      (x) => typeof x?.url === 'string' && /^https?:\/\//.test(x.url) && typeof x.source === 'string',
    )
    if (!sources.length) continue
    topics.push({ ...t, rubric: RUBRICS.includes(t.rubric) ? t.rubric : null, sources })
  }
  if (!topics.length) throw new Error('aucun sujet valide')
  return { ...b, topics }
}

// Toutes les brèves, par langue, la plus récente d'abord. Un fichier illisible
// ou dont la date ne correspond pas à son nom est IGNORÉ avec un avertissement :
// une brève corrompue ne doit pas empêcher le déploiement horaire.
export async function loadBriefs(dir, log = console) {
  const out = Object.fromEntries(ALL_LANGS.map((l) => [l, []]))
  for (const lang of ALL_LANGS) {
    let files = []
    try {
      files = await readdir(path.join(dir, lang))
    } catch {
      continue
    }
    for (const f of files) {
      const m = f.match(DATE_FILE)
      if (!m) continue
      try {
        const b = cleanBrief(JSON.parse(await readFile(path.join(dir, lang, f), 'utf-8')), lang, m[1])
        out[lang].push(b)
      } catch (err) {
        log.warn(`  ⚠ brève ${lang}/${f} ignorée : ${err.message}`)
      }
    }
    out[lang].sort((a, b) => b.date.localeCompare(a.date))
  }
  return out
}

export function cssHrefFrom(html) {
  const m = html.match(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"]+\.css)"/)
  if (!m) throw new Error('feuille CSS de Vite introuvable dans index.html — build incomplet')
  return m[1]
}

// Les sources d'un sujet, groupées par rédaction : le modèle cite souvent
// plusieurs articles d'une même source, et « Armenpress · Armenpress ·
// Armenpress » se lit comme un bégaiement. Le premier lien d'un groupe porte le
// nom ; les suivants, leur rang (« 2 », « 3 »), avec le nom en aria-label et le
// titre de l'article en title. Groupes séparés par « · », liens d'un groupe par
// une espace.
function sourceLinks(sources) {
  const groups = new Map()
  for (const x of sources) {
    if (!groups.has(x.source)) groups.set(x.source, [])
    groups.get(x.source).push(x)
  }
  return [...groups.entries()]
    .map(([source, items]) => {
      const name = SOURCE_NAMES[source] ?? source
      return items
        .map((x, i) =>
          i === 0
            ? `<a href="${esc(x.url)}" rel="noopener" title="${esc(x.title)}">${esc(name)}</a>`
            : `<a href="${esc(x.url)}" rel="noopener" aria-label="${esc(`${name} ${i + 1}`)}" title="${esc(x.title)}">${i + 1}</a>`,
        )
        .join(' ')
    })
    .join(' · ')
}

function topicsHtml(lang, brief) {
  const s = BRIEF_STRINGS[lang]
  return brief.topics
    .map((t) => {
      const label = t.rubric ? RUBRIC_LABELS[lang]?.[t.rubric] : null
      const rubric = label ? `<span class="brief__rubric">${esc(label)}</span>` : ''
      return `        <li class="brief__topic">
          ${rubric}
          <h2 class="brief__topic-title">${esc(t.title)}</h2>
          <p class="brief__text">${esc(t.text)}</p>
          <p class="brief__sources">${esc(s.sources)} : ${sourceLinks(t.sources)}</p>
        </li>`
    })
    .join('\n')
}

function briefBlock(lang, brief) {
  const s = BRIEF_STRINGS[lang]
  return `      <h1 class="brief__date">${esc(longDate(lang, brief.date))}</h1>
      ${brief.intro ? `<p class="brief__intro">${esc(brief.intro)}</p>` : ''}
      <ol class="brief__topics">
${topicsHtml(lang, brief)}
      </ol>
      <p class="brief__disclaimer">${esc(s.disclaimer)}</p>`
}

export function briefPageHtml({ siteId, lang, brief, list, byDate, cssHref }) {
  const s = BRIEF_STRINGS[lang]
  const i = list.findIndex((x) => x.date === brief.date)
  const newer = i > 0 ? list[i - 1] : null
  const older = i >= 0 && i < list.length - 1 ? list[i + 1] : null
  const pager = [
    older ? `<a rel="prev" href="${briefPath(lang, older.date)}">${esc(s.previous)}</a>` : '<span></span>',
    `<a href="${briefPath(lang)}">${esc(s.archive)}</a>`,
    newer ? `<a rel="next" href="${briefPath(lang, newer.date)}">${esc(s.next)}</a>` : '<span></span>',
  ].join('')
  const body = `    <main class="container brief" data-brief="${brief.date}">
      <p class="brief__kicker">${esc(s.title)}</p>
${briefBlock(lang, brief)}
      <nav class="brief__pager">${pager}</nav>
    </main>`
  const head = briefHeadFor({ siteId, lang, date: brief.date, brief, byDate })
  return pageShell({ siteId, lang, head, cssHref, body, langHrefs: briefLangHrefs(brief.date, byDate) })
}

export function briefIndexHtml({ siteId, lang, list, byDate, cssHref }) {
  const s = BRIEF_STRINGS[lang]
  const [latest] = list
  const archive = list
    .map((b) => `<li><a href="${briefPath(lang, b.date)}">${esc(longDate(lang, b.date))}</a></li>`)
    .join('')
  const body = latest
    ? `    <main class="container brief" data-brief="index">
      <p class="brief__kicker">${esc(s.latest)}</p>
${briefBlock(lang, latest)}
      <section class="brief__archive">
        <h2>${esc(s.archive)}</h2>
        <ul>${archive}</ul>
      </section>
    </main>`
    : `    <main class="container brief" data-brief="index">
      <h1 class="brief__date">${esc(s.title)}</h1>
      <p class="brief__intro">${esc(s.empty)}</p>
    </main>`
  const head = briefHeadFor({ siteId, lang, byDate, robots: latest ? null : 'noindex, follow' })
  return pageShell({ siteId, lang, head, cssHref, body, langHrefs: briefLangHrefs(null, byDate) })
}

// Les pages d'UNE vitrine : seulement ses langues (sites.config.js). Le .ch
// n'écrit jamais /brief/, le .org jamais /breve/.
export async function writeBriefPages(site, dist, briefs, cssHref) {
  const byDate = briefLangsByDate(briefs)
  let n = 0
  const put = async (rel, html) => {
    const dir = path.join(dist, rel.replace(/^\/|\/$/g, ''))
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'index.html'), html, 'utf-8')
    n++
  }
  for (const { lang } of site.pages) {
    if (siteOf(lang) !== site.id) continue
    const list = briefs[lang] ?? []
    await put(briefPath(lang), briefIndexHtml({ siteId: site.id, lang, list, byDate, cssHref }))
    for (const brief of list)
      await put(briefPath(lang, brief.date), briefPageHtml({ siteId: site.id, lang, brief, list, byDate, cssHref }))
  }
  return n
}
