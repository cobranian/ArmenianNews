//
// PeopleOfAr (peopleofar.com) : un blog anglophone de culture et d'histoire
// arméniennes, sur WordPress. Lu par l'API REST, comme armenews ou oragark.
//
// Trois choses le distinguent des autres sources des articles Culture :
// - c'est un blog, pas une encyclopédie : il n'entre PAS dans la vérification
//   des faits (`culture-draft.mjs`). Un fait qu'il est seul à porter reste
//   donc en ⚠️ dans la PR, pour le relecteur ;
// - il est « tous droits réservés » : il entre en revanche dans la mesure du
//   recouvrement, pour qu'aucune de ses phrases ne soit reprise ;
// - la recherche de l'API fouille aussi le corps des billets (« kochari » rend
//   un billet sur Rubik Kocharian) : un billet n'est gardé que si son TITRE
//   nomme le sujet.
import { stripHtml, WIKI_UA } from './culture-sources.mjs'

const HOST = 'https://www.peopleofar.com'
// Lu à l'appel, pas au chargement : culture-sources importe ce module en retour.
const headers = () => ({ 'User-Agent': WIKI_UA })
export const PEOPLEOFAR_LICENSE = 'Tous droits réservés'
const MAX_POSTS = 2
const MIN_TEXT = 300

// WordPress rend titres et corps avec des entités numériques (&#8217;…).
const decodeEntities = (s) =>
  String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))

const fold = (s) =>
  decodeEntities(stripHtml(s))
    .replace(/[‘’]/g, "'")
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

// Les noms anglais du sujet : libellé, alias et titre Wikipédia (sans la
// précision entre parenthèses). Moins de 4 lettres, trop de faux positifs.
export function peopleofarTerms(entity) {
  const raw = [entity?.labels?.en, ...(entity?.aliases?.en ?? []), entity?.sitelinks?.en]
  const terms = raw.map((t) => fold(String(t ?? '').replace(/\s*\([^)]*\)\s*$/, '')).trim()).filter((t) => t.length >= 4)
  return [...new Set(terms)]
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Le titre nomme-t-il le sujet, en mot entier ?
export function titleNames(title, terms) {
  const t = fold(title)
  return terms.some((term) => new RegExp(`(^|[^\\p{L}])${escapeRe(term)}($|[^\\p{L}])`, 'u').test(t))
}

export function postSource(p) {
  return {
    kind: 'peopleofar',
    lang: 'en',
    title: decodeEntities(stripHtml(p.title?.rendered)),
    url: p.link,
    revision: p.modified_gmt ?? null,
    postId: p.id,
    extract: decodeEntities(stripHtml(p.content?.rendered)),
    license: PEOPLEOFAR_LICENSE,
  }
}

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(String(url), { headers: headers(), signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} peopleofar.com`)
  return res.json()
}

const FIELDS = 'id,link,title,content,modified_gmt'

// Les billets qui traitent du sujet, MAX_POSTS au plus. Une panne ou une
// absence est signalée dans la PR, jamais levée : cette source est un appoint.
export async function fetchPeopleofarSources(entity, fetchImpl = fetch) {
  const terms = peopleofarTerms(entity)
  if (!terms.length) return { sources: [], warnings: [] }
  const seen = new Map()
  try {
    for (const term of terms.slice(0, 3)) {
      const u = new URL(`${HOST}/wp-json/wp/v2/posts`)
      u.searchParams.set('search', term)
      u.searchParams.set('per_page', '20')
      u.searchParams.set('_fields', FIELDS)
      for (const p of await getJson(u, fetchImpl))
        if (!seen.has(p.id) && titleNames(p.title?.rendered, terms)) seen.set(p.id, p)
    }
  } catch (e) {
    return { sources: [], warnings: [`PeopleOfAr indisponible (${e.message}).`] }
  }
  // Un billet sans texte (vidéo intégrée, légende d'image) n'apporte aucun fait.
  const sources = [...seen.values()].map(postSource).filter((s) => s.extract.length >= MIN_TEXT).slice(0, MAX_POSTS)
  return { sources, warnings: sources.length ? [] : [`Pas de billet PeopleOfAr sur « ${terms[0]} ».`] }
}

// Relecture pour /corrige : le billet tel que le brouillon l'a lu. Modifié
// depuis (autre `modified_gmt`), il est omis — comme une révision Wikipédia.
export async function refetchPeopleofar(s, fetchImpl = fetch) {
  if (!s.postId) return null
  const p = await getJson(`${HOST}/wp-json/wp/v2/posts/${s.postId}?_fields=${FIELDS}`, fetchImpl)
  if (s.revision && p.modified_gmt !== s.revision) return null
  return postSource(p)
}

// Ce qui sert à la vérification des faits : tout, sauf le blog.
export const checksFacts = (s) => s.kind !== 'peopleofar'
// Ce que le recouvrement compare : les textes qu'on pourrait paraphraser —
// Wikipédia et le blog (tous droits réservés). La phrase UNESCO est de nous,
// l'ՀՍՀ est en arménien.
export const measuresOverlap = (s) => (s.kind ?? 'wikipedia') === 'wikipedia' || s.kind === 'peopleofar'
