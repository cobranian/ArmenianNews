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
    body: JSON.stringify({ model, temperature, messages }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} (${model})`), { status: res.status })
  const body = await res.json()
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error(`réponse vide (${model})`)
  return { text, model: body?.model || model }
}

// Repli de la RÉDACTION seulement. Modèles :free d'OpenRouter, mêmes replis
// que classify-rubrics.mjs (super-120b, 404 depuis le 24 oct. 2026, remplacé). Ils se retirent (404) : voir CLAUDE.md,
// « modèles :free se retirent » — les relire dans /api/v1/models le cas échéant.
// La traduction n'en use jamais : un modèle qui change d'une langue à l'autre
// ferait diverger le ton des quatre éditions.
export const CULTURE_FALLBACK_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'google/gemma-4-31b-it:free',
]
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/'

// « Le service ne répond pas » (429, 404, 5xx, délai, réseau coupé) — par
// opposition à une requête ou une clé fautive (400/401/403) ou une réponse
// vide, que changer de modèle ne réparerait pas.
const NETWORK_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'])
export function isUnavailable(err) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return true
  // Sans statut : undici lève TypeError « fetch failed », la cause porte le code.
  if (err instanceof TypeError && /fetch failed/.test(err.message)) return true
  if (NETWORK_CODES.has(err?.cause?.code)) return true
  const s = err?.status
  return s === 429 || s === 404 || (typeof s === 'number' && s >= 500)
}

export async function chatDraft({ messages, temperature, env = process.env, fetchImpl } = {}) {
  const cfg = llmConfig(env)
  const extra = { messages, temperature, fetchImpl }
  try {
    const r = await chat({ ...cfg, ...extra })
    return { ...r, fellBack: false }
  } catch (first) {
    if (!isUnavailable(first) || !env.OPENROUTER_API_KEY) throw first
    let last = first
    for (const model of CULTURE_FALLBACK_MODELS) {
      try {
        const r = await chat({ ...extra, baseUrl: OPENROUTER_BASE_URL, model, apiKey: env.OPENROUTER_API_KEY })
        return { ...r, fellBack: true }
      } catch (e) {
        last = e
        if (!isUnavailable(e)) throw e
      }
    }
    throw last
  }
}
