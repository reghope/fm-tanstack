# API Usage Guide

All endpoints require `x-api-key: <API_KEY>`.

Base URL:
- Use the API host directly (example: `https://api2.intuvo.co.uk/api`).
- Do not add extra prefixes like `/api/crawl` or duplicate `/api`.
- If calling through a frontend host, add a reverse proxy that forwards `/api/*` to this service.

Standard error response:
```json
{ "error": "Message", "details": "Optional details" }
```

## Crawl (Sitemap) Jobs

### Create a crawl job

`GET /api/sitemap?domain=<domain>&maxUrls=500000&concurrency=5`

Notes:
- `domain` may be `example.com` or `https://example.com`.
- Depth is handled internally via multipass.

Response:
```json
{
  "jobId": "uuid",
  "statusUrl": "/api/sitemap/jobs/uuid"
}
```

### List jobs

`GET /api/sitemap/jobs?limit=20`  
Alias: `GET /api/sitemap?limit=20` (when `domain` is not provided)

### Job details

`GET /api/sitemap/jobs/:id?includeErrors=true&errorLimit=50`

Returns a job record plus optional error strings.

Important fields:
- `status`: pending | processing | paused | completed | failed | cancelled
- `concurrency`: current crawl concurrency (editable while running)
- `pass_index`, `pass_depth`, `pass_status`: current pass status
- `pass_s3_key`, `pass_s3_url`, `pass_urls_count`: latest pass snapshot
- `passes_json`: historical pass records (array of pass metadata)
- `last_result_at`, `last_url`: last processed URL markers

### Update crawl settings (concurrency)

`PATCH /api/sitemap/jobs/:id`

Body:
```json
{ "concurrency": 8 }
```

Response:
```json
{ "jobId": "uuid", "depth": 6, "concurrency": 8 }
```

### Pause / resume / cancel / delete

- `POST /api/sitemap/jobs/:id/pause`
- `POST /api/sitemap/jobs/:id/resume`
- `POST /api/sitemap/jobs/:id/cancel`
- `DELETE /api/sitemap/jobs/:id`

Notes:
- Pause/cancel save a sitemap snapshot to S3.
- Resume will continue a paused job or create a new job seeded from incomplete URLs.

### Results & done URLs

- `GET /api/sitemap/jobs/:id/results?limit=200&offset=0`
- `GET /api/sitemap/jobs/:id/results/search?q=term&limit=200&offset=0`
- `GET /api/sitemap/jobs/:id/done?limit=200&offset=0`

Result format:
```json
{
  "jobId": "uuid",
  "results": [
    { "url": "/portfolio/jackieg/image/8130122/model", "status": 200 }
  ],
  "limit": 200,
  "offset": 0
}
```

Notes:
- `url` values are **relative paths**. Build absolute URLs using the job's `start_url`
  or `domain` (example: `https://<domain>` + `url`).
- `status` is the numeric HTTP status.
- Legacy jobs are auto-normalized on read.

### Pass snapshots in S3

Each pass uploads a JSON snapshot to S3:
```json
{
  "jobId": "uuid",
  "passIndex": 1,
  "passDepth": 4,
  "baseUrl": "https://example.com",
  "urls": ["/path/one", "/path/two"]
}
```

Use `pass_s3_key` or `pass_s3_url` from the job record to locate the snapshot.

## Scrape from Crawl (Scrape Batches)

### Create a scrape batch for a crawl pass

`POST /api/sitemap/jobs/:id/scrape`

Body or query parameters:
```json
{
  "s3Key": "example.com/json/example.com_pass_1_depth_4_....json",
  "passIndex": 1,
  "maxImages": 5000,
  "concurrency": 5,
  "embed": true,
  "embedWait": true,
  "embedMissing": true
}
```

Notes:
- Provide **either** `s3Key` **or** `passIndex`. If omitted, the latest pass is used.
- `maxImages` is a per-job cap for extracted images.

Response:
```json
{
  "batchId": "uuid",
  "totalUrls": 168027,
  "s3Key": "...",
  "statusUrl": "/api/scrape/batches/uuid",
  "jobsUrl": "/api/scrape/batches/uuid/jobs"
}
```

### Scrape batch status

- `GET /api/scrape/batches?limit=20`
- `GET /api/scrape/batches/:id`
- `GET /api/scrape/batches/:id/jobs?limit=200&offset=0`
- `POST /api/scrape/batches/:id/cancel`

`/jobs` returns the upload job IDs spawned by the batch (use `/api/s3/jobs/:id` to inspect).

## Scrape a Single URL (Upload Jobs)

Create a scrape job:
- `POST /api/scrape`
- `POST /api/s3/upload` (alias)

Body:
```json
{
  "scrapeUrl": "https://example.com/page",
  "maxImages": 200,
  "concurrency": 10,
  "embed": true,
  "embedWait": true,
  "embedMissing": true
}
```

Response:
```json
{
  "jobId": "uuid",
  "statusUrl": "/api/s3/jobs/uuid",
  "imagesUrl": "/api/s3/jobs/uuid/images"
}
```

Upload job endpoints:
- `GET /api/s3/jobs?limit=20`
- `GET /api/s3/jobs/:id?includeImages=true&limit=200&offset=0`
- `GET /api/s3/jobs/:id/images?limit=200&offset=0`
- `POST /api/s3/jobs/:id/cancel`

## Ops (Queue Visibility)

`GET /api/ops/queues?limit=50`

Returns pending counts and active job IDs for:
- sitemap jobs
- scrape batches
- upload jobs

## Face Detection Helper

`POST /api/faces/detect`

Body:
```json
{ "urls": ["https://example.com/image.jpg"], "concurrency": 5 }
```

Response includes per-image face stats plus summary counts.
