// Texte d'un article, toutes sources confondues : sert de matière aux résumés
// écrits par un modèle. Pur jusqu'à `fetchArticle`, qui reçoit ses fonctions de
// réseau en paramètre pour que les tests n'en touchent aucune.
//
// SANS RÉSUMÉ (sonde `npm run resumes:probe`, 28 nov. 2026) : californiacourier
// (Cloudflare répond 403 « Just a moment » au fetch du runner, 0/3 dans les trois
// langues). Asbarez, attendu en échec, extrait en fait 3/3 depuis le poste ; sa
// réussite en CI reste à lire au log (✗ résumé-article). Une redirection n'est
// suivie qu'une fois, sur le même hôte et vers le même numéro d'article
// (`followableRedirect`) : style.news.am renvoie vers sa version http://, civilnet
// déplace /news/N vers /video/N (mesuré en CI le 28 nov. 2026). Toute autre
// redirection (article retiré → page générique) reste refusée.
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
// est le seul signe en CI ; en local, test/article-hosts.test.mjs échoue. Cette liste ferme aussi la porte au SSRF : l'URL vient
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

// Hôtes qu'on ne tente même pas : injoignables depuis la CI, à coup sûr (403
// Cloudflare partout, mesuré le 28 nov. 2026). Leurs articles ne prennent pas de
// place dans le plafond du passage, et la santé les sort de son dénominateur.
// Les hôtes injoignables PAR INTERMITTENCE (armradio, asbarez) n'y sont pas : le
// disjoncteur de summarizeArticles les écarte pour le seul passage où ils
// échouent.
export const NO_RESUME_HOSTS = ['thecaliforniacourier.com']

export function isNoResumeUrl(url) {
  let h
  try {
    h = new URL(url).hostname
  } catch {
    return false
  }
  return NO_RESUME_HOSTS.some((d) => h === d || h.endsWith('.' + d))
}

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

// Délai GLOBAL d'une page : le délai des clients HTTP est un délai d'inactivité,
// qu'un hôte qui distille ses octets ne déclenche jamais.
export const FETCH_DEADLINE_MS = 20000

function withDeadline(promise, ms, url) {
  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`délai de ${Math.round(ms / 1000)} s dépassé pour ${url}`)), ms)
    timer.unref?.()
  })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
}

// Le numéro d'article d'une URL : la plus longue suite d'au moins 4 chiffres du
// chemin. Sans numéro, aucune redirection n'est suivie.
function articleNumber(pathname) {
  const runs = pathname.match(/\d{4,}/g) || []
  return runs.sort((a, b) => b.length - a.length)[0] ?? null
}

// La cible d'une redirection, si elle désigne le MÊME article : même hôte, même
// numéro, et admise par isAllowedArticleUrl une fois passée en https. Sinon null :
// un article retiré renvoie souvent (302) vers une page générique, qu'on
// résumerait à sa place (même parade que summarizeAgenda).
export function followableRedirect(from, location) {
  if (!location) return null
  let src, dst
  try {
    src = new URL(from)
    dst = new URL(location, from)
  } catch {
    return null
  }
  if (dst.protocol === 'http:') dst.protocol = 'https:'
  if (dst.hostname !== src.hostname) return null
  const n = articleNumber(src.pathname)
  if (!n || articleNumber(dst.pathname) !== n) return null
  if (dst.href === src.href) return null
  return isAllowedArticleUrl(dst.href) ? dst.href : null
}

// Le HTML de la page, en suivant au plus UNE redirection vers le même article.
// L'échéance couvre les deux requêtes.
export async function fetchArticle(url, deps = { fetchTextNode, fetchText }, { deadlineMs = FETCH_DEADLINE_MS } = {}) {
  if (!isAllowedArticleUrl(url)) throw new Error('URL refusée')
  const start = Date.now()
  try {
    return await fetchOnce(url, deps, deadlineMs)
  } catch (err) {
    const next = followableRedirect(url, err?.location)
    const left = deadlineMs - (Date.now() - start)
    if (!next || left <= 0) throw err
    return fetchOnce(next, deps, left)
  }
}

function fetchOnce(url, deps, deadlineMs) {
  const u = new URL(url)
  // Le `www.` n'est ôté que pour la recherche : la requête garde l'hôte d'origine.
  // L'échéance descend jusqu'au client, qui détruit la socket : la course de
  // withDeadline n'est qu'un filet. Sans cela une socket restée ouverte
  // garderait Node en vie, et le scrape (qui finit sans process.exit) pendrait.
  const req = NODE_HOSTS.has(u.hostname.replace(/^www\./, ''))
    ? deps.fetchTextNode(u.hostname, u.pathname + u.search, { deadline: deadlineMs })
    : deps.fetchText(url, { redirect: 'manual', timeout: deadlineMs, retries: 1, deadline: deadlineMs })
  return withDeadline(Promise.resolve(req), deadlineMs + 1000, url)
}
