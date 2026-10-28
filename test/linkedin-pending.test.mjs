import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pending, hookMessage, postText, LINKEDIN_CHANNELS } from '../scripts/lib/linkedin-pending.mjs'
import { emptyLedger } from '../scripts/lib/social.mjs'

const item = (slug, date, lang = 'fr') => ({
  id: `culture:${slug}`,
  kind: 'culture',
  lang,
  date,
  url: `https://${lang === 'fr' ? 'armenieinfo.ch' : 'armenianews.org'}/culture/${slug}/`,
  title: `Titre ${slug}`,
  description: `Description ${slug}`,
  image: null,
})
const items = [item('a', '2026-10-01'), item('b', '2026-10-02'), item('a', '2026-10-01', 'en'), item('b', '2026-10-02', 'en')]
const kinds = ['culture']

test('les canaux LinkedIn sont les deux pages', () => {
  assert.deepEqual(LINKEDIN_CHANNELS.map((c) => c.id).sort(), ['linkedin-ch', 'linkedin-org'])
})

// Une page neuve : l'archive est amorcée, sauf le dernier article, proposé.
test('premier passage : amorce l’archive, propose le dernier article seulement', () => {
  const r = pending({ items, ledger: emptyLedger(), kinds })
  assert.deepEqual(r.seeded.sort(), ['linkedin-ch', 'linkedin-org'])
  assert.deepEqual(r.posts.map((p) => `${p.channel}/${p.item.id}`).sort(), ['linkedin-ch/culture:b', 'linkedin-org/culture:b'])
  assert.deepEqual(Object.keys(r.ledger.channels['linkedin-ch'].posted), ['culture:a'])
})

// Proposer n'est pas publier : tant que --mark n'a pas noté le post, il revient.
test('une proposition ne marque rien : elle revient à la session suivante', () => {
  const first = pending({ items, ledger: emptyLedger(), kinds })
  const again = pending({ items, ledger: first.ledger, kinds })
  assert.deepEqual(again.seeded, [])
  assert.equal(again.posts.length, 2)
  assert.ok(!('culture:b' in again.ledger.channels['linkedin-ch'].posted))
})

test('rien en attente : le hook se tait', () => {
  assert.equal(hookMessage([]), '')
  const msg = hookMessage([{ channel: 'linkedin-ch', item: item('b', '2026-10-02') }])
  assert.match(msg, /RAPPEL LINKEDIN : 1 publication/)
  assert.match(msg, /DEMANDE/)
})

test('le texte à coller porte le lien marqué linkedin', () => {
  assert.equal(
    postText(item('b', '2026-10-02')),
    'Titre b\n\nDescription b\n\nhttps://armenieinfo.ch/culture/b/?utm_source=linkedin&utm_medium=social',
  )
})

// Le hook est branché sur l'ouverture de session, et le registre reste local.
test('hook SessionStart branché, registre hors git', () => {
  const settings = JSON.parse(readFileSync(new URL('../.claude/settings.json', import.meta.url), 'utf8'))
  const cmds = settings.hooks.SessionStart.flatMap((h) => h.hooks.map((x) => x.command))
  assert.ok(cmds.some((c) => c.includes('linkedin-pending.mjs --hook')))
  assert.match(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'), /^\.cache$/m)
})
