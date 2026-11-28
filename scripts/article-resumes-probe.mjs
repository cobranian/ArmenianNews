// Sonde LOCALE (jamais en CI) : pour chaque source de news.json, le texte de
// trois articles s'extrait-il ? Aucun appel au modèle sauf avec --model.
//   npm run resumes:probe                      tableau source | essayés | extraits | médiane | erreur
//   npm run resumes:probe -- --per 5           5 URL par source
//   OPENROUTER_API_KEY=… npm run resumes:probe -- --model <url>   résume UNE URL, imprime le résultat
import { readFile } from 'node:fs/promises'
import { listArticles, buildArticleMessages, summaryLangs, vetArticleResumes } from './lib/article-resumes.mjs'
import { extractArticleText, fetchArticle } from './lib/article-text.mjs'
import { ENDPOINT } from './lib/classify-rubrics.mjs'
import { parseResumeReply, resumeModels } from './lib/agenda-resumes.mjs'

const args = process.argv.slice(2)
const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
const per = Number(flag('--per')) || 3
const news = JSON.parse(await readFile(new URL('../src/data/news.json', import.meta.url), 'utf8'))
const articles = listArticles(news)

const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0)

async function probeOne(a) {
  try {
    const text = extractArticleText(await fetchArticle(a.url))
    return text ? { len: text.length } : { err: 'texte introuvable' }
  } catch (e) {
    return { err: e.message }
  }
}

if (flag('--model')) {
  const url = flag('--model')
  const a = articles.find((x) => x.url === url)
  if (!a) throw new Error('URL absente de news.json')
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY absente')
  const text = extractArticleText(await fetchArticle(url))
  if (!text) throw new Error('texte introuvable')
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      models: resumeModels(),
      temperature: 0.3,
      reasoning: { enabled: false },
      messages: buildArticleMessages(a, text, summaryLangs(a.lang, a.source)),
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  const byLang = parseResumeReply(body?.choices?.[0]?.message?.content)
  const { kept, rejected } = vetArticleResumes(byLang, { title: a.title, text })
  console.log(a.title, '\n', url, '\nmodèle:', body.model, '\n', JSON.stringify({ kept, rejected }, null, 2))
} else {
  const bySource = new Map()
  for (const a of articles) {
    const k = `${a.source}/${a.lang}`
    if (!bySource.has(k)) bySource.set(k, [])
    bySource.get(k).push(a)
  }
  console.log('source/langue | essayés | extraits | médiane | erreur')
  for (const [k, list] of bySource) {
    const results = []
    for (const a of list.slice(0, per)) results.push(await probeOne(a))
    const ok = results.filter((r) => r.len)
    const errs = [...new Set(results.filter((r) => r.err).map((r) => r.err))].join('; ')
    console.log(`${k} | ${results.length} | ${ok.length} | ${median(ok.map((r) => r.len))} | ${errs}`)
  }
}
