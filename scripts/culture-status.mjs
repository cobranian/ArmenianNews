#!/usr/bin/env node
// Change le statut d'un sujet : `npm run culture:status -- komitas rejected`.
// Utilisé par articles-closed.yml quand une PR est fermée sans fusion.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTopicStatus } from './lib/culture-topic.mjs'

const [slug, status] = process.argv.slice(2)
if (!slug || !status) throw new Error('usage : culture-status <slug> <pending|published|rejected>')
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/culture/sujets.json')
const sujets = JSON.parse(await readFile(file, 'utf-8'))
await writeFile(file, `${JSON.stringify(setTopicStatus(sujets, slug, status), null, 2)}\n`)
console.log(`${slug} → ${status}`)
