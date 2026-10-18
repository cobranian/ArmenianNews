//
// La collecte des sources d'un article : Wikipédia (extrait texte, révision,
// élément Wikidata, image de tête), Wikidata (dates clés) et Commons (images
// candidates sous licence libre).
//
// Le User-Agent s'identifie HONNÊTEMENT, avec un contact : c'est la règle de
// Wikimedia, et c'est la leçon de septembre 2026 — un UA qui se dit « Chrome »
// sans en avoir l'empreinte TLS se fait refuser (voir CLAUDE.md).
import { isFreeLicense } from './culture-license.mjs'
import { unescoSource } from './culture-unesco.mjs'
import { refetchPeopleofar } from './culture-peopleofar.mjs'

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
  if (p.pageprops && 'disambiguation' in p.pageprops)
    throw Object.assign(new Error(`page d’homonymie : ${lang}:${title}`), { disambiguation: true })
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

// Les pages Wikipédia d'un sujet, chacune vérifiée contre son qid : un titre
// (surcharge manuelle, ou sitelink devenu redirection) peut désigner un
// homonyme — « Kochari » a rendu le koshary égyptien. Une page d'une autre
// entité, ou d'homonymie, est écartée avec un avertissement pour la PR ; elle
// ne fait pas échouer le sujet à elle seule.
export async function fetchTopicWikipedia(titles, qid, { langs = ENTITY_LANGS, fetchImpl = fetch } = {}) {
  const wiki = {}
  const warnings = []
  for (const l of langs) {
    const title = titles?.[l]
    if (!title) {
      if (l !== 'fr') warnings.push(`Pas d’article Wikipédia en ${l}.`) // fr : avertissement dédié chez l'appelant
      continue
    }
    let page
    try {
      page = await fetchWikipedia(l, title, fetchImpl)
    } catch (e) {
      warnings.push(e.disambiguation ? `page ${l} « ${title} » écartée : page d’homonymie.` : `Wikipédia ${l} indisponible (${e.message}).`)
      continue
    }
    if (!page) warnings.push(`Wikipédia ${l} : « ${title} » introuvable.`)
    else if (page.wikidata !== qid)
      warnings.push(`page ${l} « ${page.title} » écartée : autre entité Wikidata (${page.wikidata ?? 'aucune'} au lieu de ${qid}).`)
    else wiki[l] = page
  }
  return { wiki, warnings }
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
// La ligature « և » se met en capitales « ԵՒ » (Unicode) ; l'ՀՍՀ, en arménien
// oriental, écrit « ԵՎ » (« ԵՐԵՎԱՆ ») — sans cette reprise, l'entrée est manquée.
export function hseTitle(entity) {
  const raw = entity?.sitelinks?.hy ?? entity?.labels?.hy
  const base = String(raw ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  return base ? `ՀՍՀ/${base.toUpperCase().replace(/ԵՒ/g, 'ԵՎ')}` : null
}

export async function fetchHse(title, fetchImpl = fetch) {
  const j = await getJson(
    api('hy.wikisource.org', { redirects: '1', prop: 'revisions', rvprop: 'ids|content', rvslots: 'main', titles: title }),
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

// L'entrée ՀՍՀ d'une entité, pour le brouillon. Un titre attendu sans entrée
// (ou Wikisource en panne) est signalé dans la PR : sans quoi l'absence de
// cette source passerait pour un sujet que l'ՀՍՀ ne traite pas.
export async function fetchHseSource(entity, fetchImpl = fetch) {
  const title = hseTitle(entity)
  if (!title) return { source: null, warnings: [] }
  try {
    const source = await fetchHse(title, fetchImpl)
    return { source, warnings: source ? [] : [`Pas d’entrée ՀՍՀ trouvée (${title}).`] }
  } catch (e) {
    return { source: null, warnings: [`Pas d’entrée ՀՍՀ trouvée (${title}) : Wikisource indisponible (${e.message}).`] }
  }
}

// Relit les sources d'un article TELLES QUE LE BROUILLON LES A LUES : meta.json
// n'en garde que la révision, pas le texte. Wikipédia et ՀՍՀ sont demandés par
// `revids=` — jamais par titre, qui rendrait la version courante — et en
// wikitexte : l'extrait texte de TextExtracts ignore la révision demandée.
// UNESCO vient de la table curée (jamais du réseau). Une source en échec, ou
// rendue à une autre révision, est omise : la botte de foin rétrécit, les ⚠️
// éventuels grossissent, rien n'est inventé.
export async function refetchSources(metaSources = [], { unesco = {}, fetchImpl = fetch } = {}) {
  const out = []
  for (const s of metaSources) {
    const kind = s.kind ?? 'wikipedia' // meta.json antérieurs à `kind` : Wikipédia seulement
    if (kind === 'unesco') {
      const entry = Object.values(unesco).find((e) => e.url === s.url)
      if (entry) out.push(unescoSource(entry))
      continue
    }
    if (kind === 'peopleofar') {
      const post = await refetchPeopleofar(s, fetchImpl).catch(() => null)
      if (post) out.push(post)
      continue
    }
    if (!s.revision || (kind !== 'wikipedia' && kind !== 'hse')) continue
    const host = kind === 'hse' ? 'hy.wikisource.org' : `${s.lang}.wikipedia.org`
    try {
      const j = await getJson(
        api(host, { prop: 'revisions', rvprop: 'ids|content', rvslots: 'main', revids: String(s.revision) }),
        fetchImpl,
      )
      const rev = j?.query?.pages?.[0]?.revisions?.[0]
      const content = rev?.slots?.main?.content
      if (!content || rev.revid !== s.revision) continue
      out.push({ kind, lang: s.lang, title: s.title, url: s.url, revision: s.revision, license: s.license, extract: wikitextToText(content) })
    } catch {
      // omise : l'appelant compare le nombre de sources rendues
    }
  }
  return out
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
