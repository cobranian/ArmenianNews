// Soumet à IndexNow les pages nouvelles ou changées de chaque vitrine.
//
//   node scripts/indexnow.mjs --save <dossier>    AVANT le déploiement : recopie
//                                                 les sitemaps en ligne
//   node scripts/indexnow.mjs --since <dossier>   APRÈS : compare à dist/<site>/
//                                                 sitemap.xml et soumet l'écart
//   node scripts/indexnow.mjs --all [--dry]       tout soumettre (à la main)
//
// Ne fait JAMAIS échouer le job : un refus d'IndexNow ne doit pas retenir un
// déploiement. Le signe d'une panne est une ligne « ✗ indexnow » au log
// (gh run view <id> --log | grep indexnow).
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { SITES } from '../sites.config.js'
import { INDEXNOW_ENDPOINT, parseSitemap, urlsToSubmit, payloadFor } from './lib/indexnow.mjs'

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const dry = args.includes('--dry')

async function main() {
  const save = opt('--save')
  if (save) {
    await mkdir(save, { recursive: true })
    for (const [id, site] of Object.entries(SITES)) {
      try {
        const res = await fetch(`${site.host}/sitemap.xml`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await writeFile(join(save, `${id}.xml`), await res.text())
        console.log(`✓ indexnow/${id} : sitemap en ligne recopié`)
      } catch (e) {
        console.log(`✗ indexnow/${id} : sitemap en ligne illisible (${e.message}) — rien ne sera soumis`)
      }
    }
    return
  }

  const since = opt('--since')
  if (!since && !args.includes('--all')) throw new Error('usage : --save <dir> | --since <dir> | --all [--dry]')

  for (const [id, site] of Object.entries(SITES)) {
    try {
      const after = parseSitemap(await readFile(join('dist', id, 'sitemap.xml'), 'utf8'))
      let urls
      if (since) {
        const before = parseSitemap(await readFile(join(since, `${id}.xml`), 'utf8').catch(() => ''))
        urls = urlsToSubmit(before, after)
      } else urls = [...after.keys()]
      if (!urls.length) { console.log(`· indexnow/${id} : rien de nouveau`); continue }
      const body = payloadFor(site.host, urls)
      if (dry) { console.log(`· indexnow/${id} (dry) : ${urls.length} URL\n  ${urls.join('\n  ')}`); continue }
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      })
      // 200 = reçu, 202 = reçu, clé en cours de vérification. Le reste est un refus.
      if (res.status === 200 || res.status === 202) console.log(`✓ indexnow/${id} : ${urls.length} URL soumises (HTTP ${res.status})`)
      else console.log(`✗ indexnow/${id} : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
    } catch (e) {
      console.log(`✗ indexnow/${id} : ${e.message}`)
    }
  }
}

main().catch((e) => { console.log(`✗ indexnow : ${e.message}`) })
