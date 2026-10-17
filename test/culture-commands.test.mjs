// La commande /corrige et la relecture des sources à leur révision : ce que le
// workflow articles-revise.yml confie au script, sans réseau.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseReviseCommand, changedParagraphs, newAlerts, reviseReply, UNRECOGNIZED_REPLY, parseIdeaCommand, readIdeas, applyIdeaCommand, writeIdeas } from '../scripts/lib/culture-commands.mjs'
import { ideasIssueBody } from '../scripts/lib/culture-pr.mjs'
import { validateTopics } from '../scripts/lib/culture-topic.mjs'
import { refetchSources } from '../scripts/lib/culture-sources.mjs'

const script = fileURLToPath(new URL('../scripts/culture-revise.mjs', import.meta.url))

test('parseReviseCommand : début de commentaire seulement, consigne vide → null, multiligne gardé', () => {
  assert.equal(parseReviseCommand('/corrige retire le paragraphe sur le plat'), 'retire le paragraphe sur le plat')
  assert.equal(parseReviseCommand('  \n/corrige  raccourcis l’intro  '), 'raccourcis l’intro')
  assert.equal(parseReviseCommand('/corrige ligne 1\r\nligne 2\n\nligne 3'), 'ligne 1\nligne 2\n\nligne 3')
  assert.equal(parseReviseCommand('merci ! /corrige retire tout'), null)
  assert.equal(parseReviseCommand('/corrige'), null)
  assert.equal(parseReviseCommand('/corrige   \n  '), null)
  assert.equal(parseReviseCommand('/corrigez le titre'), null)
  assert.equal(parseReviseCommand(''), null)
  assert.equal(parseReviseCommand(undefined), null)
})

test('changedParagraphs : un paragraphe modifié compte une fois, un retrait aussi', () => {
  const a = 'Un.\n\nDeux.\n\nTrois.'
  assert.equal(changedParagraphs(a, a), 0)
  assert.equal(changedParagraphs(a, 'Un.\n\nDeux bis.\n\nTrois.'), 1)
  assert.equal(changedParagraphs(a, 'Un.\n\nTrois.'), 1)
  assert.equal(changedParagraphs(a, 'Un.\n\nDeux.\n\nTrois.\n\nQuatre.'), 1)
})

test('newAlerts : seuls les ⚠️ absents de l’ancien corps de PR', () => {
  const body = '- ⚠️ 1869 — introuvable tel quel dans les sources\n- ⚠️ 1935 — introuvable tel quel dans les sources\n'
  assert.deepEqual(newAlerts(body, ['1869', '1910']), ['1910'])
  assert.deepEqual(newAlerts('', ['1869']), ['1869'])
})

test('reviseReply : modèle, paragraphes, nouveaux ⚠️, case décochée ; erreur sans clé', () => {
  const ok = reviseReply({ model: 'gemini-flash-latest', fellBack: false, changed: 2, alerts: ['1910'], unchecked: true })
  assert.match(ok, /gemini-flash-latest/)
  assert.match(ok, /2 paragraphes changés/)
  assert.match(ok, /⚠️ 1910/)
  assert.match(ok, /case décochée : recochez pour publier/i)
  const quiet = reviseReply({ model: 'm', fellBack: false, changed: 1, alerts: [], unchecked: false })
  assert.match(quiet, /1 paragraphe changé/)
  assert.doesNotMatch(quiet, /décochée/)
  const fail = reviseReply({ error: 'HTTP 429 (gemini-flash-latest)' })
  assert.match(fail, /HTTP 429/)
  assert.match(fail, /inchangé/)
})

test('culture-revise : commande vide ou mal écrite → réponse d’aide, sortie 0, sans modèle', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'revise-'))
  for (const [i, text] of ['/corrige', '/CORRIGE retire le plat', '/corrigez le titre'].entries()) {
    const f = (n) => path.join(dir, `${n}${i}.md`)
    await writeFile(f('i'), text)
    await writeFile(f('b'), '- [x] Faits vérifiés\n')
    const r = spawnSync(process.execPath, [script, 'komitas', '--instruction', f('i'), '--pr-body', f('b'), '--out-body', f('o'), '--out-reply', f('r')], {
      encoding: 'utf-8',
      env: { ...process.env, GEMINI_API_KEY: '', OPENROUTER_API_KEY: '', ARTICLES_API_KEY: '', ARTICLES_BASE_URL: 'http://127.0.0.1:9/' },
    })
    assert.equal(r.status, 0, text)
    assert.equal(await readFile(f('r'), 'utf-8'), UNRECOGNIZED_REPLY, text)
    await assert.rejects(readFile(f('o')), /ENOENT/, 'aucun corps de PR réécrit')
  }
  assert.match(UNRECOGNIZED_REPLY, /Consigne vide ou commande non reconnue : écrivez `\/corrige <consigne>`\./)
})

// Faux fetch : rend la révision demandée, échoue sur l'hôte « ru ».
function wikiFetch() {
  const calls = []
  const impl = async (url) => {
    const u = new URL(url)
    calls.push(u)
    if (u.host === 'ru.wikipedia.org') return { ok: false, status: 503, json: async () => ({}) }
    const revid = Number(u.searchParams.get('revids'))
    return {
      ok: true,
      status: 200,
      json: async () => ({ query: { pages: [{ title: 'T', revisions: [{ revid, slots: { main: { content: `Texte '''${u.host}''' [[Lien|rev]] ${revid}` } } }] }] } }),
    }
  }
  return { impl, calls }
}

test('refetchSources : révision exacte demandée, source en échec omise', async () => {
  const { impl, calls } = wikiFetch()
  const unesco = { kochari: { year: 2017, list: 'representative', name: 'Kochari, traditional group dance', url: 'https://ich.unesco.org/en/RL/kochari-01295' } }
  const metaSources = [
    { kind: 'wikipedia', lang: 'fr', title: 'Kochari', url: 'https://fr.wikipedia.org/wiki/Kochari', revision: 111, license: 'CC BY-SA 4.0' },
    { kind: 'wikipedia', lang: 'ru', title: 'Кочари', url: 'https://ru.wikipedia.org/wiki/Кочари', revision: 222, license: 'CC BY-SA 4.0' },
    { kind: 'hse', lang: 'hy', title: 'ՀՍՀ/ՔՈՉԱՐԻ', url: 'https://hy.wikisource.org/wiki/ՀՍՀ/ՔՈՉԱՐԻ', revision: 333, license: 'CC BY-SA 3.0' },
    { kind: 'unesco', lang: 'en', title: 'Kochari, traditional group dance', url: 'https://ich.unesco.org/en/RL/kochari-01295', revision: null, license: 'UNESCO' },
    { kind: 'unesco', lang: 'en', title: 'Inconnu', url: 'https://ich.unesco.org/en/RL/absent', revision: null, license: 'UNESCO' },
  ]
  const out = await refetchSources(metaSources, { unesco, fetchImpl: impl })
  assert.deepEqual(out.map((s) => [s.kind, s.lang]), [['wikipedia', 'fr'], ['hse', 'hy'], ['unesco', 'en']])
  assert.equal(out[0].extract, 'Texte fr.wikipedia.org rev 111')
  assert.equal(out[0].revision, 111)
  assert.equal(out[0].url, 'https://fr.wikipedia.org/wiki/Kochari')
  assert.equal(out[1].extract, 'Texte hy.wikisource.org rev 333')
  assert.match(out[2].extract, /Inscrit en 2017/)
  const byHost = Object.fromEntries(calls.map((u) => [u.host, u]))
  assert.equal(byHost['fr.wikipedia.org'].searchParams.get('revids'), '111')
  assert.equal(byHost['hy.wikisource.org'].searchParams.get('revids'), '333')
  assert.equal(byHost['fr.wikipedia.org'].searchParams.get('titles'), null, 'la révision, jamais le titre (qui suivrait la version courante)')
  assert.ok(!calls.some((u) => u.host === 'ich.unesco.org'), 'UNESCO depuis la table, jamais du réseau')
})

test('refetchSources : une révision rendue différente de celle demandée est omise', async () => {
  const impl = async () => ({ ok: true, status: 200, json: async () => ({ query: { badrevids: { 9: { revid: 9, missing: true } } } }) })
  const out = await refetchSources([{ kind: 'wikipedia', lang: 'fr', title: 'X', url: 'u', revision: 9 }], { unesco: {}, fetchImpl: impl })
  assert.deepEqual(out, [])
})

// --- /ajoute et /rejette : l'issue « Culture : idées de sujets » ---
const ideasScript = fileURLToPath(new URL('../scripts/culture-ideas.mjs', import.meta.url))
const IDEAS = [
  { title: 'Le tar', qid: 'Q1', wikipedia_fr: 'Tar (luth)', wikipedia_en: 'Tar (lute)', keywords: ['tar'], url: 'https://fr.wikipedia.org/wiki/Tar_(luth)' },
  { title: 'Le lavash', qid: 'Q2', wikipedia_fr: '', wikipedia_en: 'Lavash', keywords: ['lavash'], url: 'https://en.wikipedia.org/wiki/Lavash' },
  { title: "L'alphabet de Machtots", qid: 'Q11932', wikipedia_fr: 'Alphabet arménien', keywords: ['machtots'], url: 'https://fr.wikipedia.org/wiki/Alphabet_arm%C3%A9nien' },
  { title: 'Les khatchkars', qid: 'Q99', wikipedia_fr: 'Khatchkar', keywords: ['khatchkar'], url: 'https://fr.wikipedia.org/wiki/Khatchkar' },
]
const SUJETS = () => ({
  topics: [
    { slug: 'komitas', title: 'Komitas', qid: 'Q351670', keywords: ['komitas'], status: 'published' },
    { slug: 'khatchkar', title: 'Les khatchkars', qid: 'Q654476', keywords: ['khatchkar'], status: 'published' },
  ],
})
const idea = (slug, qid) => ({ n: 1, slug, title: 'x', qid, wikipedia: {}, keywords: [], status: 'proposed' })
const addOne = (slug, qid) => applyIdeaCommand({ ideas: [idea(slug, qid)], sujets: SUJETS(), cmd: { action: 'add', numbers: [1] } })

test('parseIdeaCommand : espaces ou virgules, début seulement, /rejette', () => {
  assert.deepEqual(parseIdeaCommand('/ajoute 1 4 7'), { action: 'add', numbers: [1, 4, 7] })
  assert.deepEqual(parseIdeaCommand('/ajoute 1,4,7'), { action: 'add', numbers: [1, 4, 7] })
  assert.deepEqual(parseIdeaCommand('  /ajoute 1, 4 ,7\r\n'), { action: 'add', numbers: [1, 4, 7] })
  assert.deepEqual(parseIdeaCommand('/ajoute 3 3 1'), { action: 'add', numbers: [3, 1] })
  assert.deepEqual(parseIdeaCommand('/rejette 2 3'), { action: 'reject', numbers: [2, 3] })
  assert.equal(parseIdeaCommand('merci /ajoute 1'), null)
  assert.equal(parseIdeaCommand('/ajoute'), null)
  assert.equal(parseIdeaCommand('/ajoute   '), null)
  assert.equal(parseIdeaCommand('/ajoutez 1'), null)
  assert.equal(parseIdeaCommand('/AJOUTE 1'), null)
  assert.equal(parseIdeaCommand('/ajoute 1 et 2'), null)
  assert.equal(parseIdeaCommand('/ajoute 0'), null)
  assert.equal(parseIdeaCommand(undefined), null)
})

test('readIdeas : relit exactement le bloc JSON écrit par ideasIssueBody', () => {
  const ideas = readIdeas(ideasIssueBody(IDEAS))
  assert.equal(ideas.length, 4)
  assert.deepEqual(ideas[0], { n: 1, slug: 'le-tar', title: 'Le tar', qid: 'Q1', wikipedia: { fr: 'Tar (luth)', en: 'Tar (lute)' }, keywords: ['tar'], status: 'proposed' })
  assert.deepEqual(readIdeas(ideasIssueBody(IDEAS).replace(/\n/g, '\r\n')), ideas, 'corps édité depuis le web (CRLF)')
  assert.throws(() => readIdeas('pas de bloc'), /json/i)
})

test('applyIdeaCommand : ajout (article retiré du slug, jamais de titre Wikipédia recopié)', () => {
  const ideas = readIdeas(ideasIssueBody(IDEAS))
  const r = applyIdeaCommand({ ideas, sujets: SUJETS(), cmd: { action: 'add', numbers: [1, 2] } })
  const added = r.sujets.topics.slice(2)
  // Le titre proposé par le modèle n'est pas vérifié : en surcharge, il
  // l'emporterait sur les sitelinks du qid et ramènerait les homonymes.
  assert.deepEqual(added[0], { slug: 'tar', title: 'Le tar', qid: 'Q1', keywords: ['tar'], status: 'pending' })
  assert.deepEqual(added[1], { slug: 'lavash', title: 'Le lavash', qid: 'Q2', keywords: ['lavash'], status: 'pending' })
  assert.deepEqual(r.ideas.map((x) => x.status), ['added', 'added', 'proposed', 'proposed'])
  assert.equal(r.done, false)
  assert.match(r.reply, /Le tar/)
  assert.deepEqual(validateTopics(r.sujets), [])
  assert.equal(ideas[0].status, 'proposed', 'entrée non mutée')
  assert.deepEqual(addOne('the-duduk', 'Q5').sujets.topics[2], { slug: 'duduk', title: 'x', qid: 'Q5', keywords: [], status: 'pending' })
  // L'article n'est retiré que s'il reste quelque chose.
  assert.equal(addOne('la', 'Q6').sujets.topics[2].slug, 'la')
  assert.equal(addOne('l-alphabet', 'Q7').sujets.topics[2].slug, 'alphabet')
  assert.equal(addOne('les-khatchkars', 'Q8').sujets.topics[2].slug, 'khatchkars')
  assert.equal(addOne('lesgui', 'Q9').sujets.topics[2].slug, 'lesgui', 'un mot qui commence par « les » reste entier')
})

test('applyIdeaCommand : rejet, numéro inconnu, déjà traité, slug ou qid déjà dans sujets.json, done', () => {
  let r = applyIdeaCommand({ ideas: readIdeas(ideasIssueBody(IDEAS)), sujets: SUJETS(), cmd: { action: 'reject', numbers: [2, 9] } })
  assert.equal(r.ideas[1].status, 'rejected')
  assert.equal(r.sujets.topics.length, 2)
  assert.match(r.reply, /9.*inconnu/)
  r = applyIdeaCommand({ ideas: r.ideas, sujets: r.sujets, cmd: { action: 'add', numbers: [2, 1] } })
  assert.match(r.reply, /2.*déjà/)
  assert.equal(r.ideas[1].status, 'rejected', 'une idée rejetée ne s’ajoute plus')
  assert.equal(r.sujets.topics.length, 3)
  r = applyIdeaCommand({ ideas: r.ideas, sujets: r.sujets, cmd: { action: 'add', numbers: [1] } })
  assert.match(r.reply, /1.*déjà/)
  assert.equal(r.sujets.topics.length, 3)
  // n°3 : son qid est déjà un sujet ; n°4 : son slug (sans l'article) aussi.
  const sujets = { topics: [...r.sujets.topics, { slug: 'alphabet-armenien', title: 'A', qid: 'Q11932', keywords: [], status: 'pending' }, { slug: 'khatchkars', title: 'K', qid: 'Q1000', keywords: [], status: 'pending' }] }
  r = applyIdeaCommand({ ideas: r.ideas, sujets, cmd: { action: 'add', numbers: [3, 4] } })
  assert.equal(r.sujets.topics.length, sujets.topics.length, 'rien ajouté')
  assert.match(r.reply, /Q11932/)
  assert.match(r.reply, /khatchkars/)
  assert.equal(r.done, true, 'plus aucune idée proposée')
  assert.doesNotMatch(r.reply, /fermée/, 'la fermeture est annoncée par le workflow, une fois faite')
  assert.deepEqual(validateTopics(r.sujets), [])
})

test('writeIdeas : JSON réécrit, lignes traitées barrées, le reste intact', () => {
  const body = ideasIssueBody(IDEAS)
  const r = applyIdeaCommand({ ideas: readIdeas(body), sujets: SUJETS(), cmd: { action: 'add', numbers: [1] } })
  const r2 = applyIdeaCommand({ ideas: r.ideas, sujets: r.sujets, cmd: { action: 'reject', numbers: [2] } })
  const out = writeIdeas(body, r2.ideas)
  assert.deepEqual(readIdeas(out), r2.ideas)
  assert.match(out, /^1\. ~~Le tar — \[Wikipédia\]\(https:\/\/fr\.wikipedia\.org\/wiki\/Tar_\(luth\)\)~~$/m)
  assert.match(out, /^2\. ~~Le lavash — \[Wikipédia\]\(https:\/\/en\.wikipedia\.org\/wiki\/Lavash\)~~$/m)
  assert.match(out, /^3\. L'alphabet de Machtots — /m)
  assert.equal(writeIdeas(out, r2.ideas), out, 'idempotent : pas de double barre')
  assert.ok(out.includes('`/ajoute 1 4 7`'), 'mode d’emploi conservé')
})

test('culture-ideas : /ajoute écrit sujets.json, le corps, la réponse et done ; commande vide → aide, rien changé', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ideas-'))
  const f = (n) => path.join(dir, n)
  await writeFile(f('body.md'), ideasIssueBody(IDEAS.slice(0, 2)))
  await writeFile(f('sujets.json'), JSON.stringify(SUJETS(), null, 2) + '\n')
  const run = async (comment) => {
    await writeFile(f('c.md'), comment)
    return spawnSync(process.execPath, [ideasScript, '--comment', f('c.md'), '--issue-body', f('body.md'), '--sujets', f('sujets.json'), '--out-body', f('new.md'), '--out-reply', f('reply.md'), '--out-done', f('done')], { encoding: 'utf-8' })
  }
  let r = await run('/AJOUTE 1')
  assert.equal(r.status, 0, r.stderr)
  assert.match(await readFile(f('reply.md'), 'utf-8'), /\/ajoute 1 4 7/)
  assert.equal(JSON.parse(await readFile(f('sujets.json'), 'utf-8')).topics.length, 2)
  await assert.rejects(readFile(f('new.md')))
  await assert.rejects(readFile(f('done')))
  r = await run('/ajoute 1,2')
  assert.equal(r.status, 0, r.stderr)
  const sujets = JSON.parse(await readFile(f('sujets.json'), 'utf-8'))
  assert.deepEqual(sujets.topics.map((t) => t.slug), ['komitas', 'khatchkar', 'tar', 'lavash'])
  assert.deepEqual(validateTopics(sujets), [])
  assert.deepEqual(readIdeas(await readFile(f('new.md'), 'utf-8')).map((x) => x.status), ['added', 'added'])
  assert.match(await readFile(f('reply.md'), 'utf-8'), /Le lavash/)
  assert.equal(await readFile(f('done'), 'utf-8'), '1')
})
