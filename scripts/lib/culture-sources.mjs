//
// La collecte des sources d'un article : Wikipédia (extrait texte, révision,
// élément Wikidata, image de tête), Wikidata (dates clés) et Commons (images
// candidates sous licence libre).
//
// Le User-Agent s'identifie HONNÊTEMENT, avec un contact : c'est la règle de
// Wikimedia, et c'est la leçon de septembre 2026 — un UA qui se dit « Chrome »
// sans en avoir l'empreinte TLS se fait refuser (voir CLAUDE.md).
import { isFreeLicense } from './culture-license.mjs'

export const WIKI_UA = 'ArmenieInfo/1.0 (https://armenieinfo.ch/a-propos/; contact@armenieinfo.ch)'
const HEADERS = { 'User-Agent': WIKI_UA, 'Api-User-Agent': WIKI_UA }

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(String(url), { headers: HEADERS, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).host}`)
  return res.json()
}

function api(host, params) {
  const u = new URL(`https://${host}/w/api.php`)
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', formatversion: '2', ...params }))
    u.searchParams.set(k, v)
  return u
}

export async function fetchWikipedia(lang, title, fetchImpl = fetch) {
  const j = await getJson(
    api(`${lang}.wikipedia.org`, {
      redirects: '1',
      prop: 'extracts|revisions|pageprops|pageimages',
      explaintext: '1',
      rvprop: 'ids',
      ppprop: 'wikibase_item|disambiguation',
      piprop: 'name',
      titles: title,
    }),
    fetchImpl,
  )
  const p = j?.query?.pages?.[0]
  if (!p || p.missing || p.invalid || !p.extract) return null
  // Une homonymie n'est jamais un article : on lève plutôt que de rendre null,
  // pour ne pas la confondre avec une page absente (et ne pas rédiger dessus).
  if (p.pageprops && 'disambiguation' in p.pageprops) throw new Error(`page d’homonymie : ${lang}:${title}`)
  return {
    kind: 'wikipedia',
    lang,
    title: p.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
    revision: p.revisions?.[0]?.revid ?? null,
    extract: p.extract,
    license: 'CC BY-SA 4.0',
    wikidata: p.pageprops?.wikibase_item ?? null,
    pageImage: p.pageimage ?? null,
  }
}

// Le texte brut d'un wikitexte : modèles, références, balises et liens retirés.
export function wikitextToText(s) {
  let t = String(s ?? '')
  let prev
  do {
    prev = t
    t = t.replace(/\{\{[^{}]*\}\}/g, '') // de l'intérieur vers l'extérieur : modèles imbriqués
  } while (t !== prev)
  return t
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Titre de la Grande Encyclopédie soviétique arménienne (ՀՍՀ) sur hy.wikisource :
// « ՀՍՀ/ » + le titre en capitales, sans la précision entre parenthèses.
export function hseTitle(entity) {
  const raw = entity?.sitelinks?.hy ?? entity?.labels?.hy
  const base = String(raw ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  return base ? `ՀՍՀ/${base.toUpperCase()}` : null
}

export async function fetchHse(title, fetchImpl = fetch) {
  const j = await getJson(
    api('hy.wikisource.org', { prop: 'revisions', rvprop: 'ids|content', rvslots: 'main', titles: title }),
    fetchImpl,
  )
  const p = j?.query?.pages?.[0]
  const content = p?.revisions?.[0]?.slots?.main?.content
  if (!p || p.missing || p.invalid || !content) return null
  return {
    kind: 'hse',
    lang: 'hy',
    title: p.title,
    url: `https://hy.wikisource.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_')).replace(/%2F/g, '/')}`,
    revision: p.revisions[0].revid ?? null,
    extract: wikitextToText(content),
    license: 'CC BY-SA 3.0',
  }
}

export function wikidataTime(v) {
  const m = String(v?.time ?? '').match(/^([+-])(\d+)-(\d{2})-(\d{2})/)
  if (!m) return null
  const year = String(Number(m[2]))
  if (m[1] === '-') return `${year} av. J.-C.`
  if (v.precision >= 11) return `${m[2].padStart(4, '0')}-${m[3]}-${m[4]}`
  if (v.precision === 10) return `${m[2].padStart(4, '0')}-${m[3]}`
  return year
}

const TIME_PROPS = {
  P569: 'Naissance',
  P570: 'Décès',
  P571: 'Fondation ou création',
  P577: 'Publication',
  P580: 'Début',
  P582: 'Fin',
}

// Les faits datés d'une entité Wikidata, tels que le brouillon les cite.
export function factsFromEntity(entity) {
  const claims = entity?.claims ?? {}
  const out = []
  for (const [p, label] of Object.entries(TIME_PROPS)) {
    const t = wikidataTime(claims[p]?.[0]?.mainsnak?.datavalue?.value)
    if (t) out.push(`${label} : ${t}`)
  }
  return out
}

const ENTITY_LANGS = ['fr', 'en', 'hy', 'ru']

// Une seule requête : libellés, descriptions, alias, titres Wikipédia (sitelinks)
// et image de tête. Le sujet est identifié par son qid, jamais par un titre
// deviné — c'est ce qui a fait tirer le plat égyptien « koshary » pour kochari.
export async function fetchEntity(qid, fetchImpl = fetch) {
  const j = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, fetchImpl)
  const e = Object.values(j?.entities ?? {})[0] ?? {}
  const pick = (obj, langs) => Object.fromEntries(langs.map((l) => [l, obj?.[l]?.value]).filter(([, v]) => v))
  const aliases = (l) => (e.aliases?.[l] ?? []).map((a) => a.value)
  return {
    qid,
    labels: pick(e.labels, ENTITY_LANGS),
    descriptions: pick(e.descriptions, ['fr', 'en']),
    aliases: { fr: aliases('fr'), en: aliases('en') },
    sitelinks: Object.fromEntries(ENTITY_LANGS.map((l) => [l, e.sitelinks?.[`${l}wiki`]?.title])),
    image: e.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null,
    facts: factsFromEntity(e),
  }
}

// Titres Wikipédia à lire : les sitelinks, chaque langue surchargeable à la main
// (`topic.wikipedia`) là où le lien Wikidata ne convient pas. Langue absente omise.
export function resolveTitles(topic, entity) {
  const out = {}
  for (const l of ENTITY_LANGS) {
    const t = topic?.wikipedia?.[l] ?? entity?.sitelinks?.[l]
    if (t) out[l] = t
  }
  return out
}

export async function fetchWikidataFacts(qid, fetchImpl = fetch) {
  return (await fetchEntity(qid, fetchImpl)).facts
}

export const stripHtml = (s) =>
  String(s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

const MIN_WIDTH = 800
const MIME = /^image\/(jpeg|png|webp)$/

export async function fetchCommonsCandidates({ files = [], search = '', limit = 3 } = {}, fetchImpl = fetch) {
  const titles = files.filter(Boolean).map((f) => (f.startsWith('File:') ? f : `File:${f}`))
  if (search) {
    const j = await getJson(
      api('commons.wikimedia.org', { list: 'search', srnamespace: '6', srlimit: '10', srsearch: `${search} filetype:bitmap` }),
      fetchImpl,
    )
    for (const r of j?.query?.search ?? []) titles.push(r.title)
  }
  const unique = [...new Set(titles)].slice(0, 15)
  if (!unique.length) return []
  const j = await getJson(
    api('commons.wikimedia.org', {
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size|mime',
      iiurlwidth: '1600',
      titles: unique.join('|'),
    }),
    fetchImpl,
  )
  const rank = new Map(unique.map((t, i) => [t, i]))
  return (j?.query?.pages ?? [])
    .map((p) => {
      const i = p.imageinfo?.[0]
      const m = i?.extmetadata ?? {}
      return {
        file: p.title,
        thumbUrl: i?.thumburl ?? i?.url,
        width: i?.width,
        height: i?.height,
        mime: i?.mime,
        author: stripHtml(m.Artist?.value),
        license: stripHtml(m.LicenseShortName?.value),
        licenseUrl: m.LicenseUrl?.value ?? null,
        commonsUrl: i?.descriptionurl,
      }
    })
    .filter((c) => c.thumbUrl && c.commonsUrl && c.author && isFreeLicense(c.license) && MIME.test(c.mime ?? '') && c.width >= MIN_WIDTH)
    .sort((a, b) => (rank.get(a.file) ?? 99) - (rank.get(b.file) ?? 99))
    .slice(0, limit)
}

// Plancher de taille AVANT tout encodage, sur les octets reçus : c'est ce qui
// distingue une vraie image d'une page d'erreur (même garde que ig-scrape).
export async function downloadImage(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 10000) throw new Error(`image trop petite (${buf.length} o) — page d'erreur ?`)
  return buf
}
