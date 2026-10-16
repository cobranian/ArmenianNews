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
  if (!res.ok) throw new Error(`HTTP ${res.status} (${model})`)
  const body = await res.json()
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error(`réponse vide (${model})`)
  return { text, model: body?.model || model }
}
