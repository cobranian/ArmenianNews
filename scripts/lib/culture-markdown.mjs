// scripts/lib/culture-markdown.mjs
//
// Le format des articles Culture : un front-matter « clé: valeur » et un
// Markdown VOLONTAIREMENT restreint (paragraphes, ##/###, gras, italique,
// liens https ou internes). Pas de dépendance, et surtout : tout HTML écrit
// dans le texte est échappé. Un texte collé dans une PR, ou une réponse de
// modèle qui glisse un <script>, ne peut rien injecter dans la page.
import { createHash } from 'node:crypto'

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FM = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/

export function parseFrontMatter(text) {
  // Un BOM en tête (fichier enregistré par Windows) n'est pas du contenu.
  let s = String(text ?? '')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  const m = s.match(FM)
  if (!m) throw new Error('front-matter absent (le fichier doit commencer par ---)')
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue
    const i = line.indexOf(':')
    if (i <= 0) throw new Error(`ligne de front-matter illisible : « ${line} »`)
    let v = line.slice(i + 1).trim()
    if (v.startsWith('"')) {
      try {
        v = JSON.parse(v)
      } catch {
        throw new Error(`ligne de front-matter illisible (guillemets) : « ${line} »`)
      }
    }
    data[line.slice(0, i).trim()] = String(v)
  }
  return { data, body: (m[2] ?? '').replace(/\r\n/g, '\n').trim() }
}

export function serializeFrontMatter(data, body) {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(String(v))}`)
  return `---\n${lines.join('\n')}\n---\n\n${String(body).replace(/\r\n/g, '\n').trim()}\n`
}

// Liens : https:// ou chemin interne (« / » non suivi d'un second « / », qui
// serait une URL protocole-relative vers un autre hôte).
const LINK = /\[([^\]\n]+)\]\((https:\/\/[^)\s]+|\/(?!\/)[^)\s]*)\)/g

function inline(s) {
  return esc(s)
    .replace(LINK, (_, text, href) =>
      href.startsWith('/') ? `<a href="${href}">${text}</a>` : `<a href="${href}" rel="noopener">${text}</a>`,
    )
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
}

export function renderMarkdown(md) {
  return String(md ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const h = !b.includes('\n') && b.match(/^(#{1,3})[ \t]+(.+)$/)
      if (h) {
        const n = Math.max(2, h[1].length)
        return `<h${n}>${inline(h[2])}</h${n}>`
      }
      return `<p>${inline(b.replace(/\n/g, ' '))}</p>`
    })
    .join('\n')
}

// L'empreinte du corps français : chaque traduction la porte (`sourceHash`).
// Si le français change après la traduction, l'empreinte ne correspond plus
// et la traduction est déclarée périmée.
export function bodyHash(body) {
  return createHash('sha256')
    .update(String(body ?? '').replace(/\r\n/g, '\n').trim())
    .digest('hex')
    .slice(0, 16)
}
