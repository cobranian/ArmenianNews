//
// Un client MINIMAL pour tout point d'accès compatible OpenAI (/chat/completions).
// Gemini par défaut (offre gratuite) ; Claude, OpenRouter ou OmniRoute en
// changeant deux variables, sans code — voir la spec, « Pourquoi Gemini Flash ».
// La clé n'est jamais écrite dans un message d'erreur ni dans un log.
export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/'
export const DEFAULT_MODEL = 'gemini-flash-latest'
export const LLM_TIMEOUT_MS = 180000

// La clé suit le point d'accès : pointé sur OpenRouter (ARTICLES_BASE_URL), le
// job prend OPENROUTER_API_KEY, le secret que la brève utilise déjà — sinon
// l'en-tête partirait avec une clé Gemini et OpenRouter répondrait 401.
export function llmConfig(env = process.env) {
  const baseUrl = env.ARTICLES_BASE_URL || DEFAULT_BASE_URL
  const providerKey = /openrouter\.ai/.test(baseUrl) ? env.OPENROUTER_API_KEY : env.GEMINI_API_KEY
  return {
    baseUrl,
    model: env.ARTICLES_MODEL || DEFAULT_MODEL,
    apiKey: env.ARTICLES_API_KEY || providerKey || '',
  }
}

export async function chat({
  messages, baseUrl, model, apiKey, fetchImpl = fetch, timeoutMs = LLM_TIMEOUT_MS, temperature = 0.4,
}) {
  if (!apiKey) throw new Error('clé API absente (GEMINI_API_KEY ou ARTICLES_API_KEY)')
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    // Sur OpenRouter, le raisonnement est coupé comme pour la brève et le
    // classement : allumé, nemotron-3-ultra dépassait le délai de 180 s même
    // sur un paragraphe (mesuré le 2 nov. 2026). Gemini ne reçoit rien de plus.
    body: JSON.stringify({ model, temperature, messages, ...(/openrouter\.ai/.test(baseUrl) ? { reasoning: { enabled: false } } : {}) }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    // Gemini répond 400 (et non 401) à une clé invalide : « API_KEY_INVALID ».
    // Le corps n'entre jamais dans le message (il pourrait citer la requête).
    let keyInvalid = false
    if (res.status === 400) {
      const raw = await res.text?.().catch(() => '')
      keyInvalid = /API_KEY_INVALID|API key not valid|API key expired/i.test(raw ?? '')
    }
    throw Object.assign(new Error(`HTTP ${res.status} (${model})`), { status: res.status, keyInvalid })
  }
  const body = await res.json()
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    // finish_reason dit POURQUOI (filtre de contenu, plafond de jetons…) :
    // sans lui, la panne du 26 oct. 2026 était muette sur sa cause.
    const why = body?.choices?.[0]?.finish_reason
    throw Object.assign(new Error(`réponse vide (${model}${why ? `, finish_reason=${why}` : ''})`), { empty: true })
  }
  return { text, model: body?.model || model }
}

// Les modèles de SECOURS, rédaction ET traduction. Modèles :free d'OpenRouter.
// Ils se retirent (404) : voir CLAUDE.md, « modèles :free se retirent » — les
// relire dans /api/v1/models le cas échéant, et le tableau de bord
// (scripts/publication-check.mjs) les sonde deux fois par jour. Ordre mesuré
// le 2 nov. 2026 (Gemini en 402, crédit prépayé à zéro) : super-vl a rendu 400
// mots de français accentué, en JSON, en 9 s ; ultra dépassait 180 s,
// raisonnement coupé ou non ; les deux gemma répondaient 429 (« rate-limited
// upstream »). inkling:free répond 403 hors des « harnais agentiques ».
//
// La traduction s'en sert depuis le 2 nov. 2026 : sans repli, un crédit Gemini
// épuisé bloquait TOUTE publication (aucune traduction en/hy/ru, donc aucune
// fusion). Elle reste « collée » au premier modèle qui répond (voir
// `sticky`) : un modèle qui changerait d'une langue à l'autre ferait diverger
// le ton des éditions. Et chaque traduction passe la garde d'alphabet
// (culture-translate.mjs), parce que ces modèles écrivent du latin en arménien.
export const CULTURE_FALLBACK_MODELS = [
  'nvidia/nemotron-3.5-super-vl:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'google/gemma-4-31b-it:free',
]
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/'

// « Le service ne répond pas » (402, 429, 404, 5xx, délai, réseau coupé) — par
// opposition à une requête fautive, que changer de modèle ne réparerait pas.
// 402 : crédit prépayé Gemini épuisé — le brouillon du 2 nov. 2026 est mort sur
// « HTTP 402 (gemini-flash-latest) » sans essayer le moindre repli. La réponse
// vide est à part (voir chatResilient).
const NETWORK_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'])
export function isUnavailable(err) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return true
  // Sans statut : undici lève TypeError « fetch failed », la cause porte le code.
  if (err instanceof TypeError && /fetch failed/.test(err.message)) return true
  if (NETWORK_CODES.has(err?.cause?.code)) return true
  const s = err?.status
  return s === 402 || s === 429 || s === 404 || (typeof s === 'number' && s >= 500)
}

// 401/403 : la CLÉ est refusée (révoquée, expirée, facturation coupée — Google
// rend parfois 403 PERMISSION_DENIED pour un projet sans facturation). Changer
// de modèle chez le même fournisseur n'y peut rien ; changer de FOURNISSEUR,
// avec une autre clé, si. D'où deux questions distinctes.
export const isKeyRefused = (err) => err?.status === 401 || err?.status === 403 || err?.keyInvalid === true

// Ce que le propriétaire doit FAIRE, en clair. Un 402 était annoncé
// « Gemini indisponible, traduction reportée », comme une panne passagère —
// c'était une facture à payer, et personne ne l'a su à temps (2 nov. 2026).
export const GEMINI_BILLING_URL = 'https://aistudio.google.com/'
export function explain(err, provider = 'Gemini') {
  const s = err?.status
  if (s === 402) return `${provider} : crédit épuisé (HTTP 402) — rechargez le crédit prépayé (${GEMINI_BILLING_URL} → Facturation)`
  if (isKeyRefused(err)) return `${provider} : clé refusée (HTTP ${s}) — clé invalide, révoquée, expirée ou facturation désactivée`
  if (s === 429) return `${provider} : quota atteint (HTTP 429) — passager, ou plafond du forfait`
  if (s === 404) return `${provider} : modèle introuvable (HTTP 404) — retiré par le fournisseur`
  if (typeof s === 'number' && s >= 500) return `${provider} : panne du service (HTTP ${s})`
  if (err?.empty) return `${provider} : réponse vide (${err.message})`
  if (isUnavailable(err)) return `${provider} : injoignable (${err?.message ?? 'délai dépassé'})`
  return `${provider} : ${err?.message ?? String(err)}`
}

// Un appel qui survit à la panne du fournisseur principal. Rend
// { text, model, fellBack, primaryError } — `primaryError` dit POURQUOI le
// principal a été quitté, pour que la PR et le tableau de bord le disent.
//
// `sticky` (objet mutable, partagé entre appels d'un même run) : après un
// premier repli, les appels suivants vont DIRECTEMENT au modèle de secours qui
// a répondu — même ton dans toutes les langues, et pas 180 s perdues à chaque
// langue sur un principal déjà mort.
export async function chatResilient({ messages, temperature, env = process.env, fetchImpl, sticky = null } = {}) {
  const cfg = llmConfig(env)
  const extra = { messages, temperature, fetchImpl }
  const fallbackOk = Boolean(env.OPENROUTER_API_KEY)
  const viaFallback = async (model) => chat({ ...extra, baseUrl: OPENROUTER_BASE_URL, model, apiKey: env.OPENROUTER_API_KEY })

  // Le modèle retenu d'abord ; s'il sature à son tour (429, délai), les
  // autres — mieux vaut un ton qui change qu'une langue qui manque.
  if (sticky?.model) {
    const order = [sticky.model, ...CULTURE_FALLBACK_MODELS.filter((m) => m !== sticky.model)]
    let last
    for (const model of order) {
      try {
        const r = await viaFallback(model)
        return { ...r, fellBack: true, primaryError: sticky.primaryError }
      } catch (e) {
        last = e
        if (!(isUnavailable(e) || e.empty)) break
      }
    }
    throw Object.assign(last, { primaryError: sticky.primaryError })
  }
  let first
  try {
    const r = await chat({ ...cfg, ...extra })
    return { ...r, fellBack: false, primaryError: null }
  } catch (e) {
    first = e
  }
  // Une réponse VIDE se replie aussi : Gemini en rendait une à chaque essai
  // sur un sujet (David de Sassoun, 26 oct. 2026). Un autre modèle n'a pas les
  // mêmes filtres. Une clé refusée se replie si le secours est un AUTRE
  // fournisseur (sa clé à lui peut marcher).
  const otherProvider = !/openrouter\.ai/.test(cfg.baseUrl)
  const canFall = isUnavailable(first) || first.empty || (isKeyRefused(first) && otherProvider) || /clé API absente/.test(first.message)
  if (!canFall || !fallbackOk) throw first
  let last = first
  for (const model of CULTURE_FALLBACK_MODELS) {
    try {
      const r = await viaFallback(model)
      if (sticky) Object.assign(sticky, { model, primaryError: first })
      return { ...r, fellBack: true, primaryError: first }
    } catch (e) {
      last = e
      if (!(isUnavailable(e) || e.empty)) throw e
    }
  }
  throw Object.assign(last, { primaryError: first })
}

// Nom historique, gardé pour les appelants de la rédaction.
export const chatDraft = (opts) => chatResilient(opts)
