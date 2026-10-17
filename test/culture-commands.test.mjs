// La commande /corrige et la relecture des sources à leur révision : ce que le
// workflow articles-revise.yml confie au script, sans réseau.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseReviseCommand, changedParagraphs, newAlerts, reviseReply, UNRECOGNIZED_REPLY } from '../scripts/lib/culture-commands.mjs'
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
