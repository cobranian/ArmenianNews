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
import { buildTranslateMessages, parseArticleJson } from './lib/culture-prompts.mjs'
import { downloadImage, translationOverlap } from './lib/culture-sources.mjs'
import { OVERLAP_THRESHOLD } from './lib/culture-overlap.mjs'
import { makeImages } from './lib/culture-image.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(root, 'src/data/culture')
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { summary: { type: 'string' }, langs: { type: 'string' } },
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

// Partagé entre les langues : après un repli, toutes vont au même modèle.
const sticky = {}
for (const lang of langs) {
  const optional = OPTIONAL.includes(lang)
  try {
    // Le nom en usage : le titre de la Wikipédia de la langue cible (sitelink du qid).
    const nameHint = optional
      ? (meta.sources ?? []).find((s) => (s?.kind ?? 'wikipedia') === 'wikipedia' && s.lang === lang)?.title ?? null
      : null
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
