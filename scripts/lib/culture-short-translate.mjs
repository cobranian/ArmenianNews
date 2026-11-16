// Traduit le texte du Short d'un article dans une langue (Task 5 de la vidéo
// automatique). Pas d'accès disque : le modèle (`chat`, chatResilient en
// production) est injecté, l'appelant écrit le fichier.
//
// Rend { short, model, fellBack } où short = { facts, outroTitle, ytTitle,
// ytLead, sourceHash, model } — sans `music` : la piste est celle du short
// français. Lève une Error en clair si la réponse est illisible, refusée par
// la garde d'alphabet ou non conforme à validateShort (contre l'article de la
// langue : tout nombre du short doit s'y lire).
import { buildShortTranslateMessages } from './culture-prompts.mjs'
import { parseShortJson, validateShort, shortHash } from './culture-short.mjs'
import { translationScriptProblem } from './brief-script.mjs'

export async function translateShort({ lang, shortFr, articleText, chat, sticky = null }) {
  const res = await chat({ sticky, temperature: 0.2, messages: buildShortTranslateMessages({ lang, short: shortFr, articleText }) })
  const parsed = parseShortJson(res.text)
  if (!parsed) throw new Error('réponse illisible (JSON attendu)')
  const { facts, outroTitle, ytTitle, ytLead } = parsed
  const short = { facts, outroTitle, ytTitle, ytLead }
  const errors = validateShort(short, { lang, articleText })
  if (errors.length) throw new Error(`short non conforme (\`${res.model}\`) : ${errors.join(' ; ')}`)
  const texts = [...short.facts.flatMap((f) => [f.eyebrow, f.title, f.text]), short.outroTitle, short.ytTitle, short.ytLead]
  const script = translationScriptProblem(texts.join('\n'), lang)
  if (script) throw new Error(`garde d'alphabet (\`${res.model}\`) : ${script} — vidéo non écrite`)
  return { short: { ...short, sourceHash: shortHash(shortFr), model: res.model }, model: res.model, fellBack: Boolean(res.fellBack) }
}
