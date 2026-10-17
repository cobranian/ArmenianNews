#!/usr/bin/env node
/**
 * Applique un « /ajoute 1 4 7 » ou « /rejette 2 3 » du propriétaire à l'issue
 * « Culture : idées de sujets ».
 *
 *   node scripts/culture-ideas.mjs --comment commentaire.md --issue-body corps.md \
 *     --out-body nouveau-corps.md --out-reply reponse.md --out-done fini \
 *     [--sujets src/data/culture/sujets.json]
 *
 * Appelé par articles-ideas.yml sur main. Les idées ajoutées entrent dans
 * sujets.json (`pending`) ; le corps de l'issue est réécrit (JSON à jour,
 * lignes traitées barrées) ; `--out-done` n'est écrit que s'il ne reste plus
 * aucune idée proposée — le workflow ferme alors l'issue.
 *
 * Commentaire qui n'est pas une commande : sortie 0, rien de modifié, une
 * réponse d'aide (ni corps, ni sujets.json, ni « fini »).
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { parseIdeaCommand, readIdeas, applyIdeaCommand, writeIdeas, IDEAS_HELP_REPLY } from './lib/culture-commands.mjs'
import { validateTopics } from './lib/culture-topic.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({
  options: {
    comment: { type: 'string' },
    'issue-body': { type: 'string' },
    sujets: { type: 'string', default: path.join(root, 'src/data/culture/sujets.json') },
    'out-body': { type: 'string' },
    'out-reply': { type: 'string' },
    'out-done': { type: 'string' },
  },
})
for (const k of ['comment', 'issue-body', 'out-body', 'out-reply', 'out-done'])
  if (!values[k]) throw new Error(`usage : culture-ideas --${k} <fichier> (manquant)`)

const cmd = parseIdeaCommand(await readFile(values.comment, 'utf-8'))
if (!cmd) {
  console.log('Pas de commande /ajoute ou /rejette avec des numéros : rien à faire.')
  await writeFile(values['out-reply'], IDEAS_HELP_REPLY)
  process.exit(0)
}

const body = await readFile(values['issue-body'], 'utf-8')
const sujets = JSON.parse(await readFile(values.sujets, 'utf-8'))
const r = applyIdeaCommand({ ideas: readIdeas(body), sujets, cmd })
// Un sujet invalide casserait le brouillon de la nuit : on refuse d'écrire.
const errs = validateTopics(r.sujets)
if (errs.length) {
  await writeFile(values['out-reply'], `❌ Rien n'a été ajouté : sujets.json serait invalide.\n\n${errs.map((e) => `- ${e}`).join('\n')}\n`)
  console.error(errs.join('\n'))
  process.exit(1)
}

await writeFile(values.sujets, `${JSON.stringify(r.sujets, null, 2)}\n`)
await writeFile(values['out-body'], writeIdeas(body, r.ideas))
await writeFile(values['out-reply'], r.reply)
if (r.done) await writeFile(values['out-done'], '1')
console.log(r.reply)
