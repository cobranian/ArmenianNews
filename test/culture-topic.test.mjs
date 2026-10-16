import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  availableTopics, agendaMatch, pickTopic, setTopicStatus, validateTopics, WINDOW_DAYS,
} from '../scripts/lib/culture-topic.mjs'

const NOW = new Date('2026-10-19T08:00').getTime()
const day = (n) => new Date(NOW + n * 86400000).toISOString().slice(0, 16)
const T = (slug, keywords = [slug], status = 'pending') => ({ slug, title: slug, wikipedia: { fr: slug }, keywords, status })
const ev = (title, d, url = `https://e/${title}`) => ({ title, date: day(d), url, location: 'Genève' })

test('availableTopics : pending, sans PR ouverte, sans dossier existant', () => {
  const topics = [T('a'), T('b', ['b'], 'published'), T('c'), T('d'), T('e', ['e'], 'rejected')]
  assert.deepEqual(
    availableTopics(topics, { openBranches: ['culture/c', 'main'], existing: ['d'] }).map((t) => t.slug),
    ['a'],
  )
})

test('agendaMatch : mot-clé plié, fenêtre de 21 jours, passé ignoré', () => {
  const agenda = { switzerland: [ev('Concert de DUDUK', 5)], world: [ev('Duduk à Paris', -2), ev('Doudouk', WINDOW_DAYS + 1)] }
  assert.equal(agendaMatch(T('duduk', ['duduk', 'doudouk']), agenda, NOW).title, 'Concert de DUDUK')
  assert.equal(agendaMatch(T('komitas'), agenda, NOW), null)
  assert.equal(agendaMatch(T('x', []), agenda, NOW), null)
  assert.equal(agendaMatch(T('kochari', ['kotchari']), { switzerland: [ev('Soirée Kotchari', 3)] }, NOW).title, 'Soirée Kotchari')
  assert.equal(agendaMatch(T('ete', ['été']), { world: [ev('Fête de l’ETE', 1)] }, NOW).title, 'Fête de l’ETE')
})

test('pickTopic : le sujet de l’événement le plus proche passe devant la liste', () => {
  const topics = [T('komitas'), T('duduk'), T('kochari')]
  const agenda = { switzerland: [ev('Duduk', 10), ev('Kochari', 4)] }
  const got = pickTopic({ topics, agenda, now: NOW })
  assert.equal(got.topic.slug, 'kochari')
  assert.equal(got.event.title, 'Kochari')
})

test('pickTopic : sans événement, le premier disponible ; sans sujet, null', () => {
  assert.deepEqual(pickTopic({ topics: [T('a'), T('b')], agenda: null, now: NOW }), { topic: T('a'), event: null })
  assert.equal(pickTopic({ topics: [T('a', ['a'], 'published')], agenda: null, now: NOW }), null)
})

test('setTopicStatus', () => {
  const f = { topics: [T('a'), T('b')] }
  assert.equal(setTopicStatus(f, 'b', 'rejected').topics[1].status, 'rejected')
  assert.equal(f.topics[1].status, 'pending', 'pas de mutation')
  assert.throws(() => setTopicStatus(f, 'z', 'published'), /inconnu/)
  assert.throws(() => setTopicStatus(f, 'a', 'drafted'), /statut/)
})

test('validateTopics : doublon, slug, statut, sources, mots-clés', () => {
  const errs = validateTopics({ topics: [T('a'), T('a'), { ...T('B') }, { ...T('c'), status: 'x' }, { ...T('d'), wikipedia: {} }, { ...T('e'), keywords: 'e' }] })
  assert.equal(errs.length, 5, errs.join('\n'))
  assert.deepEqual(validateTopics({ topics: 'x' }), ['sujets.json : « topics » doit être un tableau'])
})

test('src/data/culture/sujets.json est valide', async () => {
  const file = JSON.parse(await readFile(new URL('../src/data/culture/sujets.json', import.meta.url), 'utf-8'))
  assert.deepEqual(validateTopics(file), [])
  assert.ok(file.topics.length >= 12)
})
