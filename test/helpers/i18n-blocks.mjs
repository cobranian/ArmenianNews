// Les blocs STRINGS de src/i18n.jsx, lus comme du TEXTE : Node ne sait pas
// importer du JSX (ERR_UNKNOWN_FILE_EXTENSION).
//
// Pourquoi un helper : plusieurs tests comptaient les déclarations d'une clé et
// les comparaient à ALL_LANGS.length. Or un bloc peut exister AVANT que sa
// langue soit servie (de/it ont été écrits avant d'être allumés dans
// sites.config.js) : le bon étalon est le nombre de blocs du fichier, et
// ALL_LANGS doit en être un sous-ensemble (test/i18n-parity.test.mjs le garde).
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../../src/i18n.jsx', import.meta.url), 'utf-8').replace(
  /\r\n/g,
  '\n',
)

const debut = SRC.indexOf('const STRINGS = {')
const fin = SRC.indexOf('\nconst LOCALES')
if (debut < 0 || fin < 0) throw new Error('STRINGS introuvable dans src/i18n.jsx')
const CORPS = SRC.slice(debut, fin)

/** { lang: texte du bloc }, dans l'ordre du fichier. */
export const BLOCS = Object.fromEntries(
  [...CORPS.matchAll(/^ {2}([a-z]{2}): \{\n([\s\S]*?)^ {2}\},?$/gm)].map((m) => [m[1], m[2]]),
)

/** Les langues qui ont un bloc STRINGS, dans l'ordre du fichier. */
export const BLOC_LANGS = Object.keys(BLOCS)

/** Les clés déclarées dans un bloc (les `...rubricStrings('x')` à part). */
export const clesDe = (lang) =>
  new Set([...(BLOCS[lang] ?? '').matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]))

/** La valeur littérale d'une clé dans un bloc (apostrophes ou guillemets
 *  droits, sur la même ligne ou la suivante) ; sinon undefined. */
export function valeur(lang, cle) {
  const esc = cle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = (BLOCS[lang] ?? '').match(new RegExp(`'${esc}':\\s*\\n?\\s*(?:'([^']*)'|"([^"]*)")`))
  return m ? (m[1] ?? m[2]) : undefined
}

/** Toutes les valeurs littérales d'un bloc (pour les contrôles d'écriture). */
export const valeursDe = (lang) =>
  [...(BLOCS[lang] ?? '').matchAll(/^\s*'[^']+':\s*\n?\s*(?:'([^']*)'|"([^"]*)")/gm)].map(
    (m) => m[1] ?? m[2],
  )
