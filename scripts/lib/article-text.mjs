// Texte d'un article, toutes sources confondues : sert de matière aux résumés
// écrits par un modèle. Pur jusqu'à `fetchArticle`, qui reçoit ses fonctions de
// réseau en paramètre pour que les tests n'en touchent aucune.
//
// SANS RÉSUMÉ (sonde `npm run resumes:probe`, 28 nov. 2026) : californiacourier
// (Cloudflare répond 403 « Just a moment » au fetch du runner, 0/3 dans les trois
// langues). Asbarez, attendu en échec, extrait en fait 3/3 depuis le poste ; sa
// réussite en CI reste à lire au log (✗ résumé-article). Les 301/302 de civilnet
// et news.am sont des articles déplacés ou retirés : refusés à dessein.
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

// Domaines des articles que le site stocke (mesuré sur news.json, 28 nov. 2026).
// Un hôte est admis s'il est égal à une entrée ou s'en est un sous-domaine.
// UNE SOURCE NOUVELLE DOIT AJOUTER SON DOMAINE ICI : sinon ses articles restent
// sans résumé, en silence — la ligne `✗ résumé-article: … URL refusée` au log
// est le seul signe. Cette liste ferme aussi la porte au SSRF : l'URL vient
// d'un flux tiers, et le runner de la CI ne doit pas aller chercher
// 169.254.169.254, localhost ou un hôte interne.
export const SOURCE_HOSTS = new Set([
  'armenews.com',
  'armenianweekly.com',
  'armenieinfo.tv',
  'armenpress.am',
  'artzakank-echo.ch',
  'asbarez.am',
  'asbarez.com',
  'civilnet.am',
  'courrier.am',
  'diarioarmenia.org.ar',
  'armradio.am',
  'news.am',
  'norsevan.com',
  'oragark.com',
  'soyarmenio.com',
  'thecaliforniacourier.com',
])

export function isAllowedArticleUrl(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || u.username || u.password) return false
  if (u.port && u.port !== '443') return false
  const h = u.hostname
  if (h.startsWith('[') || /^\d+(\.\d+){3}$/.test(h)) return false
  for (const d of SOURCE_HOSTS) if (h === d || h.endsWith('.' + d)) return true
  return false
}

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
export async function fetchArticle(url, deps = { fetchTextNode, fetchText }) {
  if (!isAllowedArticleUrl(url)) throw new Error('URL refusée')
  const u = new URL(url)
  // Le `www.` n'est ôté que pour la recherche : la requête garde l'hôte d'origine.
  if (NODE_HOSTS.has(u.hostname.replace(/^www\./, ''))) return deps.fetchTextNode(u.hostname, u.pathname + u.search)
  return deps.fetchText(url, { redirect: 'manual' })
}
