// Texte d'un article, toutes sources confondues : sert de matière aux résumés
// écrits par un modèle. Pur jusqu'à `fetchArticle`, qui reçoit ses fonctions de
// réseau en paramètre pour que les tests n'en touchent aucune.
import * as cheerio from 'cheerio'
import { fetchText, fetchTextNode } from './http.mjs'

// Un texte plus court ne dit rien qu'un résumé puisse reprendre (page d'accueil,
// article vide). Un texte plus long est tronqué : le modèle n'en a pas besoin.
export const MIN_TEXT = 300
export const MAX_TEXT = 6000
const MIN_PARA = 40

// Hôtes qui répondent 403 au fetch global de Node (undici) : il faut node:https.
// Mêmes hôtes que les modules sources qui appellent fetchTextNode (armenpress,
// civilnet, newsam + ses trois verticales). armenianweekly n'en a pas besoin.
export const NODE_HOSTS = new Set([
  'armenpress.am',
  'civilnet.am',
  'news.am',
  'med.news.am',
  'sport.news.am',
  'style.news.am',
])

const NOISE = 'script, style, nav, header, footer, aside, form, figure, noscript'
const CONTAINERS = [
  '[itemprop="articleBody"]',
  '.entry-content',
  '.post-content',
  '.article-content',
  '.article-body',
  'article',
  'main',
]

// La plus longue chaîne contenant du HTML de paragraphe, où qu'elle soit.
function longestHtmlString(node, best = '') {
  if (typeof node === 'string') return node.includes('<p') && node.length > best.length ? node : best
  if (node && typeof node === 'object') for (const v of Object.values(node)) best = longestHtmlString(v, best)
  return best
}

function paragraphs($, root) {
  return root
    .find('p, ul li')
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, ' ').trim())
    .filter((t) => t.length >= MIN_PARA)
}

export function extractArticleText(html) {
  let $ = cheerio.load(html)
  let root = null
  const page = $('#app[data-page]').attr('data-page')
  if (page) {
    try {
      const inner = longestHtmlString(JSON.parse(page))
      if (inner) {
        $ = cheerio.load(`<div id="inertia">${inner}</div>`)
        root = $('#inertia')
      }
    } catch {
      // JSON illisible : on retombe sur le HTML de la page.
    }
  }
  if (!root) {
    $(NOISE).remove()
    for (const sel of CONTAINERS) {
      const el = $(sel).first()
      if (el.length) {
        root = el
        break
      }
    }
    root ??= $('body')
  }
  const text = paragraphs($, root).join('\n')
  if (text.length < MIN_TEXT) return null
  return text.slice(0, MAX_TEXT)
}

// Le HTML de la page. Redirection REFUSÉE pour les hôtes hors NODE_HOSTS : un
// article retiré renvoie souvent (302) vers une page générique, qu'on résumerait
// à sa place (même parade que summarizeAgenda).
export function fetchArticle(url, deps = { fetchTextNode, fetchText }) {
  const u = new URL(url)
  if (NODE_HOSTS.has(u.hostname)) return deps.fetchTextNode(u.hostname, u.pathname + u.search)
  return deps.fetchText(url, { redirect: 'manual' })
}
