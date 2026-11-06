// `npm run videos:add` écrit la trace des Shorts publiés (culture-videos.json).
// Gardé ici : le titre perd son mot-dièse et la description ses liens comme
// sur YouTube ; relancer est sans danger ; un AUTRE id ne remplace jamais une
// vidéo en silence ; une entrée invalide ne s'écrit pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addVideos, entryFromMeta, parseIdLines } from '../scripts/lib/videos-add.mjs'

const meta = {
  title: 'Ani, die «Stadt der tausendundein Kirchen» #Armenien',
  description: 'Im 10. Jahrhundert Hauptstadt der Bagratiden.\n\nGanzer Artikel: https://armenieinfo.ch/de/kultur/ani/\n\nMusik: …',
}
const entry = entryFromMeta(meta, { youtube: 'ke_0o2hQngU', uploadDate: '2026-11-06' })

test('entryFromMeta : titre sans mot-dièse, premier paragraphe seulement', () => {
  assert.equal(entry.title, 'Ani, die «Stadt der tausendundein Kirchen»')
  assert.equal(entry.description, 'Im 10. Jahrhundert Hauptstadt der Bagratiden.')
  assert.equal(entry.duration, 'PT44S')
})

test('addVideos : ajoute sans muter, puis saute le même id', () => {
  const before = { ani: { fr: { ...entry, youtube: 'ifDRu53h9sI' } } }
  const one = addVideos(before, [{ slug: 'ani', lang: 'de', entry }])
  assert.deepEqual(one.added, ['ani/de'])
  assert.equal(before.ani.de, undefined)
  const again = addVideos(one.videos, [{ slug: 'ani', lang: 'de', entry }])
  assert.deepEqual(again.added, [])
  assert.deepEqual(again.skipped, ['ani/de'])
})

test('addVideos : un autre id ne remplace qu’avec force', () => {
  const v = { ani: { de: entry } }
  const other = { ...entry, youtube: 'AAAAAAAAAAA' }
  assert.throws(() => addVideos(v, [{ slug: 'ani', lang: 'de', entry: other }]), /--force/)
  assert.equal(addVideos(v, [{ slug: 'ani', lang: 'de', entry: other }], { force: true }).videos.ani.de.youtube, 'AAAAAAAAAAA')
})

test('addVideos : une entrée invalide est refusée', () => {
  assert.throws(() => addVideos({}, [{ slug: 'ani', lang: 'de', entry: { ...entry, youtube: 'court' } }]), /invalide/)
})

test('parseIdLines : lit le format des ids-*.txt, refuse une ligne bancale', () => {
  assert.deepEqual(parseIdLines('ani ke_0o2hQngU\r\n\n# note\nduduk BGEfPZK4JtU\n'), [
    { slug: 'ani', youtube: 'ke_0o2hQngU' },
    { slug: 'duduk', youtube: 'BGEfPZK4JtU' },
  ])
  assert.throws(() => parseIdLines('ani'), /illisible/)
})
