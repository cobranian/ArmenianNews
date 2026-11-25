// Client Gemini TTS (interactions API). Aucune E/S disque : `fetch` et `sleep`
// sont injectés, les tests n'ouvrent jamais le réseau.
//
// Quotas Tier 1, par modèle : 10 requêtes/minute, 100 requêtes/jour. Un 429
// « per day » bascule sur le secours (quota séparé) sans nouvel essai ; un 429
// « per minute » attend puis réessaie le même modèle. Un 404 (modèle retiré)
// passe aussitôt au modèle suivant. Un autre 4xx (400, 401, 403 : requête ou
// clé refusées, les mêmes pour les deux modèles) ne s'arrange pas en
// réessayant : arrêt immédiat. Les 5xx et les pannes réseau sont réessayés.

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

// « per day », « per_day », « PerDay » (GenerateRequestsPerDayPerProjectPerModel) :
// le corps réel d'un 429 Gemini varie selon la forme du message.
export const isDailyQuota = (status, body) => status === 429 && /per[\s_-]?day/i.test(String(body))
// 4xx hors 429 et 404 : définitif, ni nouvel essai ni secours.
export const isFatal = (status) => status >= 400 && status < 500 && status !== 429
// Un extrait du corps d'erreur, sans jamais la clé (si le serveur la renvoyait).
const excerpt = (body, apiKey) => {
  const s = String(body ?? '')
  return (apiKey ? s.split(apiKey).join('***') : s).slice(0, 120).replace(/\s+/g, ' ')
}

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
        last = `${model} : HTTP ${res.status} ${excerpt(body, apiKey)}`
        // 404 : CE modèle n'existe plus (les modèles se retirent) — au secours,
        // sans attente ni nouvel essai ; après le dernier, l'erreur ci-dessous.
        if (res.status === 404) break
        if (isFatal(res.status)) throw new Error(`synthèse refusée (${last})`)
        if (isDailyQuota(res.status, body)) break // quota du jour : au secours
      }
      await wait(res.status === 429 ? 15000 : 5000 * attempt)
    }
  }
  throw new Error(`synthèse impossible (${last})`)
}
