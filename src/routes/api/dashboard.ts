import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

const API_BASE_URL = process.env.API_BASE_URL || ''
const EXPECTED_API_KEY = process.env.API_KEY || ''

type DashboardIntent =
  | 'list'
  | 'crawl.create'
  | 'scrape.create'
  | 'sitemap.action'
  | 'scrape.cancel'
  | 'upload.cancel'
  | 'sitemap.bulk'

type DashboardRequest = {
  apiKey?: string
  intent?: DashboardIntent
  payload?: Record<string, unknown>
}

function buildApiUrl(path: string) {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL is not configured')
  }

  const base = API_BASE_URL.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`

  if (base.endsWith('/api') && suffix.startsWith('/api/')) {
    return `${base}${suffix.slice(4)}`
  }

  return `${base}${suffix}`
}

async function readJsonSafe(response: Response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

async function apiRequest(
  apiKey: string,
  path: string,
  options?: RequestInit
) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      ...(options?.headers || {}),
    },
  })

  if (!response.ok) {
    const errorBody = await readJsonSafe(response)
    const message =
      typeof errorBody?.error === 'string'
        ? errorBody.error
        : `Request failed (${response.status})`
    throw new Error(message)
  }

  return readJsonSafe(response)
}

function requireApiKey(apiKey?: string) {
  if (!EXPECTED_API_KEY) {
    return { ok: false, status: 500, message: 'API_KEY is not configured' }
  }

  if (!apiKey || apiKey !== EXPECTED_API_KEY) {
    return { ok: false, status: 401, message: 'Invalid API key' }
  }

  return { ok: true as const }
}

export const Route = createFileRoute('/api/dashboard')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: DashboardRequest

        try {
          body = (await request.json()) as DashboardRequest
        } catch {
          return json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const auth = requireApiKey(body.apiKey)
        if (!auth.ok) {
          return json({ error: auth.message }, { status: auth.status })
        }

        if (!body.intent) {
          return json({ error: 'Missing intent' }, { status: 400 })
        }

        try {
          const payload = body.payload ?? {}

          switch (body.intent) {
            case 'list': {
              const [sitemapJobs, scrapeBatches, uploadJobs, queues] =
                await Promise.all([
                  apiRequest(body.apiKey!, '/api/sitemap/jobs?limit=50'),
                  apiRequest(body.apiKey!, '/api/scrape/batches?limit=50'),
                  apiRequest(body.apiKey!, '/api/s3/jobs?limit=50'),
                  apiRequest(body.apiKey!, '/api/ops/queues?limit=50'),
                ])

              return json({
                sitemapJobs,
                scrapeBatches,
                uploadJobs,
                queues,
              })
            }
            case 'crawl.create': {
              const domain = String(payload.domain || '').trim()
              if (!domain) {
                return json({ error: 'Domain is required' }, { status: 400 })
              }

              const params = new URLSearchParams({ domain })
              if (payload.maxUrls) {
                params.set('maxUrls', String(payload.maxUrls))
              }
              if (payload.concurrency) {
                params.set('concurrency', String(payload.concurrency))
              }

              const result = await apiRequest(
                body.apiKey!,
                `/api/sitemap?${params.toString()}`
              )

              return json({ result })
            }
            case 'scrape.create': {
              const jobId = String(payload.jobId || '').trim()
              if (!jobId) {
                return json({ error: 'Job ID is required' }, { status: 400 })
              }

              const bodyPayload: Record<string, unknown> = {}
              if (payload.s3Key) {
                bodyPayload.s3Key = String(payload.s3Key)
              }
              if (payload.passIndex !== undefined && payload.passIndex !== '') {
                bodyPayload.passIndex = Number(payload.passIndex)
              }
              if (payload.maxImages) {
                bodyPayload.maxImages = Number(payload.maxImages)
              }
              if (payload.concurrency) {
                bodyPayload.concurrency = Number(payload.concurrency)
              }
              if (payload.embed !== undefined) {
                bodyPayload.embed = Boolean(payload.embed)
              }
              if (payload.embedWait !== undefined) {
                bodyPayload.embedWait = Boolean(payload.embedWait)
              }
              if (payload.embedMissing !== undefined) {
                bodyPayload.embedMissing = Boolean(payload.embedMissing)
              }

              const result = await apiRequest(
                body.apiKey!,
                `/api/sitemap/jobs/${jobId}/scrape`,
                {
                  method: 'POST',
                  body: JSON.stringify(bodyPayload),
                }
              )

              return json({ result })
            }
            case 'sitemap.action': {
              const id = String(payload.id || '').trim()
              const action = String(payload.action || '').trim()
              const allowedActions = new Set([
                'pause',
                'resume',
                'cancel',
                'delete',
              ])

              if (!id || !action) {
                return json(
                  { error: 'Job id and action are required' },
                  { status: 400 }
                )
              }

              if (!allowedActions.has(action)) {
                return json({ error: 'Unsupported action' }, { status: 400 })
              }

              if (action === 'delete') {
                await apiRequest(body.apiKey!, `/api/sitemap/jobs/${id}`, {
                  method: 'DELETE',
                })
              } else {
                await apiRequest(
                  body.apiKey!,
                  `/api/sitemap/jobs/${id}/${action}`,
                  { method: 'POST' }
                )
              }

              return json({ success: true })
            }
            case 'scrape.cancel': {
              const id = String(payload.id || '').trim()
              if (!id) {
                return json({ error: 'Batch id is required' }, { status: 400 })
              }

              const result = await apiRequest(
                body.apiKey!,
                `/api/scrape/batches/${id}/cancel`,
                { method: 'POST' }
              )

              return json({ result })
            }
            case 'upload.cancel': {
              const id = String(payload.id || '').trim()
              if (!id) {
                return json({ error: 'Job id is required' }, { status: 400 })
              }

              const result = await apiRequest(
                body.apiKey!,
                `/api/s3/jobs/${id}/cancel`,
                { method: 'POST' }
              )

              return json({ result })
            }
            case 'sitemap.bulk': {
              const action = String(payload.action || '').trim()
              const ids = Array.isArray(payload.ids)
                ? payload.ids.map((id) => String(id))
                : []
              const allowedActions = new Set([
                'pause',
                'resume',
                'cancel',
                'delete',
              ])

              if (!action || ids.length === 0) {
                return json(
                  { error: 'Action and ids are required' },
                  { status: 400 }
                )
              }

              if (!allowedActions.has(action)) {
                return json({ error: 'Unsupported action' }, { status: 400 })
              }

              const results = await Promise.allSettled(
                ids.map((id) =>
                  action === 'delete'
                    ? apiRequest(body.apiKey!, `/api/sitemap/jobs/${id}`, {
                        method: 'DELETE',
                      })
                    : apiRequest(
                        body.apiKey!,
                        `/api/sitemap/jobs/${id}/${action}`,
                        { method: 'POST' }
                      )
                )
              )

              const summary = results.reduce(
                (acc, result) => {
                  if (result.status === 'fulfilled') {
                    acc.success += 1
                  } else {
                    acc.failed += 1
                  }
                  return acc
                },
                { success: 0, failed: 0 }
              )

              return json({ summary })
            }
            default:
              return json({ error: 'Unknown intent' }, { status: 400 })
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unexpected error'
          return json({ error: message }, { status: 500 })
        }
      },
    },
  },
})
