import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pending, hookMessage, postText, adminUrl, LINKEDIN_CHANNELS, LINKEDIN_SHOWCASE } from '../scripts/lib/linkedin-pending.mjs'
import { SITES, socialFor } from '../sites.config.js'
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
// Les deux Pages principales (fr, en) ; les vitrines ont leurs tests plus bas.
const PAGES = LINKEDIN_CHANNELS.filter((c) => !c.showcase)

test('les canaux LinkedIn : les deux Pages, puis une vitrine par langue qui en déclare une', () => {
  assert.deepEqual(LINKEDIN_CHANNELS.map((c) => c.id), ['linkedin-ch', 'linkedin-org', 'linkedin-de', 'linkedin-it', 'linkedin-es', 'linkedin-hy', 'linkedin-ru'])
})

// Une vitrine liée au pied de page sans id d'administration n'aurait aucune
// file de publication — et l'inverse publierait sur une page que le site ne
// cite pas. Les deux vont ensemble.
test('vitrines : lien du pied de page ⇔ id d’administration', () => {
  for (const site of Object.values(SITES))
    for (const p of site.pages) {
      const url = socialFor(site.id, p.lang).linkedin
      const isShowcase = /\/showcase\//.test(url)
      assert.equal(isShowcase, p.lang in LINKEDIN_SHOWCASE, `${p.lang} : vitrine au pied de page sans id, ou id sans vitrine`)
    }
  for (const c of LINKEDIN_CHANNELS.filter((x) => x.showcase)) {
    assert.equal(c.siteId, ['de', 'it'].includes(c.lang) ? 'ch' : 'org', c.id)
    assert.equal(adminUrl(c), `https://www.linkedin.com/showcase/${LINKEDIN_SHOWCASE[c.lang]}/admin/dashboard/`)
  }
  assert.equal(adminUrl(LINKEDIN_CHANNELS[0]), 'https://www.linkedin.com/company/146900320/admin/dashboard/')
})

test('vitrine neuve : comme une Page, amorce l’archive de SA langue et propose son dernier article', () => {
  const de = [item('a', '2026-10-01', 'de'), item('b', '2026-10-02', 'de'), item('c', '2026-10-03')]
  const r = pending({ items: de, ledger: emptyLedger(), kinds, channels: LINKEDIN_CHANNELS.filter((c) => c.id === 'linkedin-de') })
  assert.deepEqual(r.posts.map((p) => `${p.channel}/${p.item.id}/${p.item.lang}`), ['linkedin-de/culture:b/de'])
})

test('les vitrines restent hors du job horaire', async () => {
  const { CHANNELS } = await import('../scripts/lib/social.mjs')
  for (const c of LINKEDIN_CHANNELS.filter((x) => x.showcase)) assert.ok(!CHANNELS.some((x) => x.id === c.id), c.id)
})

// Une page neuve : l'archive est amorcée, sauf le dernier article, proposé.
test('premier passage : amorce l’archive, propose le dernier article seulement', () => {
  const r = pending({ items, ledger: emptyLedger(), kinds, channels: PAGES })
  assert.deepEqual(r.seeded.sort(), ['linkedin-ch', 'linkedin-org'])
  assert.deepEqual(r.posts.map((p) => `${p.channel}/${p.item.id}`).sort(), ['linkedin-ch/culture:b', 'linkedin-org/culture:b'])
  assert.deepEqual(Object.keys(r.ledger.channels['linkedin-ch'].posted), ['culture:a'])
})

// Proposer n'est pas publier : tant que --mark n'a pas noté le post, il revient.
test('une proposition ne marque rien : elle revient à la session suivante', () => {
  const first = pending({ items, ledger: emptyLedger(), kinds, channels: PAGES })
  const again = pending({ items, ledger: first.ledger, kinds, channels: PAGES })
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

// WhatsApp : même rappel, canaux sans secret, hors de CHANNELS (le job horaire
// ne doit jamais tenter d'y publier).
test('WhatsApp : canaux manuels, hors du job horaire, rappel distinct', async () => {
  const { WHATSAPP_CHANNELS } = await import('../scripts/lib/linkedin-pending.mjs')
  const { CHANNELS } = await import('../scripts/lib/social.mjs')
  assert.deepEqual(WHATSAPP_CHANNELS.map((c) => c.id), ['whatsapp-ch', 'whatsapp-org', 'whatsapp-de', 'whatsapp-it', 'whatsapp-es', 'whatsapp-hy', 'whatsapp-ru'])
  for (const c of WHATSAPP_CHANNELS) assert.match(c.url, /^https:\/\/whatsapp\.com\/channel\/[A-Za-z0-9]+$/, c.id)
  assert.ok(!CHANNELS.some((c) => c.platform === 'whatsapp'))
  const r = pending({ items, ledger: emptyLedger(), kinds, channels: WHATSAPP_CHANNELS.filter((c) => ['fr', 'en'].includes(c.lang)) })
  assert.deepEqual(r.posts.map((p) => `${p.channel}/${p.item.id}`).sort(), ['whatsapp-ch/culture:b', 'whatsapp-org/culture:b'])
})

test('postText marque le lien du réseau qui le publie', () => {
  assert.match(postText(item('b', '2026-10-02'), 'whatsapp'), /utm_source=whatsapp&utm_medium=social$/)
})

test('le hook sépare LinkedIn et WhatsApp', () => {
  const msg = hookMessage([
    { channel: 'linkedin-ch', item: item('b', '2026-10-02') },
    { channel: 'whatsapp-org', item: item('b', '2026-10-02', 'en') },
  ])
  assert.match(msg, /RAPPEL LINKEDIN : 1 publication/)
  assert.match(msg, /RAPPEL WHATSAPP : 1 publication.*\n- whatsapp-org \(Armenia News\)/)
  assert.match(msg, /publier-whatsapp/)
})

// Un Reel est une vidéo pour Facebook et Instagram : jamais proposé à la main
// sur LinkedIn ni WhatsApp, même comme « dernier article » d'un canal neuf.
test('un Reel n’est jamais proposé sur LinkedIn ni WhatsApp', async () => {
  const { MANUAL_CHANNELS } = await import('../scripts/lib/linkedin-pending.mjs')
  const reel = (lang) => ({ ...item('z', '2026-11-05', lang), id: 'reel:z', kind: 'reel', video: { url: 'https://x/fr-z.mp4', music: '♪' } })
  const all = [...items, reel('fr'), reel('en')]
  const r = pending({ items: all, ledger: emptyLedger(), kinds: ['culture', 'reel'], channels: MANUAL_CHANNELS })
  assert.ok(r.posts.length > 0)
  assert.ok(!r.posts.some((p) => p.item.kind === 'reel'))
  const again = pending({ items: all, ledger: r.ledger, kinds: ['culture', 'reel'], channels: MANUAL_CHANNELS })
  assert.ok(!again.posts.some((p) => p.item.kind === 'reel'))
})
