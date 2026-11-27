#!/usr/bin/env node
/**
 * Traduit le fr.md ACTUEL d'un article en de/it/en/hy/ru (spec §1.2).
 *
 *   npm run culture:translate -- komitas [--summary resume.md] [--langs de,it]
 *
 * Chaque traduction porte `sourceHash` (empreinte du corps français) et
 * `model`. Synchronise aussi l'image si `imageChoice` a changé, et passe le
 * sujet `published` dans sujets.json : sur la branche de la PR, ce statut
 * n'atteint `main` qu'avec la fusion. Une langue en échec n'empêche pas les
 * autres d'être écrites.
 *
 * Gemini en panne ou sans crédit : la traduction passe au modèle de secours
 * (culture-llm.mjs, `chatResilient`), le MÊME pour toutes les langues du run,
 * et le résumé de la PR le dit en tête. Toute traduction passe la garde
 * d'alphabet : refusée, elle n'est pas écrite.
 *
 * de et it sont FACULTATIVES (culture-validate, OPTIONAL) : le titre de leur
 * Wikipédia (meta.sources) est transmis comme nom en usage, et la traduction
 * est comparée à l'extrait de cette page — au-dessus de OVERLAP_THRESHOLD,
 * elle n'est pas écrite. Le code de sortie ne vaut 1 que si une langue
 * REQUIRED ou l'image a échoué : un échec de/it seul ne retient pas la PR.
 *
 * Le texte du Short (short.fr.json) est traduit dans chaque langue juste après
 * son <lang>.md, contre CET article (culture-short-translate.mjs). Un échec de
 * la vidéo n'ôte rien à l'article et ne compte pas dans le code de sortie : il
 * ajoute une ligne « ✗ <lang> vidéo ». `--short-only` ne retraduit PAS les
 * articles : il traduit les seuls shorts absents, périmés ou non conformes, contre les
 * <lang>.md à jour déjà présents.
 *
 * short.fr.json ABSENT (le brouillon n'a pas pu l'écrire) : il est rédigé ici,
 * et le résumé le montre en entier sous la marque SHORT_DRAFTED_MARK — la
 * fusion attend alors un second geste du relecteur (articles-publish.yml).
 * Présent mais non conforme, il n'est JAMAIS réécrit : la PR le dit.
 */
import { readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { parseFrontMatter, serializeFrontMatter, bodyHash } from './lib/culture-markdown.mjs'
import { TRANSLATED, OPTIONAL, chosenImage } from './lib/culture-validate.mjs'
import { setTopicStatus } from './lib/culture-topic.mjs'
import { chatResilient, explain } from './lib/culture-llm.mjs'
import { translationScriptProblem } from './lib/brief-script.mjs'
import { buildTranslateMessages, parseArticleJson, plainName } from './lib/culture-prompts.mjs'
import { downloadImage, translationOverlap } from './lib/culture-sources.mjs'
import { OVERLAP_THRESHOLD } from './lib/culture-overlap.mjs'
import { makeImages } from './lib/culture-image.mjs'
import { syncShortImages } from './lib/culture-short-images.mjs'
import { shortHash, parseShortJson, shortNeedsTranslation, shortReference, shortReferenceOf, frShortAtPublish, needSpoken, SHORT_DRAFTED_MARK } from './lib/culture-short.mjs'
import { shortLines } from './lib/culture-pr.mjs'
import { translateShort } from './lib/culture-short-translate.mjs'
import { draftShort } from './lib/culture-checks.mjs'
import { readVideos } from './lib/culture-load.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(root, 'src/data/culture')
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { summary: { type: 'string' }, langs: { type: 'string' }, 'short-only': { type: 'boolean' } },
})
const [slug] = positionals
if (!slug) throw new Error('usage : culture-translate <slug> [--langs de,it]')
const langs = values.langs ? values.langs.split(',').map((l) => l.trim()).filter(Boolean) : TRANSLATED
const unknown = langs.filter((l) => !TRANSLATED.includes(l))
if (unknown.length || !langs.length) throw new Error(`--langs : langue(s) inconnue(s) ${unknown.join(', ')} (attendu : ${TRANSLATED.join(', ')})`)
const base = path.join(DIR, slug)

const fr = parseFrontMatter(await readFile(path.join(base, 'fr.md'), 'utf-8'))
const hash = bodyHash(fr.body)
const metaPath = path.join(base, 'meta.json')
const meta = JSON.parse(await readFile(metaPath, 'utf-8'))
const lines = ['### Traductions']
// Bloquants : une langue REQUIRED ou l'image. Un échec de/it est compté à part.
let failed = 0
let optionalFailed = 0
const pct = (r) => `${Math.round(r * 100)} %`

// L'image d'abord : si imageChoice a changé, meta.image et les fichiers suivent.
const chosen = chosenImage(meta)
if ((chosen?.commonsUrl ?? null) !== (meta.image?.commonsUrl ?? null)) {
  try {
    if (chosen) {
      const out = await makeImages(await downloadImage(chosen.thumbUrl))
      await writeFile(path.join(base, 'image.webp'), out.webp)
      await writeFile(path.join(base, 'image.jpg'), out.jpg)
      meta.image = { ...chosen, width: out.width, height: out.height }
    } else {
      await rm(path.join(base, 'image.webp'), { force: true })
      await rm(path.join(base, 'image.jpg'), { force: true })
      meta.image = null
    }
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
    lines.push(`- ✓ image : ${meta.image ? meta.image.file : 'retirée'}`)
  } catch (e) {
    failed++
    lines.push(`- ✗ image : ${e.message}`)
  }
}

// Les images de la vidéo (une par fait) : un fichier remplacé à la main dans
// la PR est relu et téléchargé. Jamais bloquant — au pire, le Short n'a que
// les images valides, et la ligne ⚠️ le dit.
try {
  // gatherIfMissing: false — un article sans liste (publié avant les images
  // par fait) n'en reçoit jamais que personne n'a revues.
  const shortSync = await syncShortImages(base, meta, { gatherIfMissing: false })
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
  if (shortSync.failed) lines.push(...shortSync.lines.filter((l) => l.includes('✗')).map((l) => l.replace('- ✗', '- ⚠️')))
} catch (e) {
  lines.push(`- ⚠️ images de la vidéo : ${e.message}`)
}

// Partagé entre les langues : après un repli, toutes vont au même modèle.
const sticky = {}

// Le Short français : sans lui (absent, illisible, non conforme), aucune vidéo
// n'est traduite et une seule ligne le dit. Il se lit contre shortReference du
// fr.md — la référence même de culture-check et du brouillon.
const frRef = shortReference({ title: fr.data.title, description: fr.data.description, body: fr.body })
const frRaw = await readFile(path.join(base, 'short.fr.json'), 'utf-8').catch(() => null)
const frState = frShortAtPublish({ raw: frRaw, reference: frRef, published: Boolean((await readVideos(DIR))?.[slug]?.fr), frDate: fr.data.date })
let shortFr = frState.short
// Présent mais non conforme : il n'est JAMAIS réécrit ici (il a été relu, ou
// corrigé à la main) — culture-check le refuse, la PR le dit.
if (frState.problems.length)
  lines.push(`- ✗ fr vidéo — short.fr.json non conforme (${frState.problems.join(' ; ')}) : corrigez-le dans la PR ; il n'est pas réécrit`)
// ABSENT : le brouillon n'a pas pu l'écrire (garde des nombres, panne). On le
// rédige ici plutôt que de publier l'article sans vidéo pour toujours — mais
// personne ne l'a lu : le résumé le montre en entier, et la marque
// SHORT_DRAFTED_MARK suspend la fusion (articles-publish.yml) ou le rendu
// (articles-merged.yml) jusqu'à la relecture.
if (frState.draft) {
  const r = await draftShort({
    title: fr.data.title, description: fr.data.description, body: fr.body, articleText: frRef,
    chat: (o) => chatResilient({ ...o, sticky }),
  })
  if (r.short) {
    shortFr = r.short
    await writeFile(path.join(base, 'short.fr.json'), `${JSON.stringify(r.short, null, 2)}\n`)
    lines.push(
      `- ⏸️ fr vidéo — ${SHORT_DRAFTED_MARK} (absent du brouillon) : relisez-le, il n'a pas été approuvé avec l'article`,
      ...r.warnings.map((w) => `- ⚠️ ${w}`),
      '',
      ...shortLines(r.short),
    )
    console.log(`  ✓ ${slug}/fr vidéo rédigée (à relire)`)
  } else {
    console.warn(`  ✗ ${slug}/fr vidéo : ${r.error}`)
  }
}
if (!shortFr) lines.push('- ⚠️ vidéo — pas de short.fr.json valide : aucune traduction de la vidéo')

// La vidéo d'une langue, contre l'article de CETTE langue. Ne lève jamais :
// l'article est déjà écrit, un échec n'est qu'une ligne du résumé.
async function translateVideo(lang, t) {
  if (!shortFr) return
  try {
    const r = await translateShort({
      lang, shortFr, sticky, chat: chatResilient,
      articleText: shortReference(t),
      requireSpoken: needSpoken(shortFr, fr.data.date),
    })
    await writeFile(path.join(base, `short.${lang}.json`), `${JSON.stringify(r.short, null, 2)}\n`)
    lines.push(`- ✓ ${lang} vidéo — \`${r.model}\``)
    console.log(`  ✓ ${slug}/${lang} vidéo`)
  } catch (e) {
    const why = e.primaryError
      ? `${explain(e.primaryError)} ; secours sans réponse (${e.message})`
      : e.status || e.empty ? explain(e) : e.message
    lines.push(`- ✗ ${lang} vidéo — ${why}`)
    console.warn(`  ✗ ${slug}/${lang} vidéo : ${e.message}`)
  }
}

// --short-only : les articles ne sont pas retraduits ; seuls les shorts absents,
// périmés ou non conformes le sont, contre les <lang>.md déjà à jour.
if (values['short-only'] && shortFr) {
  const want = shortHash(shortFr)
  for (const lang of langs) {
    let mdText, md
    try {
      mdText = await readFile(path.join(base, `${lang}.md`), 'utf-8')
      md = parseFrontMatter(mdText)
    } catch {
      lines.push(`- ✗ ${lang} vidéo — pas de ${lang}.md lisible : traduisez d'abord l'article`)
      continue
    }
    if (md.data.sourceHash !== hash) {
      lines.push(`- ✗ ${lang} vidéo — ${lang}.md périmé : retraduisez d'abord l'article`)
      continue
    }
    const current = parseShortJson(await readFile(path.join(base, `short.${lang}.json`), 'utf-8').catch(() => ''))
    if (!shortNeedsTranslation(current, { want, lang, articleText: shortReferenceOf(mdText), requireSpoken: needSpoken(shortFr, fr.data.date) })) continue
    await translateVideo(lang, { title: md.data.title, description: md.data.description, body: md.body })
  }
}
for (const lang of values['short-only'] ? [] : langs) {
  const optional = OPTIONAL.includes(lang)
  try {
    // Le nom en usage : le titre de la Wikipédia de la langue cible (sitelink du qid).
    const nameHint = optional
      ? (meta.sources ?? []).find((s) => (s?.kind ?? 'wikipedia') === 'wikipedia' && s.lang === lang)?.title ?? null
      : null
    // Un titre écarté par plainName n'est PAS recopié ici : il vient d'un tiers
    // et ce résumé part dans le corps de la PR.
    if (nameHint && !plainName(nameHint)) {
      lines.push(`- ⚠️ ${lang} — titre de la Wikipédia ${lang} écarté (pas un simple nom) : traduit sans nom en usage ; vérifiez cette source dans meta.json`)
      console.warn(`  ⚠️ ${slug}/${lang} : titre Wikipédia écarté (pas un simple nom)`)
    }
    const res = await chatResilient({
      sticky,
      temperature: 0.2,
      messages: buildTranslateMessages({ lang, title: fr.data.title, description: fr.data.description, body: fr.body, nameHint }),
    })
    const t = parseArticleJson(res.text)
    if (!t) throw new Error('réponse illisible (JSON attendu)')
    const script = translationScriptProblem([t.title, t.description, t.body].join('\n'), lang)
    if (script) throw new Error(`garde d'alphabet (\`${res.model}\`) : ${script} — traduction non écrite`)
    if (optional) {
      const o = await translationOverlap(lang, t.body, meta.sources ?? [])
      if (o?.error) lines.push(`- ⚠️ ${lang} — recouvrement non mesuré : Wikipédia ${lang} illisible (${o.error})`)
      else if (o && o.ratio > OVERLAP_THRESHOLD) {
        optionalFailed++
        lines.push(`- ✗ ${lang} — recouvrement ${pct(o.ratio)} avec Wikipédia ${lang} : traduction non écrite`)
        console.warn(`  ✗ ${slug}/${lang} : recouvrement ${pct(o.ratio)} avec Wikipédia ${lang}`)
        continue
      }
    }
    await writeFile(
      path.join(base, `${lang}.md`),
      serializeFrontMatter(
        { title: t.title, description: t.description, date: fr.data.date, sourceHash: hash, model: res.model },
        t.body,
      ),
    )
    lines.push(`- ✓ ${lang} — \`${res.model}\``)
    console.log(`  ✓ ${slug}/${lang}`)
    await translateVideo(lang, t)
  } catch (e) {
    if (optional) optionalFailed++
    else failed++
    // Le secours lui aussi tombé : la cause qui compte est celle du PRINCIPAL
    // (un crédit à recharger), pas le 429 du dernier modèle gratuit essayé.
    lines.push(e.primaryError
      ? `- ✗ ${lang} — ${explain(e.primaryError)} ; secours sans réponse (${e.message})`
      : `- ✗ ${lang} — ${e.status || e.empty ? explain(e) : e.message}`)
    console.warn(`  ✗ ${slug}/${lang} : ${e.message}`)
  }
}

// En tête du résumé : le propriétaire doit savoir qu'il y a quelque chose à
// faire (payer, changer de clé), pas seulement qu'une langue a échoué.
if (sticky.model) {
  lines.splice(1, 0, `> ⚠️ **${explain(sticky.primaryError)}.** Traductions faites par le modèle de secours \`${sticky.model}\` : relisez-les avec plus de soin.`, '')
  console.warn(`  ⚠ repli : ${explain(sticky.primaryError)}`)
}

const sujetsPath = path.join(DIR, 'sujets.json')
const sujets = JSON.parse(await readFile(sujetsPath, 'utf-8'))
if (sujets.topics.some((t) => t.slug === slug)) {
  await writeFile(sujetsPath, `${JSON.stringify(setTopicStatus(sujets, slug, 'published'), null, 2)}\n`)
} else {
  lines.push(`- ⚠️ ${slug} absent de sujets.json : statut non mis à jour`)
}

if (failed) lines.push('', 'Reposez l’étiquette **traduire** pour réessayer.')
else if (optionalFailed)
  // Reposer « traduire » retraduirait aussi fr/en/hy/ru, déjà relus : de/it
  // seules sont reprises par le rattrapage hebdomadaire.
  lines.push('', 'Traductions de/it facultatives : l’article paraît sans elles, et le sélecteur de langue mène à l’index de leur section. Une fois l’article publié, le rattrapage hebdomadaire (`articles-backfill.yml`) les réessaiera ; pour ne pas attendre : `gh workflow run articles-backfill.yml`.')
if (values.summary) await writeFile(values.summary, `${lines.join('\n')}\n`)
process.exit(failed ? 1 : 0)
