// Le tableau de bord de la publication : la partie PURE. Reçoit les mesures
// (scripts/publication-check.mjs les prend), rend le texte de l'issue
// épinglée et la liste des alertes.
//
// Pourquoi il existe (2 nov. 2026) : le crédit Gemini était à zéro et le
// propriétaire l'a appris en dernier, par une séance de Claude Code. Chaque
// panne avait déjà sa trace quelque part (un job rouge, un ✗ au log, un
// commentaire de PR), mais aucune ne lui parvenait. Ici, tout ce qui peut
// arrêter un article sur son chemin vers les lecteurs tient sur une page, et
// tout ce qui demande d'AGIR lui est notifié.
//
// Trois niveaux : `bloquant` (rien ne part tant que ce n'est pas réglé),
// `faire` (ça part encore, mais une action est due), `ok`. Plus `info`, qui
// ne déclenche rien.

export const DASHBOARD_TITLE = '[tableau-de-bord] Publication des articles'
const ICON = { bloquant: '🔴', faire: '🟠', ok: '✅', info: 'ℹ️' }

// Les échéances qu'aucune API ne dit. Une ligne par secret qui expire.
// À tenir à jour à chaque renouvellement.
export const DEADLINES = [
  {
    key: 'gh-token-worker',
    what: 'Jeton GitHub du Worker `hourly-trigger` (GH_TOKEN)',
    date: '2027-10-18',
    how: 'GitHub → Settings → Developer settings → Fine-grained tokens, puis `wrangler secret put GH_TOKEN` (proxy/)',
  },
]
export const DEADLINE_WARN_DAYS = 30
// Une PR Culture qui attend plus longtemps retient la file : au plus deux en
// relecture, donc plus aucun brouillon.
export const PR_WAIT_DAYS = 3
// Le brouillon tourne chaque nuit : sans succès depuis 48 h, deux nuits sont
// perdues.
export const DRAFT_STALE_HOURS = 48

const days = (a, b) => Math.floor((a - b) / 86_400_000)

// --- Les vérifications : chacune rend des lignes { key, level, text, action? }

export function checkModels({ primary, fallbacks }) {
  const out = []
  const anyFallback = fallbacks.some((f) => f.ok)
  if (primary.ok) out.push({ key: 'llm-primary', level: 'ok', text: `${primary.label} répond (\`${primary.model}\`)` })
  else
    out.push({
      key: `llm-primary-${primary.status ?? 'ko'}`,
      level: anyFallback ? 'faire' : 'bloquant',
      text: `${primary.explain}${anyFallback ? ' — les articles passent par le modèle de secours en attendant' : ' — ET aucun modèle de secours ne répond : plus de brouillon ni de traduction'}`,
      action: primary.status === 402 ? 'Recharger le crédit prépayé Gemini (Google AI Studio → Facturation)' : 'Vérifier la clé GEMINI_API_KEY',
    })
  for (const f of fallbacks)
    out.push({
      key: `llm-fallback-${f.model}`,
      level: f.ok ? 'ok' : 'info',
      text: f.ok ? `Secours \`${f.model}\` répond` : `Secours \`${f.model}\` : ${f.explain}`,
    })
  if (primary.ok && !anyFallback)
    out.push({
      key: 'llm-no-fallback',
      level: 'faire',
      text: 'Aucun modèle de secours ne répond : si Gemini tombe, plus rien ne part',
      action: 'Remplacer les modèles de CULTURE_FALLBACK_MODELS (scripts/lib/culture-llm.mjs) par des :free vivants',
    })
  return out
}

// Le dernier passage concluant d'un workflow. `runs` : la réponse de l'API
// (plus récent d'abord). Un run en cours dont un job a déjà échoué compte : le
// tableau de bord est justement relancé par l'étape d'échec de ce run.
export function lastOutcome(runs = []) {
  for (const r of runs) {
    if (r.status !== 'completed') {
      if (r.failedJob) return { conclusion: 'failure', at: r.created_at, url: r.html_url }
      continue
    }
    if (r.conclusion === 'skipped' || r.conclusion === 'cancelled') continue
    return { conclusion: r.conclusion, at: r.created_at, url: r.html_url }
  }
  return null
}

const WORKFLOWS = {
  draft: { file: 'articles.yml', label: 'Brouillon de la nuit' },
  publish: { file: 'articles-publish.yml', label: 'Publication (case « Faits vérifiés »)' },
  translate: { file: 'articles-translate.yml', label: 'Traduction (étiquette « traduire »)' },
  backfill: { file: 'articles-backfill.yml', label: 'Rattrapage hebdomadaire de/it/es' },
  hourly: { file: 'hourly.yml', label: 'Déploiement et envoi aux réseaux' },
}
export const WATCHED_WORKFLOWS = Object.values(WORKFLOWS).map((w) => w.file)

export function checkWorkflows(outcomes, { now = new Date(), lastDraftSuccess = null } = {}) {
  const out = []
  for (const [k, w] of Object.entries(WORKFLOWS)) {
    const o = outcomes[w.file]
    if (!o) continue
    const when = o.at ? ` (${o.at.slice(0, 16).replace('T', ' ')} UTC)` : ''
    if (o.conclusion === 'success') out.push({ key: `wf-${k}`, level: 'ok', text: `${w.label} : dernier passage réussi${when}` })
    else
      out.push({
        key: `wf-${k}-failure`,
        level: 'faire',
        text: `${w.label} : dernier passage en échec${when} — [journal](${o.url})`,
        action: k === 'publish' ? 'Lire le commentaire « Publication suspendue » de la PR' : 'Lire le journal du run',
      })
  }
  // Aucun succès dans les derniers runs lus compte aussi : c'est pire.
  const h = lastDraftSuccess ? (now - new Date(lastDraftSuccess)) / 3_600_000 : Infinity
  if (outcomes['articles.yml'] !== undefined && h > DRAFT_STALE_HOURS)
    out.push({
      key: 'draft-stale',
      level: 'faire',
      text: lastDraftSuccess ? `Aucun brouillon réussi depuis ${Math.floor(h)} h` : 'Aucun brouillon réussi dans les derniers passages',
      action: 'Lire le journal de « Culture — brouillon quotidien »',
    })
  return out
}

// `pr.check` : le statut culture-check de la tête de la PR (success, failure,
// pending, ou absent). La traduction est `continue-on-error` : son run finit
// vert même quand elle a échoué — c'est ce statut qui dit la vérité.
export const CHECK_PENDING_HOURS = 6
export function checkPullRequests(prs, now = new Date()) {
  const out = []
  for (const pr of prs) {
    const age = days(now, new Date(pr.created_at))
    if (pr.check?.state === 'failure')
      out.push({
        key: `pr-${pr.number}-check`,
        level: 'faire',
        text: `PR #${pr.number} : contrôle culture-check en échec (${pr.check.description ?? '?'}) — [ouvrir](${pr.html_url})`,
        action: 'Lire le dernier commentaire du robot sur la PR (traduction refusée, modèle sans réponse…)',
      })
    else if (pr.check?.state === 'pending' && (now - new Date(pr.check.updated_at)) / 3_600_000 > CHECK_PENDING_HOURS)
      out.push({ key: `pr-${pr.number}-pending`, level: 'faire', text: `PR #${pr.number} : contrôle en attente depuis plus de ${CHECK_PENDING_HOURS} h`, action: 'Relancer : décocher puis recocher « Faits vérifiés »' })
    out.push({
      key: `pr-${pr.number}${age > PR_WAIT_DAYS ? '-old' : ''}`,
      level: age > PR_WAIT_DAYS ? 'faire' : 'info',
      text: `PR #${pr.number} « ${pr.title.replace(/^Culture : /, '')} » attend la relecture depuis ${age} j — [ouvrir](${pr.html_url})`,
      action: age > PR_WAIT_DAYS ? 'Relire et cocher « Faits vérifiés », ou fermer la PR' : undefined,
    })
  }
  if (!prs.length) out.push({ key: 'pr-none', level: 'info', text: 'Aucune PR Culture en attente' })
  return out
}

export function checkTranslations(articles, langs) {
  const out = []
  const missing = {}
  const fallback = []
  for (const a of articles) {
    for (const l of langs) {
      const t = a.langs[l]
      if (!t) (missing[l] ??= []).push(a.slug)
      else if (/:free$/.test(t.model ?? '')) fallback.push(`${a.slug}/${l}`)
    }
  }
  for (const [l, slugs] of Object.entries(missing))
    out.push({ key: `tr-missing-${l}`, level: 'info', text: `${slugs.length} article(s) sans traduction ${l} (rattrapage le lundi) : ${slugs.slice(0, 5).join(', ')}${slugs.length > 5 ? '…' : ''}` })
  if (fallback.length)
    out.push({ key: 'tr-fallback', level: 'info', text: `${fallback.length} traduction(s) faite(s) par un modèle de secours, à relire : ${fallback.slice(0, 6).join(', ')}${fallback.length > 6 ? '…' : ''}` })
  if (!out.length) out.push({ key: 'tr-ok', level: 'ok', text: `Les ${articles.length} articles sont traduits dans toutes les langues` })
  return out
}

export function checkSocial({ live, accounts, tokens, failures }) {
  const out = []
  if (!live)
    out.push({ key: 'social-not-live', level: 'bloquant', text: 'SOCIAL_LIVE ≠ 1 : le job horaire SIMULE, rien ne part sur les réseaux', action: 'GitHub → Settings → Environments → social → SOCIAL_LIVE = 1' })
  for (const a of accounts) {
    if (a.problem) out.push({ key: `acct-${a.channel}`, level: 'bloquant', text: `**${a.channel}** : ${a.problem}`, action: 'Recoller la clé (docs/social-setup.md)' })
    else if (a.warning) out.push({ key: `acct-${a.channel}-warn`, level: 'faire', text: `**${a.channel}** : ${a.warning}` })
  }
  const okCount = accounts.filter((a) => !a.problem).length
  if (accounts.length) out.push({ key: 'acct-count', level: 'info', text: `${okCount}/${accounts.length} comptes se connectent` })
  for (const t of tokens) {
    const exp = t.expiresAt ? `expire le ${t.expiresAt.toISOString().slice(0, 10)}` : 'sans échéance'
    if (t.problem) out.push({ key: `token-${t.secret}`, level: 'bloquant', text: `Clé ${t.secret} (${t.channels.length} comptes) : ${t.problem}`, action: 'Recoller une clé longue durée dans les FB_PAGE_TOKEN_* (docs/social-setup.md)' })
    else if (t.warning) out.push({ key: `token-${t.secret}-warn`, level: 'faire', text: `Clé ${t.secret} : ${t.warning}`, action: 'Renouveler la clé avant l’échéance (docs/social-setup.md)' })
    else out.push({ key: `token-${t.secret}`, level: 'ok', text: `Clé ${t.secret} (${t.channels.length} comptes) : droits de publication présents, ${exp}` })
  }
  for (const f of failures) {
    if (f.uncertain)
      out.push({
        key: `uncertain-${f.channel}-${f.id}`,
        level: 'faire',
        text: `**${f.channel}** : envoi de ${f.id} INCERTAIN (${f.error}) — peut-être publié, pas retenté pour éviter un doublon`,
        action: `Regarder le compte ${f.channel} : publié → \`node scripts/social-post.mjs retry --drop --channel ${f.channel} --item ${f.id}\` ; absent → même commande sans --drop (PR)`,
      })
    else if (f.abandoned)
      out.push({
        key: `abandon-${f.channel}-${f.id}`,
        level: 'faire',
        text: `**${f.channel}** a renoncé à ${f.id} après ${f.attempts} échecs : ${f.error}`,
        action: `Une fois la cause réglée : \`node scripts/social-post.mjs retry --channel ${f.channel} --item ${f.id}\` (ou \`--drop\` pour y renoncer), puis PR`,
      })
    else out.push({ key: `retry-${f.channel}-${f.id}`, level: 'info', text: `${f.channel} : ${f.id} sera retenté (échec ${f.attempts}) — ${f.error}` })
  }
  return out
}

export function checkManual({ articles, videos, langs, whatsappChannels }) {
  const out = []
  const counts = langs.map((l) => `${l} ${articles.filter((a) => videos[a.slug]?.[l]).length}/${articles.length}`)
  out.push({ key: 'yt', level: 'info', text: `YouTube (envoi à la main, ~10 par jour et par compte Google) — vidéos par langue : ${counts.join(' · ')}` })
  out.push({ key: 'wa', level: 'info', text: `WhatsApp (${whatsappChannels} chaînes) et LinkedIn : pas d'API, publiés pendant les séances Claude Code, sur le rappel d'ouverture de séance` })
  return out
}

// Le référencement : IndexNow (Bing, Yandex, Yahoo) n'a besoin d'aucun
// secret ; Google, si (GSC_SERVICE_ACCOUNT, docs/google-search-console.md).
// `google` : null (pas de clé), ou [{ site, ok, error?, lastSubmitted? }]
// rendu par une vraie connexion en lecture seule.
export function checkIndexing({ google }) {
  const rows = [{ key: 'idx-indexnow', level: 'ok', text: 'Bing, Yandex, Yahoo : prévenus automatiquement à chaque page nouvelle (IndexNow)' }]
  if (google)
    for (const g of google)
      rows.push(
        g.ok
          ? { key: `idx-google-${g.site}`, level: 'ok', text: `Google (${g.site}) : accès vérifié, sitemap renvoyé automatiquement à chaque page nouvelle${g.lastSubmitted ? ` — dernier envoi ${g.lastSubmitted.slice(0, 16).replace('T', ' ')} UTC` : ''}` }
          : {
              key: `idx-google-${g.site}-ko`,
              level: 'faire',
              text: `Google (${g.site}) : ${g.error}`,
              action: 'Vérifier le compte gsc-sitemaps dans Search Console (Utilisateurs, accès Total) et le secret GSC_SERVICE_ACCOUNT',
            },
      )
  else
    rows.push({
      key: 'idx-google-off',
      level: 'faire',
      text: 'Google : pas prévenu automatiquement (secret GSC_SERVICE_ACCOUNT absent) — il découvre les pages seul, plus lentement',
      action: 'Créer le compte de service Search Console (docs/google-search-console.md, 10 minutes)',
    })
  return rows
}

export function checkDeadlines(now = new Date(), list = DEADLINES) {
  return list.map((d) => {
    const left = days(new Date(`${d.date}T00:00:00Z`), now)
    if (left < 0) return { key: `dl-${d.key}-past`, level: 'bloquant', text: `${d.what} : EXPIRÉ le ${d.date}`, action: d.how }
    if (left <= DEADLINE_WARN_DAYS) return { key: `dl-${d.key}`, level: 'faire', text: `${d.what} : expire dans ${left} j (${d.date})`, action: d.how }
    return { key: `dl-${d.key}`, level: 'ok', text: `${d.what} : valable jusqu'au ${d.date}` }
  })
}

// Le scrape horaire. Une source qui tombe ne vide rien : le backfill ressert
// l'instantané précédent, tous les runs restent verts. ArménieInfo.tv s'est
// ainsi figé quatre jours (30 oct.–3 nov. 2026, rubriques désertées par le
// site) ; seule l'issue [sources-down] l'a dit. Le tableau de bord reprend ces
// mesures pour que TOUT ce qui demande d'agir tienne sur une page :
// - `generatedAt` : l'heure du dernier instantané (meta.json) — au-delà de
//   SNAPSHOT_STALE_HOURS, le scrape horaire lui-même ne tourne plus ;
// - `problems` : les phrases de scripts/lib/health.mjs (fraîcheur par source ×
//   langue, classement, agenda), chacune une action ;
// - `failures` : { source: nombre } des « ✗ » du dernier scrape (lus dans son
//   journal) — des échecs partiels que le backfill rattrape : une info, pas
//   une alerte, sinon chaque hoquet passager notifierait.
export const SNAPSHOT_STALE_HOURS = 3

// Les « ✗ source/… : » de l'étape `npm run scrape` d'un journal de job,
// comptés par source. Le journal entier ne convient pas : les tests (« un ✗
// au log ») et les scripts d'alerte en citent dans leur texte. Sans
// marqueur d'étape (journal d'un autre format), on lit tout. La ligne de
// synthèse « ✗ santé » n'est pas un échec de source.
export function scrapeFailures(log) {
  const out = {}
  let text = String(log ?? '')
  const start = text.indexOf('##[group]Run npm run scrape')
  if (start >= 0) {
    const end = text.indexOf('##[group]Run', start + 1)
    text = text.slice(start, end < 0 ? undefined : end)
  }
  for (const m of text.matchAll(/✗\s+([^\s:/]+)/g)) {
    if (m[1] === 'santé') continue
    out[m[1]] = (out[m[1]] ?? 0) + 1
  }
  return out
}

export function checkScraper({ generatedAt, problems = [], tracked = 0, failures = null, logUrl = '', now = new Date() }) {
  const out = []
  const t = Date.parse(generatedAt)
  const h = Number.isFinite(t) ? (now - t) / 3_600_000 : Infinity
  const when = Number.isFinite(t) ? ` (${generatedAt.slice(0, 16).replace('T', ' ')} UTC)` : ''
  if (h > SNAPSHOT_STALE_HOURS)
    out.push({
      key: 'scrape-stale',
      level: 'faire',
      text: Number.isFinite(t) ? `Dernier instantané il y a ${Math.floor(h)} h${when} : le scrape horaire ne tourne plus` : 'Aucun instantané daté (meta.json illisible)',
      action: 'Lire `gh run list --workflow=hourly.yml`, puis les logs du Worker hourly-trigger (un 401 = jeton GH_TOKEN expiré)',
    })
  else out.push({ key: 'scrape-fresh', level: 'ok', text: `Scrape horaire : dernier instantané il y a ${Math.max(0, Math.round(h * 60))} min${when}` })
  for (const p of problems) {
    const name = (/\*\*(.+?)\*\*/.exec(p)?.[1] ?? p).replace(/[^\w/-]+/g, '-')
    out.push({
      key: `src-${name}`,
      level: 'faire',
      text: p,
      action: "Voir si la source publie encore ; si oui, `gh run view <id> --log | grep '✗'` et le skill toucher-une-source",
    })
  }
  if (!problems.length) out.push({ key: 'src-ok', level: 'ok', text: `Les ${tracked} fils (source × langue) sont frais, l'agenda a des événements, les rubriques sont classées` })
  if (failures === null) out.push({ key: 'scrape-log', level: 'info', text: 'Journal du dernier scrape illisible : échecs partiels non comptés' })
  else {
    const list = Object.entries(failures).sort((a, b) => b[1] - a[1])
    const link = logUrl ? ` — [journal](${logUrl})` : ''
    out.push(
      list.length
        ? { key: 'scrape-partial', level: 'info', text: `Dernier scrape : échecs partiels rattrapés par le backfill — ${list.map(([s, n]) => `${s} ×${n}`).join(', ')}${link}` }
        : { key: 'scrape-partial', level: 'ok', text: `Dernier scrape : aucun échec${link}` },
    )
  }
  return out
}

// --- Le rendu ---------------------------------------------------------------

export const ALERT_LEVELS = new Set(['bloquant', 'faire'])
const MARK = /<!-- alertes: (.*?) -->/

export function alertKeys(sections) {
  return sections.flatMap((s) => s.rows).filter((r) => ALERT_LEVELS.has(r.level)).map((r) => r.key).sort()
}
export function previousAlertKeys(body) {
  const m = String(body ?? '').match(MARK)
  return m ? m[1].split('|').filter(Boolean) : []
}

export function renderDashboard(sections, { now = new Date(), runUrl = '' } = {}) {
  const rows = sections.flatMap((s) => s.rows)
  const block = rows.filter((r) => r.level === 'bloquant')
  const todo = rows.filter((r) => r.level === 'faire')
  const head = block.length
    ? `## 🔴 ${block.length} problème(s) bloquant(s)`
    : todo.length
      ? `## 🟠 Tout part, mais ${todo.length} action(s) à faire`
      : '## ✅ Tout est en ordre'
  const lines = [head, '', `Mis à jour le ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC.${runUrl ? ` [Journal](${runUrl})` : ''}`, '']
  const actions = [...block, ...todo].filter((r) => r.action)
  if (actions.length) {
    lines.push('### Ce qu’il faut faire', '')
    for (const r of actions) lines.push(`- [ ] ${ICON[r.level]} ${r.action} — _${r.text.replace(/\s*—\s*\[.*$/, '')}_`)
    lines.push('')
  }
  for (const s of sections) {
    lines.push(`### ${s.title}`, '')
    for (const r of s.rows) lines.push(`- ${ICON[r.level]} ${r.text}`)
    lines.push('')
  }
  lines.push(
    '---',
    'Ce tableau se met à jour deux fois par jour (02:17 et 14:17 UTC) et après chaque échec d’un workflow d’articles. Une nouvelle alerte est signalée par un commentaire ; la page elle-même est toujours à jour.',
    `<!-- alertes: ${alertKeys(sections).join('|')} -->`,
  )
  return lines.join('\n') + '\n'
}

// Le commentaire qui NOTIFIE (une issue modifiée ne prévient personne ; un
// commentaire prévient l'assigné). Seulement si une alerte est NOUVELLE, ou
// quand tout redevient vert — jamais deux fois pour la même alerte.
export function notification(sections, previousKeys) {
  const rows = sections.flatMap((s) => s.rows).filter((r) => ALERT_LEVELS.has(r.level))
  const prev = new Set(previousKeys)
  const fresh = rows.filter((r) => !prev.has(r.key))
  if (fresh.length)
    return [
      `**${fresh.length} nouvelle(s) alerte(s) :**`,
      '',
      ...fresh.map((r) => `- ${ICON[r.level]} ${r.text}${r.action ? `\n  → ${r.action}` : ''}`),
    ].join('\n')
  if (!rows.length && prev.size) return '✅ Toutes les alertes sont levées.'
  return null
}
