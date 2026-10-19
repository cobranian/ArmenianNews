// Hourly trigger — launches the "Hourly snapshot & deploy" workflow from outside
// GitHub, because GitHub's own scheduler sheds runs under load: with the cron at
// ':23' the job still fired only 5–6 times a day (measured 14–19 October 2026),
// every run reporting success, the site serving news 6–10 hours old.
//
// This Worker has no fetch handler and no public URL (workers_dev = false): its
// only entry point is the Cron Trigger. The GitHub schedule stays in hourly.yml
// as a fallback; an overlap is harmless — the workflow's `concurrency` group
// cancels the older run and the newer one does the whole job.
//
// Secret GH_TOKEN: a fine-grained personal access token restricted to the
// ArmenianNews repository, with the single permission "Actions: Read and write".
// It EXPIRES: when it does, dispatch fails with 401, GitHub's shedding schedule
// takes over again and nothing else breaks — the only sign is spaced-out
// snapshots and `dispatch failed: 401` in this Worker's logs.

export const REPO = 'cobranian/ArmenianNews'
export const WORKFLOW = 'hourly.yml'

export function dispatchRequest(token) {
  if (!token) throw new Error('GH_TOKEN secret is not set')
  return new Request(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        // GitHub rejects API calls without a User-Agent.
        'user-agent': 'ArmenieInfo-hourly-trigger',
      },
      body: JSON.stringify({ ref: 'main' }),
    },
  )
}

export default {
  async scheduled(_event, env) {
    const res = await fetch(dispatchRequest(env.GH_TOKEN))
    // 204 No Content is the only success answer of this endpoint.
    if (res.status !== 204) {
      const body = (await res.text()).slice(0, 300)
      // Throwing marks the cron invocation as failed in the dashboard.
      throw new Error(`dispatch failed: ${res.status} ${body}`)
    }
    console.log('dispatched', WORKFLOW)
  },
}
