import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Pause,
  Play,
  RefreshCcw,
  Rocket,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const inputClassName =
  'w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'

const numberFormatter = new Intl.NumberFormat()

type JobRecord = Record<string, unknown>

function getJobList(value: unknown): JobRecord[] {
  if (Array.isArray(value)) {
    return value as JobRecord[]
  }

  if (value && typeof value === 'object' && 'jobs' in value) {
    const jobs = (value as { jobs?: unknown }).jobs
    if (Array.isArray(jobs)) {
      return jobs as JobRecord[]
    }
  }

  return []
}

function getJobId(job: JobRecord) {
  return (
    job.jobId ||
    job.id ||
    job.batchId ||
    job.queueId ||
    job._id ||
    'unknown'
  )
}

function getJobStatus(job: JobRecord) {
  return (
    job.status ||
    job.state ||
    job.pass_status ||
    job.batch_status ||
    'unknown'
  )
}

function formatDetail(job: JobRecord) {
  const details: string[] = []
  const domain = job.domain || job.start_url || job.baseUrl || job.base_url
  if (domain) {
    details.push(String(domain))
  }
  if (job.pass_index !== undefined) {
    details.push(`pass ${job.pass_index}`)
  }
  if (job.pass_depth !== undefined) {
    details.push(`depth ${job.pass_depth}`)
  }
  if (job.totalUrls !== undefined) {
    details.push(`${numberFormatter.format(Number(job.totalUrls))} urls`)
  }
  if (job.processedUrls !== undefined) {
    details.push(
      `${numberFormatter.format(Number(job.processedUrls))} processed`
    )
  }
  if (job.concurrency !== undefined) {
    details.push(`concurrency ${job.concurrency}`)
  }
  return details.join(' · ')
}

function getStatusStyles(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('processing') || normalized.includes('active')) {
    return 'bg-emerald-100 text-emerald-800'
  }
  if (normalized.includes('paused')) {
    return 'bg-amber-100 text-amber-800'
  }
  if (normalized.includes('failed') || normalized.includes('error')) {
    return 'bg-rose-100 text-rose-800'
  }
  if (normalized.includes('completed')) {
    return 'bg-slate-200 text-slate-700'
  }
  if (normalized.includes('pending')) {
    return 'bg-sky-100 text-sky-800'
  }
  return 'bg-slate-100 text-slate-700'
}

async function dashboardRequest(
  apiKey: string,
  intent: string,
  payload?: Record<string, unknown>
) {
  const response = await fetch('/api/dashboard', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey, intent, payload }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [sitemapJobs, setSitemapJobs] = useState<JobRecord[]>([])
  const [scrapeBatches, setScrapeBatches] = useState<JobRecord[]>([])
  const [uploadJobs, setUploadJobs] = useState<JobRecord[]>([])
  const [queues, setQueues] = useState<Record<string, unknown> | null>(null)

  const [crawlForm, setCrawlForm] = useState({
    domain: '',
    maxUrls: '500000',
    concurrency: '5',
  })
  const [scrapeForm, setScrapeForm] = useState({
    jobId: '',
    passIndex: '',
    s3Key: '',
    maxImages: '5000',
    concurrency: '5',
    embed: true,
    embedWait: true,
    embedMissing: true,
  })

  const queueEntries = useMemo(() => {
    if (!queues || typeof queues !== 'object') {
      return [] as [string, unknown][]
    }
    return Object.entries(queues)
  }, [queues])

  const handleRequest = async (
    intent: string,
    payload?: Record<string, unknown>
  ) => {
    if (!apiKey) {
      setError('Enter your API key to continue.')
      return null
    }
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const data = await dashboardRequest(apiKey, intent, payload)
      return data
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Request failed'
      )
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const refresh = async (overrideKey?: string) => {
    const key = overrideKey || apiKey
    if (!key) {
      setError('Enter your API key to continue.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const data = await dashboardRequest(key, 'list')
      setSitemapJobs(getJobList(data.sitemapJobs))
      setScrapeBatches(getJobList(data.scrapeBatches))
      setUploadJobs(getJobList(data.uploadJobs))
      setQueues(
        data.queues && typeof data.queues === 'object' ? data.queues : null
      )
      setLastUpdated(new Date())
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load jobs'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault()
    setApiKey(apiKeyInput)
    await refresh(apiKeyInput)
  }

  const handleCreateCrawl = async (event: FormEvent) => {
    event.preventDefault()

    const result = await handleRequest('crawl.create', {
      domain: crawlForm.domain,
      maxUrls: crawlForm.maxUrls,
      concurrency: crawlForm.concurrency,
    })

    if (result) {
      setSuccess('Crawl job created.')
      await refresh()
    }
  }

  const handleCreateScrape = async (event: FormEvent) => {
    event.preventDefault()

    const result = await handleRequest('scrape.create', {
      ...scrapeForm,
    })

    if (result) {
      setSuccess('Scrape batch created.')
      await refresh()
    }
  }

  const handleSitemapAction = async (id: unknown, action: string) => {
    if (!id || id === 'unknown') {
      setError('Missing job id.')
      return
    }

    const result = await handleRequest('sitemap.action', { id, action })
    if (result) {
      setSuccess(`Sitemap job ${action}d.`)
      await refresh()
    }
  }

  const handleScrapeCancel = async (id: unknown) => {
    const result = await handleRequest('scrape.cancel', { id })
    if (result) {
      setSuccess('Scrape batch cancelled.')
      await refresh()
    }
  }

  const handleUploadCancel = async (id: unknown) => {
    const result = await handleRequest('upload.cancel', { id })
    if (result) {
      setSuccess('Upload job cancelled.')
      await refresh()
    }
  }

  const handleBulkSitemap = async (action: string) => {
    if (sitemapJobs.length === 0) {
      setError('No sitemap jobs to update.')
      return
    }

    const ids = sitemapJobs.map(getJobId).filter((id) => id !== 'unknown')
    const result = await handleRequest('sitemap.bulk', { action, ids })
    if (result) {
      setSuccess(`Bulk ${action} complete.`)
      await refresh()
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#f8fafc_50%,_#e2e8f0)] text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Control Room
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Crawl & Scrape Ops Dashboard
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Start crawls, spin up scrape batches, and keep Redis-backed queues
              moving. All actions are verified against the server API key.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => refresh()}
              disabled={!apiKey || isLoading}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            {lastUpdated && (
              <span className="text-xs text-slate-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </header>

        <Card className="border-slate-200/80 bg-white/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Access & Queue Health</CardTitle>
            <CardDescription>
              Provide the API key to unlock crawl, scrape, and Redis controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  API Key
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                    placeholder="Enter API key"
                    className={inputClassName}
                  />
                  <Button
                    type="submit"
                    disabled={!apiKeyInput || isLoading}
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Connect
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white/80 p-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Status</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      apiKey ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'
                    }`}
                  >
                    {apiKey ? 'Authenticated' : 'Locked'}
                  </span>
                </div>
                {error && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-rose-600">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </p>
                )}
                {success && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                  </p>
                )}
              </div>
            </form>

            <div className="grid gap-4 sm:grid-cols-2">
              {queueEntries.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  Queue stats load after authentication.
                </div>
              )}
              {queueEntries.map(([queueName, queue]) => {
                const queueData = queue as Record<string, unknown>
                const pending = Number(queueData.pending || 0)
                const active = Array.isArray(queueData.active)
                  ? queueData.active.length
                  : Number(queueData.active || 0)
                return (
                  <div
                    key={queueName}
                    className="rounded-lg border border-slate-200/80 bg-white/80 p-4"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {queueName}
                    </p>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span className="text-2xl font-semibold text-slate-900">
                        {numberFormatter.format(pending)}
                      </span>
                      <span className="text-xs text-slate-500">pending</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {numberFormatter.format(active)} active
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200/80 bg-white/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-slate-700" />
                New Crawl Job
              </CardTitle>
              <CardDescription>
                Kick off a sitemap crawl with concurrency and URL caps.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCrawl} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={crawlForm.domain}
                    onChange={(event) =>
                      setCrawlForm((prev) => ({
                        ...prev,
                        domain: event.target.value,
                      }))
                    }
                    placeholder="https://example.com"
                    className={`${inputClassName} mt-2`}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Max URLs
                    </label>
                    <input
                      type="number"
                      value={crawlForm.maxUrls}
                      onChange={(event) =>
                        setCrawlForm((prev) => ({
                          ...prev,
                          maxUrls: event.target.value,
                        }))
                      }
                      className={`${inputClassName} mt-2`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Concurrency
                    </label>
                    <input
                      type="number"
                      value={crawlForm.concurrency}
                      onChange={(event) =>
                        setCrawlForm((prev) => ({
                          ...prev,
                          concurrency: event.target.value,
                        }))
                      }
                      className={`${inputClassName} mt-2`}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={!apiKey || isLoading}>
                  Start Crawl
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-slate-700" />
                New Scrape Batch
              </CardTitle>
              <CardDescription>
                Scrape images from a crawl pass, with optional embedding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateScrape} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Crawl Job ID
                  </label>
                  <input
                    type="text"
                    value={scrapeForm.jobId}
                    onChange={(event) =>
                      setScrapeForm((prev) => ({
                        ...prev,
                        jobId: event.target.value,
                      }))
                    }
                    className={`${inputClassName} mt-2`}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pass Index
                    </label>
                    <input
                      type="number"
                      value={scrapeForm.passIndex}
                      onChange={(event) =>
                        setScrapeForm((prev) => ({
                          ...prev,
                          passIndex: event.target.value,
                        }))
                      }
                      className={`${inputClassName} mt-2`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Max Images
                    </label>
                    <input
                      type="number"
                      value={scrapeForm.maxImages}
                      onChange={(event) =>
                        setScrapeForm((prev) => ({
                          ...prev,
                          maxImages: event.target.value,
                        }))
                      }
                      className={`${inputClassName} mt-2`}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    S3 Key (optional)
                  </label>
                  <input
                    type="text"
                    value={scrapeForm.s3Key}
                    onChange={(event) =>
                      setScrapeForm((prev) => ({
                        ...prev,
                        s3Key: event.target.value,
                      }))
                    }
                    className={`${inputClassName} mt-2`}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Concurrency
                    </label>
                    <input
                      type="number"
                      value={scrapeForm.concurrency}
                      onChange={(event) =>
                        setScrapeForm((prev) => ({
                          ...prev,
                          concurrency: event.target.value,
                        }))
                      }
                      className={`${inputClassName} mt-2`}
                    />
                  </div>
                  <div className="flex flex-col gap-2 text-xs text-slate-600">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={scrapeForm.embed}
                        onChange={(event) =>
                          setScrapeForm((prev) => ({
                            ...prev,
                            embed: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Embed
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={scrapeForm.embedWait}
                        onChange={(event) =>
                          setScrapeForm((prev) => ({
                            ...prev,
                            embedWait: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Embed wait
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={scrapeForm.embedMissing}
                        onChange={(event) =>
                          setScrapeForm((prev) => ({
                            ...prev,
                            embedMissing: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Embed missing
                    </label>
                  </div>
                </div>
                <Button type="submit" disabled={!apiKey || isLoading}>
                  Start Scrape
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6">
          <Card className="border-slate-200/80 bg-white/70 backdrop-blur">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Sitemap Jobs</CardTitle>
                <CardDescription>
                  Pause, resume, cancel, or delete crawl jobs in Redis.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleBulkSitemap('pause')}
                  disabled={!apiKey || isLoading}
                  className="gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Pause All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleBulkSitemap('resume')}
                  disabled={!apiKey || isLoading}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Resume All
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleBulkSitemap('delete')}
                  disabled={!apiKey || isLoading}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {sitemapJobs.length === 0 ? (
                <p className="text-sm text-slate-500">No sitemap jobs found.</p>
              ) : (
                sitemapJobs.map((job) => {
                  const id = getJobId(job)
                  const status = String(getJobStatus(job))
                  return (
                    <div
                      key={String(id)}
                      className="flex flex-col gap-3 rounded-lg border border-slate-200/80 bg-white/80 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {String(id)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDetail(job) || 'No details available'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusStyles(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSitemapAction(id, 'pause')}
                          disabled={!apiKey || isLoading}
                          className="gap-2"
                        >
                          <Pause className="h-4 w-4" />
                          Pause
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSitemapAction(id, 'resume')}
                          disabled={!apiKey || isLoading}
                          className="gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Resume
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleSitemapAction(id, 'delete')}
                          disabled={!apiKey || isLoading}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200/80 bg-white/70 backdrop-blur">
              <CardHeader>
                <CardTitle>Scrape Batches</CardTitle>
                <CardDescription>
                  Monitor scrape batches and cancel when needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {scrapeBatches.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No scrape batches found.
                  </p>
                ) : (
                  scrapeBatches.map((job) => {
                    const id = getJobId(job)
                    const status = String(getJobStatus(job))
                    return (
                      <div
                        key={String(id)}
                        className="flex flex-col gap-3 rounded-lg border border-slate-200/80 bg-white/80 p-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {String(id)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDetail(job) || 'No details available'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusStyles(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => handleScrapeCancel(id)}
                            disabled={!apiKey || isLoading}
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/70 backdrop-blur">
              <CardHeader>
                <CardTitle>Upload Jobs</CardTitle>
                <CardDescription>
                  Track pending uploads and cancel when required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {uploadJobs.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No upload jobs found.
                  </p>
                ) : (
                  uploadJobs.map((job) => {
                    const id = getJobId(job)
                    const status = String(getJobStatus(job))
                    return (
                      <div
                        key={String(id)}
                        className="flex flex-col gap-3 rounded-lg border border-slate-200/80 bg-white/80 p-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {String(id)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDetail(job) || 'No details available'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusStyles(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => handleUploadCancel(id)}
                            disabled={!apiKey || isLoading}
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
              <CardFooter className="text-xs text-slate-500">
                Upload cancel uses the `/api/s3/jobs/:id/cancel` endpoint.
              </CardFooter>
            </Card>
          </div>
        </section>
      </div>
    </main>
  )
}
