// Client Gemini TTS (interactions API). Aucune E/S disque : `fetch` et `sleep`
// sont injectés, les tests n'ouvrent jamais le réseau.
//
// Quotas Tier 1, par modèle : 10 requêtes/minute, 100 requêtes/jour. Un 429
// « per day » bascule sur le secours (quota séparé) sans nouvel essai ; un 429
// « per minute » attend puis réessaie le même modèle.

export const PRIMARY = 'gemini-3.8-flash-tts'
export const FALLBACK = 'gemini-3.8-flash-lite-tts'
export const STYLE = 'calm, warm documentary narrator, clear diction, natural pace, engaging'
export const URL_TTS = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const ATTEMPTS = 3

export function requestBody({ text, voice, model }) {
  return {
    model,
    input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: STYLE }] }] }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice }] },
  }
}

export function extractAudio(json) {
  const audio = json?.steps?.flatMap((s) => s.content || []).find((c) => c.type === 'audio' && c.data)
  return audio ? Buffer.from(audio.data, 'base64') : null
}

export const isDailyQuota = (status, body) => status === 429 && /per day/i.test(String(body))

// → { wav, model }. Rejette si les deux modèles échouent.
export async function synthesize({ text, voice, fetch: doFetch = fetch, models = [PRIMARY, FALLBACK], sleep, apiKey = process.env.GEMINI_API_KEY }) {
  const wait = sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  let last = 'aucun essai'
  for (const model of models) {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      let res, body
      try {
        res = await doFetch(URL_TTS, {
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody({ text, voice, model })),
        })
        body = await res.text()
      } catch (e) {
        last = `${model} : ${e.message}`
        await wait(5000 * attempt)
        continue
      }
      if (res.ok) {
        let wav = null
        try { wav = extractAudio(JSON.parse(body)) } catch { /* corps illisible */ }
        if (wav) return { wav, model }
        last = `${model} : réponse sans audio`
      } else {
        last = `${model} : HTTP ${res.status} ${body.slice(0, 120).replace(/\s+/g, ' ')}`
        if (isDailyQuota(res.status, body)) break // quota du jour : au secours
      }
      await wait(res.status === 429 ? 15000 : 5000 * attempt)
    }
  }
  throw new Error(`synthèse impossible (${last})`)
}
