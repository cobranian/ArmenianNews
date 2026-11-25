// Ce qu'un article attend encore — traductions, Shorts, vidéos — à partir du
// résultat de validateArticle. Module pur, partagé par articles-publish.yml
// (quoi traduire avant la fusion) et video.yml (quoi rendre après).
import { ALL_LANGS } from '../../sites.config.js'
import { TRANSLATED, chosenImage } from './culture-validate.mjs'

const online = (videos, slug, lang) => Boolean(videos?.[slug]?.[lang])

// Les langues à rendre : Short publiable, ni sur YouTube, ni déjà en file
// (youtube-queue.json) — un second lancement ne rend pas deux fois le même.
export function videoLangs(result, { slug, videos, queue }) {
  const queued = new Set((queue?.items ?? []).filter((i) => i.slug === slug).map((i) => i.lang))
  return ALL_LANGS.filter((l) => result.shorts?.[l] && !online(videos, slug, l) && !queued.has(l))
}

// Un plan vide est-il une PANNE ? Oui quand validateArticle a refusé un Short
// (erreur `short.<lang>.json : …`) : rien à rendre parce que le texte est
// non conforme, pas parce que tout est déjà fait. Le cas réel : un article
// rédigé par l'ancien code, sans `spoken`, fusionné après SPOKEN_SINCE — il
// partait sans vidéo derrière un ::notice:: vert (revue finale du 25 nov. 2026).
// Rend ces erreurs ; [] = plan vide légitime (Short absent, déjà sur YouTube
// ou en file : ceux-là ne sont que des notes), ou plan non vide.
export function planBlockers(result, langs) {
  if (langs.length) return []
  return (result.errors ?? []).filter((e) => /^short\.[a-z]{2}\.json : /.test(e))
}

// Les langues dont l'article est publiable mais le Short ne l'est pas (absent,
// périmé ou non conforme) : une traduction --short-only les rattrape sans
// retoucher les articles déjà relus. Sans Short français valide, rien à traduire.
// Sans Short français valide (le brouillon n'a pas pu l'écrire), toutes ces
// langues en ont besoin : culture-translate le rédige d'abord, puis les traduit.
export function shortsToTranslate(result, { slug, videos }) {
  const frMissing = !result.shorts?.fr
  return ALL_LANGS.filter((l) => l !== 'fr' && result.langs?.[l] && (frMissing || !result.shorts?.[l]) && !online(videos, slug, l))
}

// Le Short français manque et sa vidéo n'est pas en ligne : il faut le
// rédiger (culture-translate s'en charge avant toute traduction). Garni, dont
// les vidéos précèdent ce format, n'a pas de short.fr.json et n'en veut pas.
export function frShortMissing(result, { slug, videos }) {
  return Boolean(result.langs?.fr) && !result.shorts?.fr && !online(videos, slug, 'fr')
}

// Les passages de culture-translate qu'il faut à une PR de publication — une
// liste d'arguments par passage, [] = rien à traduire. Règle : un <lang>.md à
// jour, déjà relu, n'est JAMAIS retraduit (un Short fr retouché par /corrige
// rendait autrefois périmés les shorts en/hy/ru, culture-check échouait, et
// les six articles repartaient au modèle — de secours, parfois).
//   - articles : les seules langues dont le .md est absent, périmé ou refusé
//     (pas quand le contrôle passe : de/it/es absentes n'y sont que des notes) ;
//     leur Short suit dans le même passage ;
//   - Shorts : --short-only sur les langues à article publiable dont le Short
//     ne l'est pas ;
//   - image changée (imageChoice) sans autre travail : un --short-only seul,
//     qui synchronise l'image et ne traduit que ce qui doit l'être.
// Sans fr.md lisible (result.langs.fr absent), aucune traduction n'y peut rien.
export function translationRuns(result, { slug, videos, meta, checkPassed }) {
  if (!result.langs?.fr) return []
  const articles = checkPassed ? [] : TRANSLATED.filter((l) => !result.langs[l])
  const shorts = shortsToTranslate(result, { slug, videos })
  const imageChanged = (chosenImage(meta)?.commonsUrl ?? null) !== (meta?.image?.commonsUrl ?? null)
  const runs = []
  if (articles.length) runs.push(['--langs', articles.join(',')])
  if (shorts.length) runs.push(['--short-only', '--langs', shorts.join(',')])
  else if ((imageChanged || frShortMissing(result, { slug, videos })) && !articles.length) runs.push(['--short-only'])
  return runs
}
