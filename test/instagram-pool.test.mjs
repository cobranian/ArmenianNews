import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { shortcodeOf, wantedFor, MAX_COUNT } from '../scripts/lib/ig-harvest.mjs'

const pool = JSON.parse(
  await readFile(new URL('../src/data/instagram.json', import.meta.url), 'utf-8'),
)
const exclus = new Set(pool.exclude || [])
const tousLesPosts = pool.accounts.flatMap((a) =>
  (a.posts || []).map((p) => ({ handle: a.handle, code: shortcodeOf(p.url), url: p.url })),
)

test('la liste d exclusion est presente et bien formee', () => {
  assert.ok(Array.isArray(pool.exclude), 'pool.exclude doit etre un tableau')
  assert.equal(pool.exclude.length, exclus.size, 'la liste porte un doublon')
  for (const code of pool.exclude) {
    assert.match(code, /^[\w-]+$/, `shortcode invalide : ${JSON.stringify(code)}`)
  }
})

// LE MODE DE PANNE QUE CE FICHIER EXISTE POUR ATTRAPER. Le site ne relit jamais
// `exclude` — ni selectInstagram, ni Social.jsx — parce qu un filtre ecrit a
// deux endroits finit par diverger. C est donc le SEUL endroit d ou l exclusion
// peut etre verifiee. Une regression de ig-scrape, une edition a la main, ou un
// post exclu qui revient par une autre grille (COLLAB) passeraient sinon
// inapercus : ils produiraient un pool valide, un build vert, et une tuile que
// personne ne voulait.
test('aucun post exclu n est entre dans le pool', () => {
  for (const p of tousLesPosts) {
    assert.ok(!exclus.has(p.code), `@${p.handle} sert ${p.code}, qui est exclu`)
  }
})

// LE QUATRIEME GESTE, ET LE SEUL QUI N ETAIT PAS GARDE. Retirer un post
// demande quatre choses : l ajouter a `exclude`, le retirer des `posts` du
// compte, supprimer son image, ET RE-TIRER LE MUR. Les trois premieres sont
// verifiees ci-dessus et ci-dessous ; la quatrieme ne l etait par rien —
// aucun test ne lisait instagram-feed.json, qui est pourtant le SEUL fichier
// que le site rend (Social.jsx lit `feed.posts`, jamais le pool).
//
// Sauter le re-tirage laisse donc la tuile a l ecran : son image ayant ete
// supprimee, `igImg[shortcode]` vaut undefined et la carte retombe sur son
// motif — mais elle pointe toujours vers le post qu on a demande de retirer.
// Pool valide, lint vert, build vert, 177 tests verts. Et elle y reste
// jusqu au prochain instantane horaire : un push sur `main` ne gratte pas,
// donc « indefiniment » n est pas une figure de style.
test('aucun post exclu ne survit dans le tirage que le site rend', async () => {
  const feed = JSON.parse(
    await readFile(new URL('../src/data/instagram-feed.json', import.meta.url), 'utf-8'),
  )
  for (const p of feed.posts || []) {
    assert.ok(
      !exclus.has(shortcodeOf(p.url)),
      `le mur sert encore ${shortcodeOf(p.url)} (@${p.handle}), qui est exclu ` +
        '— le pool a ete modifie sans re-tirer : lancez npm run ig-select',
    )
  }
})

test('aucune image d un post exclu ne traine dans src/data/ig', async () => {
  const fichiers = await readdir(new URL('../src/data/ig/', import.meta.url))
  for (const f of fichiers.filter((x) => /\.(jpg|webp)$/.test(x))) {
    const code = f.replace(/\.(jpg|webp)$/, '')
    assert.ok(!exclus.has(code), `${f} appartient a un post exclu — poids mort dans le bundle`)
  }
})

// Le glob de Social.jsx et le filtre ci-dessus doivent regarder les MEMES
// extensions. Verrouilles sur des jeux differents, le test passerait au vert
// sur des fichiers que le site ignore — il ne prouverait plus rien.
test('le filtre du test suit le glob de Social.jsx', async () => {
  const src = await readFile(
    new URL('../src/components/Social.jsx', import.meta.url),
    'utf-8',
  )
  assert.match(src, /data\/ig\/\*\.\{jpg,webp\}/)
})

test('chaque post porte une URL dont on sait tirer un shortcode', () => {
  for (const p of tousLesPosts) {
    assert.ok(p.code, `URL illisible : ${p.url} (@${p.handle})`)
  }
})

test('les reglages count sont bien formes', () => {
  for (const acc of pool.accounts) {
    if (!('count' in acc)) continue
    assert.ok(
      acc.count === 'all' || (Number.isInteger(acc.count) && acc.count > 0),
      `@${acc.handle} porte count: ${JSON.stringify(acc.count)} — attendu un entier positif ou 'all'`,
    )
    assert.ok(wantedFor(acc) <= MAX_COUNT)
  }
})

test('les quatre comptes du brin createurs sont la', () => {
  const brin = pool.accounts.filter((a) => a.group === 'createurs').map((a) => a.handle).sort()
  assert.deepEqual(brin, [
    'armenian_women_artists',
    'armeniancreators',
    'naregjewelry',
    'simonian_jewels',
  ])
})

// Le brin createurs va volontairement en PROFONDEUR : catalogue entier pour
// simonian_jewels ('all', 351 posts rendus le 2026-08-06), 300 pour les trois
// autres. C'est une decision demandee, pas un defaut — d'ou ce test, qui n'est
// plus un plafond mais un temoin : ces quatre comptes portent a eux seuls la
// moitie du poids du depot, une derive silencieuse doit se voir.
//
// L'ancien plafond de 120 valait par une extrapolation, et la mesure l'a
// DEMENTIE : il estimait 351 posts a ~45 Mo en projetant les 15,4 Mo des 120
// plus recents. Les 343 images reellement recoltees pesent 12,2 Mo — MOINS que
// les 120 d'avant. Les posts anciens sont bien plus legers (~36 ko de moyenne
// contre ~128), donc la profondeur ne coute pas ce qu'une regle de trois
// annonce. Ne reintroduisez pas un plafond sur la foi d'une projection : les
// quatre comptes se mesurent en une commande (voir CLAUDE.md, section pool).
test('le brin createurs porte ses comptes profonds', () => {
  const attendu = {
    simonian_jewels: 'all',
    armeniancreators: 300,
    armenian_women_artists: 300,
    naregjewelry: 300,
  }
  for (const [handle, count] of Object.entries(attendu)) {
    const acc = pool.accounts.find((a) => a.handle === handle)
    assert.equal(acc.count, count, `@${handle} : count attendu ${count}`)
  }
})

test('maisonlumiere_geneva est dans Ateliers', () => {
  const acc = pool.accounts.find((a) => a.handle === 'maisonlumiere_geneva')
  assert.equal(acc.group, 'creation')
})

test('chaque compte porte handle, name et url', () => {
  for (const acc of pool.accounts) {
    for (const champ of ['handle', 'name', 'url']) {
      assert.ok(acc[champ], `un compte n a pas de ${champ} : ${JSON.stringify(acc.handle)}`)
    }
    // Un identifiant Instagram ne peut pas contenir de tiret : un handle mal
    // saisi renvoie un 404 et fait echouer le compte, sans autre signe.
    assert.match(acc.handle, /^[\w.]+$/, `handle invalide : ${acc.handle}`)
  }
})
