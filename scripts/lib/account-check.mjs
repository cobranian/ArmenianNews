// Le contrôle des comptes sociaux, SANS rien publier : chaque compte se
// connecte et lit son nom (verify), la clé Facebook dit ses droits et son
// échéance (tokenHealth), chaque Instagram son quota (instagramQuota).
// Partagé par `social-post.mjs check` et le tableau de bord
// (scripts/publication-check.mjs).
import { CHANNELS, credentials, redact } from './social.mjs'
import { verify, tokenHealth, instagramQuota } from './social-send.mjs'

// En deçà, l'échéance d'une clé devient une alerte : de quoi la renouveler
// sans panne (la procédure : docs/social-setup.md).
export const TOKEN_WARN_DAYS = 14

// Rend { accounts: [{ channel, who?, problem?, warning? }], tokens: [{ secret,
// channels, expiresAt, missing, problem?, warning? }] }.
export async function checkAccounts(env = process.env, { fetch: f = fetch, now = new Date() } = {}) {
  const accounts = []
  const fbTokens = new Map() // valeur de la clé → { secret, channels }
  for (const channel of CHANNELS) {
    const creds = credentials(channel, env)
    if (!creds) continue
    const secrets = Object.values(creds)
    const row = { channel: channel.id }
    try {
      const who = await verify(channel, creds, { fetch: f })
      row.who = who ?? '(non vérifiable : pas de lecture gratuite)'
    } catch (e) {
      row.problem = redact(e.message, secrets)
    }
    if (channel.platform === 'instagram' && !row.problem) {
      try {
        const q = await instagramQuota(creds, { fetch: f })
        row.who += ` · quota ${q.used}/${q.total ?? '?'} sur 24 h`
        if (q.total && q.used >= q.total * 0.8) row.warning = `quota Instagram presque atteint (${q.used}/${q.total})`
      } catch (e) {
        row.warning = `quota illisible — droit de publication à vérifier (${redact(e.message, secrets)})`
      }
    }
    if (channel.platform === 'facebook' || channel.platform === 'instagram') {
      const t = fbTokens.get(creds.token) ?? { secret: channel.env.token, channels: [] }
      t.channels.push(channel.id)
      fbTokens.set(creds.token, t)
    }
    accounts.push(row)
  }

  const tokens = []
  for (const [value, t] of fbTokens) {
    const row = { secret: t.secret, channels: t.channels, expiresAt: null, missing: [] }
    // Les droits exigés suivent les comptes que la clé sert : une clé qui ne
    // sert que Facebook n'a pas besoin de publier sur Instagram.
    const need = new Set(['pages_manage_posts'])
    if (t.channels.some((c) => c.startsWith('instagram-'))) need.add('instagram_content_publish')
    let health
    try {
      health = await tokenHealth(value, { fetch: f })
    } catch (e) {
      // Une clé que Meta dit invalide est un problème ; une API muette, un doute.
      if (/clé invalide/.test(e.message)) row.problem = redact(e.message, [value])
      else row.warning = `échéance illisible (${redact(e.message, [value])})`
      tokens.push(row)
      continue
    }
    Object.assign(row, health, { missing: health.missing.filter((s) => need.has(s)) })
    if (row.missing.length) row.problem = `droits manquants : ${row.missing.join(', ')} — la publication échouera`
    else if (row.expiresAt) {
      const days = Math.floor((row.expiresAt - now) / 86_400_000)
      if (days < 0) row.problem = `clé expirée le ${row.expiresAt.toISOString().slice(0, 10)}`
      else if (days <= TOKEN_WARN_DAYS) row.warning = `clé expire dans ${days} jour(s), le ${row.expiresAt.toISOString().slice(0, 10)}`
    }
    tokens.push(row)
  }
  return { accounts, tokens }
}
