import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CHANNELS,
  credentials,
  secretNames,
  parseKinds,
  plan,
  compose,
  cultureItems,
  briefItems,
  fitsInstagram,
  escapeLittleText,
  oauth1Header,
  redact,
} from '../scripts/lib/social.mjs'
import { send } from '../scripts/lib/social-send.mjs'

const culture = (slug, date, image = { width: 1200, height: 868, author: 'USSR Post', license: 'Public domain' }) => ({
  id: `culture:${slug}`,
  kind: 'culture',
  lang: 'fr',
  date,
  url: `https://armenieinfo.ch/culture/${slug}/`,
  title: `Titre ${slug}`,
  description: `Description ${slug}`,
  image: image && { url: `https://armenieinfo.ch/culture/${slug}/image.jpg`, ...image },
})
const fb = CHANNELS.find((c) => c.id === 'facebook-ch')
const ig = CHANNELS.find((c) => c.id === 'instagram-ch')
const now = new Date('2026-10-25T10:00:00Z')

test('un canal neuf est AMORCÉ : rien de l’archive ne part', () => {
  const items = [culture('komitas', '2026-10-01'), culture('duduk', '2026-10-02')]
  const r = plan({ items, channels: [fb], ledger: null, kinds: ['culture'], now })
  assert.deepEqual(r.posts, [])
  assert.deepEqual(r.seeded, ['facebook-ch'])
  assert.deepEqual(Object.keys(r.ledger.channels['facebook-ch'].posted).sort(), ['culture:duduk', 'culture:komitas'])
})

test('seul le nouveau part, une fois, au plus MAX_PER_RUN par canal', () => {
  const seeded = plan({ items: [culture('komitas', '2026-10-01')], channels: [fb], ledger: null, kinds: ['culture'], now })
  const items = [culture('komitas', '2026-10-01'), culture('a', '2026-10-20'), culture('b', '2026-10-21'), culture('c', '2026-10-22')]
  const r1 = plan({ items, channels: [fb], ledger: seeded.ledger, kinds: ['culture'], now })
  assert.deepEqual(r1.posts.map((p) => p.item.id), ['culture:a', 'culture:b'])
  const r2 = plan({ items, channels: [fb], ledger: r1.ledger, kinds: ['culture'], now })
  assert.deepEqual(r2.posts.map((p) => p.item.id), ['culture:c'])
  const r3 = plan({ items, channels: [fb], ledger: r2.ledger, kinds: ['culture'], now })
  assert.deepEqual(r3.posts, [])
})

test('le plan ne mute pas le registre reçu', () => {
  const ledger = { version: 1, channels: { 'facebook-ch': { seededAt: 'x', posted: {} } } }
  plan({ items: [culture('a', '2026-10-20')], channels: [fb], ledger, kinds: ['culture'], now })
  assert.deepEqual(ledger.channels['facebook-ch'].posted, {})
})

test('la brève ne part que si demandée, et seulement fraîche', () => {
  const brief = (date) => ({ id: `brief:${date}`, kind: 'brief', lang: 'fr', date, url: 'u', title: 't', description: 'd', image: null })
  const ledger = { version: 1, channels: { 'facebook-ch': { seededAt: 'x', posted: {} } } }
  const items = [brief('2026-10-20'), brief('2026-10-24'), brief('2026-10-25')]
  assert.deepEqual(plan({ items, channels: [fb], ledger, kinds: ['culture'], now }).posts, [])
  const r = plan({ items, channels: [fb], ledger, kinds: ['culture', 'brief'], now })
  assert.deepEqual(r.posts.map((p) => p.item.id), ['brief:2026-10-24', 'brief:2026-10-25'])
})

test('Instagram exige une image au bon format', () => {
  assert.equal(fitsInstagram({ width: 1200, height: 868 }), true)
  assert.equal(fitsInstagram({ width: 800, height: 1400 }), false)
  assert.equal(fitsInstagram(null), false)
  const ledger = { version: 1, channels: { 'instagram-ch': { seededAt: 'x', posted: {} } } }
  const items = [culture('sans', '2026-10-20', null), culture('haut', '2026-10-21', { width: 600, height: 1200 }), culture('ok', '2026-10-22')]
  assert.deepEqual(plan({ items, channels: [ig], ledger, kinds: ['culture'], now }).posts.map((p) => p.item.id), ['culture:ok'])
})

test('les canaux ne sont actifs qu’avec TOUS leurs secrets', () => {
  assert.equal(credentials(fb, { FB_PAGE_ID_CH: '1' }), null)
  assert.equal(credentials(fb, { FB_PAGE_ID_CH: '1', FB_PAGE_TOKEN_CH: '  ' }), null)
  assert.deepEqual(credentials(fb, { FB_PAGE_ID_CH: '1', FB_PAGE_TOKEN_CH: 'tok' }), { pageId: '1', token: 'tok' })
  assert.equal(new Set(CHANNELS.map((c) => c.id)).size, CHANNELS.length)
})

test('chaque secret est déclaré dans le job social de hourly.yml', () => {
  const yml = readFileSync(new URL('../.github/workflows/hourly.yml', import.meta.url), 'utf8')
  for (const name of secretNames()) assert.match(yml, new RegExp(`${name}: \\$\\{\\{ secrets\\.${name} \\}\\}`), name)
})

test('SOCIAL_KINDS : culture par défaut, valeur inconnue refusée', () => {
  assert.deepEqual(parseKinds(undefined), ['culture'])
  assert.deepEqual(parseKinds('culture, brief'), ['culture', 'brief'])
  assert.throws(() => parseKinds('tout'))
})

test('X : 280 au plus, l’URL comptée 23', () => {
  const long = { ...culture('x', '2026-10-20'), title: 'T'.repeat(400), description: 'D'.repeat(400) }
  const { text } = compose('x', long)
  assert.ok(text.endsWith('\n\nhttps://armenieinfo.ch/culture/x/'))
  const body = text.slice(0, text.lastIndexOf('\n\n'))
  assert.ok(body.length + 2 + 23 <= 280, `${body.length}`)
  assert.ok(body.endsWith('…'))
})

test('Instagram : crédit de l’image et lien lisible dans la légende', () => {
  const { caption, imageUrl } = compose('instagram', culture('komitas', '2026-10-20'))
  assert.match(caption, /Image : USSR Post, Public domain/)
  assert.match(caption, /armenieinfo\.ch\/culture\/komitas\//)
  assert.equal(imageUrl, 'https://armenieinfo.ch/culture/komitas/image.jpg')
})

test('Instagram : deux-points à l’anglaise en anglais, à la française en français', () => {
  const en = compose('instagram', { ...culture('komitas', '2026-10-20'), lang: 'en' }).caption
  assert.match(en, /Full article: /)
  assert.match(en, /Image: USSR Post/)
  assert.doesNotMatch(en, / : /)
  const fr = compose('instagram', culture('komitas', '2026-10-20')).caption
  assert.match(fr, /Article complet : /)
})

test('LinkedIn : les caractères réservés sont échappés', () => {
  assert.equal(escapeLittleText('Komitas (1869) #musique @x'), 'Komitas \\(1869\\) \\#musique \\@x')
})

// Le vecteur de la documentation de X (« Creating a signature »).
test('OAuth 1.0a : signature du vecteur officiel de X', () => {
  const h = oauth1Header(
    {
      method: 'POST',
      url: 'https://api.twitter.com/1.1/statuses/update.json',
      params: { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
    },
    {
      apiKey: 'xvz1evFS4wEEPTGEFPHBog',
      apiSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
      accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
      accessSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
    },
    { nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', timestamp: 1318622958 },
  )
  assert.match(h, /oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"/)
})

test('redact retire les secrets d’un message d’erreur', () => {
  assert.equal(redact('bad token EAAB123456 here', ['EAAB123456']), 'bad token *** here')
})

test('les éléments viennent des articles publiés, URL et image sur le bon domaine', () => {
  const a = {
    slug: 'komitas',
    date: '2026-10-20',
    image: { width: 1200, height: 868, author: 'A', license: 'CC BY-SA 4.0' },
    langs: { fr: { title: 'Komitas', description: 'd' }, en: { title: 'Komitas', description: 'e' } },
  }
  const [fr, en] = cultureItems([a])
  assert.equal(fr.url, 'https://armenieinfo.ch/culture/komitas/')
  assert.equal(en.url, 'https://armenianews.org/culture/komitas/')
  assert.equal(en.image.url, 'https://armenianews.org/culture/komitas/image.jpg')
  const [b] = briefItems({ fr: [{ date: '2026-10-25', topics: [{ title: 'Un' }, { title: 'Deux' }] }], en: [] })
  assert.equal(b.url, 'https://armenieinfo.ch/breve/2026-10-25/')
  assert.equal(b.description, '• Un\n• Deux')
})

// La clé posée dans FB_PAGE_TOKEN_* a été, à la mise en place, une clé
// UTILISATEUR : la Page répond alors 403 (#200). L'envoi dérive la clé de Page.
test('send : Facebook dérive la clé de Page, aucune clé dans une URL', async () => {
  const calls = []
  const fakeFetch = async (url, init = {}) => {
    calls.push({ url, init })
    if (url.endsWith('?fields=access_token')) return new Response(JSON.stringify({ access_token: 'PAGE-SECRET' }), { status: 200 })
    return new Response(JSON.stringify({ id: '1_2' }), { status: 200 })
  }
  const id = await send(fb, culture('komitas', '2026-10-20'), { pageId: '42', token: 'USER-SECRET' }, { fetch: fakeFetch })
  assert.equal(id, '1_2')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].init.headers.authorization, 'Bearer USER-SECRET')
  assert.match(calls[1].url, /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/42\/feed$/)
  assert.match(calls[1].init.body, /access_token=PAGE-SECRET/)
  for (const c of calls) assert.ok(!c.url.includes('SECRET'), c.url)
})

test('send : si la dérivation échoue, la clé reçue sert telle quelle', async () => {
  const bodies = []
  const fakeFetch = async (url, init = {}) => {
    if (url.endsWith('?fields=access_token')) return new Response('{"error":{"message":"x"}}', { status: 400 })
    bodies.push(init.body)
    return new Response(JSON.stringify({ id: '9' }), { status: 200 })
  }
  await send(fb, culture('a', '2026-10-20'), { pageId: '1', token: 'PAGE-TOKEN' }, { fetch: fakeFetch })
  assert.match(bodies[0], /access_token=PAGE-TOKEN/)
})

test('send : une erreur d’API remonte avec son statut', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token' } }), { status: 400 })
  await assert.rejects(send(fb, culture('a', '2026-10-20'), { pageId: '1', token: 't' }, { fetch: fakeFetch }), /HTTP 400 Invalid OAuth/)
})
