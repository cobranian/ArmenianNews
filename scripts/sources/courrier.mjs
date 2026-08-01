import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { absUrl, clean } from '../lib/util.mjs'

const BASE = 'https://courrier.am'

// DATES : elles viennent du SITEMAP, et c'est le détour qui les rend possibles.
//
// La grille de rubrique n'affiche aucune date. La page d'article en affiche une,
// mais en clair et au jour près — « 30.07.2026 » dans `.date-display-single`,
// sans attribut lisible par une machine. La lire coûterait 80 requêtes par
// instantané (8 rubriques × 10) pour une précision d'un jour : un article publié
// ce matin s'afficherait « il y a 18 h » ou « 1 j » selon l'heure de la lecture.
//
// Le sitemap Drupal, lui, donne un `<lastmod>` À LA MINUTE pour chaque URL, en
// DEUX requêtes pour 5 400 articles. C'est formellement une date de
// *modification* et non de publication — vérifié sur 8 articles pris au hasard
// du dernier instantané, le jour du `lastmod` correspond exactement à celui
// imprimé sur la page, à chaque fois. Le site ne réédite pas ses dépêches.
//
// Le flux RSS, lui, existe (`/fr/rss.xml`) mais revient VIDE : 293 octets, zéro
// <item>. Ne le rebranchez pas en croyant simplifier.
const SITEMAP_PAGES = [1, 2]

// Les dates ne rejoignent les articles que par APPARIEMENT D'URL, et les deux
// côtés n'écrivent pas la même URL pour le même article. Trois écarts sont
// connus, chacun payé par une panne :
//
//  1. Les accents. Le sitemap et la grille les encodent différemment
//     (« arménie » vs « arm%C3%A9nie ») — d'où `decodeURI`.
//  2. Le slash final, présent d'un côté seulement selon les pages.
//  3. Le `www.` — et celui-là est apparu du jour au lendemain. Le 1er août
//     2026, courrier.am s'est mis à écrire TOUS ses `<loc>` en
//     `https://www.courrier.am/…` alors que la grille sert des liens sans
//     `www.` (BASE, ci-dessus). Résultat : 5 445 dates chargées, 0 article
//     daté, sur les 8 rubriques. Rien n'a échoué — ni requête, ni parseur, ni
//     build — parce qu'une date manquante est un `null` parfaitement valide.
//     Le seul symptôme était l'absence de l'âge sous « LIRE LA SUITE ».
//
// L'appariement se fait donc sur une forme repliée, et il est SYMÉTRIQUE : le
// jour où le site retirera son `www.`, ou l'ajoutera dans sa grille, rien ne
// bougera ici. `test/courrier-dates.test.mjs` fige les trois écarts, sur les
// vraies chaînes relevées des deux côtés — sans réseau.
const fold = (s) => s.replace(/^(https?:\/\/)www\./i, '$1').replace(/\/+$/, '')

export const normUrl = (u) => {
  // `decodeURI` jette sur un pourcent isolé (« /fr/100% ») : le repli doit
  // alors replier quand même, sinon le correctif aurait un trou sur ces URL.
  try {
    return fold(decodeURI(String(u)))
  } catch {
    return fold(String(u))
  }
}

// URL → date ISO, depuis le sitemap. Un échec renvoie une table vide : les
// articles partent alors sans date, exactement comme avant, plutôt que de faire
// tomber la rubrique.
async function sitemapDates(lang) {
  const map = new Map()
  for (const page of SITEMAP_PAGES) {
    try {
      const xml = await fetchText(`${BASE}/${lang}/sitemap.xml?page=${page}`, { timeout: 45000 })
      for (const m of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) {
        if (!m[2]) continue
        const d = new Date(m[2])
        if (!Number.isNaN(d.getTime())) map.set(normUrl(m[1]), d.toISOString())
      }
    } catch (err) {
      console.warn(`  ✗ courrier/sitemap page ${page}: ${err.message}`)
    }
  }
  return map
}

// The 8 sections requested, in display order. `key` matches i18n 'sections.*'.
export const SECTIONS = [
  { key: 'actualite', slug: 'actualite' },
  { key: 'societe', slug: 'societe' },
  { key: 'economie', slug: 'economie' },
  { key: 'arts-et-culture', slug: 'arts-et-culture' },
  { key: 'francophonie', slug: 'francophonie' },
  { key: 'opinions', slug: 'opinions' },
  { key: 'region', slug: 'region' },
  { key: 'diasporas', slug: 'diasporas' },
]

// Pull the most recent `limit` articles of a section's Drupal Views grid.
// The FR and HY editions share the same slugs and grid markup — only the
// /fr vs /hy path prefix differs.
async function articlesForSection({ key, slug }, lang = 'fr', limit = 10, dates = new Map()) {
  const html = await fetchText(`${BASE}/${lang}/${slug}`)
  const $ = cheerio.load(html)

  const articles = []
  const seen = new Set()
  $('.views-bootstrap-grid-plugin-style .column').each((_, c) => {
    if (articles.length >= limit) return
    const col = $(c)
    let titleEl = col.find('.views-field-title-field-et a').first()
    if (!titleEl.length) titleEl = col.find('a').filter((_, a) => clean($(a).text())).first()

    const title = clean(titleEl.text())
    const href = titleEl.attr('href')
    if (!title || !href || seen.has(href)) return
    seen.add(href)

    const img = col.find('.views-field-field-image img').first().attr('src')
    const url = absUrl(href, BASE)
    articles.push({
      title,
      url,
      date: dates.get(normUrl(url)) ?? null,
      image: img ? absUrl(img, BASE) : null,
    })
  })

  if (!articles.length) throw new Error(`No articles parsed for section ${slug}`)
  return { sectionKey: key, articles }
}

export async function scrapeCourrier(lang = 'fr') {
  const dates = await sitemapDates(lang)
  console.log(`  · courrier/sitemap : ${dates.size} dates`)
  const out = []
  for (const section of SECTIONS) {
    try {
      const sec = await articlesForSection(section, lang, 10, dates)
      out.push(sec)
      const dated = sec.articles.filter((a) => a.date).length
      console.log(`  ✓ courrier/${lang}/${section.slug} (${sec.articles.length}, ${dated} datés)`)
    } catch (err) {
      console.warn(`  ✗ courrier/${lang}/${section.slug}: ${err.message}`)
      out.push({ sectionKey: section.key, articles: [] })
    }
  }

  // Le sitemap a répondu, des articles ont été lus, et PAS UN n'est daté :
  // c'est l'appariement d'URL qui a rompu, pas le réseau. Cet état ne peut pas
  // être légitime — il l'a pourtant été pendant une journée entière, sans que
  // rien ne le dise (voir le commentaire de `normUrl`). On refuse de le passer
  // sous silence une seconde fois.
  //
  // Un avertissement, pas une exception : faire tomber la source perdrait les
  // 80 articles pour une date manquante, et `backfillSections` resservirait
  // l'instantané précédent — donc un mur figé, en plus. Les articles valent
  // mieux non datés que pas du tout.
  const lus = out.reduce((n, s) => n + s.articles.length, 0)
  const datés = out.reduce((n, s) => n + s.articles.filter((a) => a.date).length, 0)
  if (dates.size && lus && !datés) {
    console.warn(
      `  ⚠ courrier/${lang} : ${dates.size} dates au sitemap, ${lus} articles lus, AUCUN daté.\n` +
        `    L'appariement d'URL a rompu — comparez la forme des <loc> du sitemap\n` +
        `    à celle des liens de la grille (hôte, accents, slash final), puis\n` +
        `    étendez normUrl et test/courrier-dates.test.mjs.`,
    )
  }
  return out
}
