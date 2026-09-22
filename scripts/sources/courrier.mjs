import * as cheerio from 'cheerio'
import { fetchText } from '../lib/http.mjs'
import { absUrl, clean } from '../lib/util.mjs'

const BASE = 'https://courrier.am'

// LE SITE A ÉTÉ REFONDU LE 11 SEPTEMBRE 2026, et la refonte a été SILENCIEUSE
// pour ce module : le nouveau thème Drupal (« card ») ne portait plus l'ancien
// sélecteur, chaque rubrique levait « No articles parsed », et
// `backfillSections` resservait l'instantané du 11 septembre — dont les 80
// vignettes (`styles/530x350`, supprimées à la refonte) répondaient 404. Onze
// jours de cartes figées et sans image, tous les contrôles au vert. Le
// sélecteur d'une grille est un contrat avec un site qui ne l'a pas signé ;
// `test/courrier-grid.test.mjs` lit la grille actuelle depuis une fixture.
//
// Ce qui a changé, et ce qui n'a pas changé :
//  - plus de préfixe de langue : `/fr/actualite` redirige 301 vers
//    `/actualite`, `/hy/actualite` répond 404 (l'édition hy n'existait déjà
//    que de nom, voir scrape.mjs) ;
//  - la grille est `article.card` → `.card__title a`, `.card__media img`,
//    et porte désormais un `<time datetime>` — mais AU JOUR près, figé à
//    « T12:00:00Z » ;
//  - le sitemap est à `/sitemap.xml?page=N` (index à `/sitemap.xml`, deux
//    pages), et garde son `<lastmod>` À LA MINUTE.
//
// DATES : le sitemap prime, la carte est le repli. Deux requêtes donnent la
// minute pour 5 700 articles ; la carte ne donnerait que le jour, et « il y a
// 18 h » deviendrait « 1 j » selon l'heure de lecture. Le `<lastmod>` est
// formellement une date de *modification* — vérifié sur 8 articles avant la
// refonte, le jour correspondait à celui imprimé à chaque fois ; le site ne
// réédite pas ses dépêches. Les `<loc>` récents sont sans préfixe, comme la
// grille (`https://courrier.am/<slug>`) ; les anciens gardent
// `/actualite/<slug>` — ils ne sont plus dans aucune grille.
const SITEMAP_PAGES = [1, 2]
export const sitemapUrl = (page) => `${BASE}/sitemap.xml?page=${page}`
export const sectionUrl = (slug) => `${BASE}/${slug}`

// Les dates ne rejoignent les articles que par APPARIEMENT D'URL, et les deux
// côtés n'écrivent pas la même URL pour le même article. Trois écarts sont
// connus, chacun payé par une panne :
//
//  1. Les accents. Le sitemap et la grille les encodent différemment
//     (« arménie » vs « arm%C3%A9nie ») — d'où `decodeURI`.
//  2. Le slash final, présent d'un côté seulement selon les pages.
//  3. L'HÔTE — et c'est lui qui a cassé deux fois en cinq jours. Le 1er août
//     2026, courrier.am s'est mis à écrire tous ses `<loc>` en
//     `https://www.courrier.am/…` ; le 6 août, en `https://mail.courrier.am/…`.
//     La grille, elle, n'a jamais bougé de `courrier.am` (BASE, ci-dessus).
//     Chaque fois : ~5 450 dates chargées, 0 article daté sur les 8 rubriques.
//     Rien n'échoue — ni requête, ni parseur, ni test, ni build — parce qu'une
//     date manquante est un `null` parfaitement valide. Le seul symptôme est
//     l'absence de l'âge sous « LIRE LA SUITE », et il faut un lecteur pour le
//     voir.
//
// D'où la règle actuelle : ON N'APPARIE QUE LE CHEMIN, l'hôte et le protocole
// sont jetés. Le correctif du 1er août repliait `www.` nommément, et cette
// forme perd la course par construction — elle a une panne de retard sur
// chaque sous-domaine que le site invente. Le chemin, lui, est ce qui
// identifie l'article, et les deux côtés sont la même installation Drupal :
// il n'y a pas deux articles distincts au même chemin.
//
// L'appariement reste SYMÉTRIQUE — le jour où c'est la GRILLE qui change
// d'hôte, rien ne bougera ici non plus. `test/courrier-dates.test.mjs` fige
// les trois écarts sur les vraies chaînes relevées des deux côtés, plus un
// sous-domaine qui n'existe pas encore — sans réseau.
const fold = (s) => {
  // `[^/]*` et non `[^/]+` : une URL protocole-relative (`//hôte/chemin`) doit
  // se replier comme les autres et non repartir en chaîne intacte.
  const m = String(s).match(/^(?:https?:)?\/\/[^/]*(\/.*)?$/i)
  // Trois cas, et les confondre est le piège : pas une URL absolue (on replie
  // la chaîne telle quelle, elle est déjà un chemin) ; une URL sans chemin du
  // tout (`https://courrier.am`, donc la racine) ; une URL avec chemin. Écrit
  // en `?.[1] ?? String(s)`, le deuxième cas retombait sur le premier et
  // renvoyait l'URL ENTIÈRE, hôte compris — le défaut même qu'on corrige.
  const chemin = m ? (m[1] ?? '/') : String(s)
  // `|| '/'` : une racine nue (`https://courrier.am/`) se replierait en chaîne
  // VIDE, et toutes les racines s'appariteraient alors avec n'importe quelle
  // autre chaîne vide.
  return chemin.replace(/\/+$/, '') || '/'
}

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
async function sitemapDates() {
  const map = new Map()
  for (const page of SITEMAP_PAGES) {
    try {
      const xml = await fetchText(sitemapUrl(page), { timeout: 45000 })
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

// Lit la grille « card » d'une rubrique (HTML → articles). Pure : pas de
// réseau, testée sur une fixture réelle.
export function parseSectionHtml(html, limit = 10, dates = new Map()) {
  const $ = cheerio.load(html)
  const articles = []
  const seen = new Set()
  $('article.card').each((_, c) => {
    if (articles.length >= limit) return
    const card = $(c)
    let titleEl = card.find('.card__title a').first()
    if (!titleEl.length) titleEl = card.find('a').filter((_, a) => clean($(a).text())).first()

    const title = clean(titleEl.text())
    const href = titleEl.attr('href')
    if (!title || !href || seen.has(href)) return
    seen.add(href)

    const img = card.find('.card__media img').first().attr('src')
    const url = absUrl(href, BASE)
    // La carte ne date qu'au jour ; on ne s'en sert qu'à défaut du sitemap.
    let cardDate = null
    const dt = card.find('time[datetime]').first().attr('datetime')
    if (dt) {
      const d = new Date(dt)
      if (!Number.isNaN(d.getTime())) cardDate = d.toISOString()
    }
    articles.push({
      title,
      url,
      date: dates.get(normUrl(url)) ?? cardDate,
      image: img ? absUrl(img, BASE) : null,
    })
  })
  return articles
}

async function articlesForSection({ key, slug }, limit = 10, dates = new Map()) {
  const articles = parseSectionHtml(await fetchText(sectionUrl(slug)), limit, dates)
  if (!articles.length) throw new Error(`No articles parsed for section ${slug}`)
  return { sectionKey: key, articles }
}

// `lang` ne sert plus qu'aux libellés de journal : le site n'a qu'une édition,
// sans préfixe d'URL (voir l'en-tête).
export async function scrapeCourrier(lang = 'fr') {
  const dates = await sitemapDates()
  console.log(`  · courrier/sitemap : ${dates.size} dates`)
  const out = []
  for (const section of SECTIONS) {
    try {
      const sec = await articlesForSection(section, 10, dates)
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
