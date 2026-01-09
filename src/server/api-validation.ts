import {
  MAX_IMAGE_BYTES,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_PAGE,
  MAX_THRESHOLD,
  MIN_THRESHOLD,
  getBase64ByteSize,
} from '@/server/limits'

export interface SearchBodyParams {
  croppedImageData: string
  fullImageData?: string | null
  limit: number
  threshold: number
  page: number
}

export interface SearchQueryParams {
  limit: number
  threshold: number
  page: number
}

function parseNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

function validateBase64Image(
  value: unknown,
  fieldName: string,
): { error: string; status: number } | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { error: `${fieldName} must be a base64 string`, status: 400 }
  }

  const byteSize = getBase64ByteSize(value)
  if (!byteSize) {
    return { error: `${fieldName} is not valid base64 data`, status: 400 }
  }

  if (byteSize > MAX_IMAGE_BYTES) {
    return { error: `${fieldName} exceeds ${MAX_IMAGE_BYTES} bytes`, status: 413 }
  }

  return null
}

function validatePagination(limit: number, threshold: number, page: number): string | null {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
    return `limit must be between 1 and ${MAX_SEARCH_LIMIT}`
  }

  if (Number.isNaN(threshold) || threshold < MIN_THRESHOLD || threshold > MAX_THRESHOLD) {
    return `threshold must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}`
  }

  if (!Number.isInteger(page) || page < 1 || page > MAX_SEARCH_PAGE) {
    return `page must be between 1 and ${MAX_SEARCH_PAGE}`
  }

  return null
}

export function parseSearchBody(body: unknown):
  | { data: SearchBodyParams }
  | { error: string; status: number } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid JSON body', status: 400 }
  }

  const record = body as Record<string, unknown>

  const croppedImageData = record.croppedImageData
  const fullImageData = record.fullImageData ?? null

  const limit = parseNumber(record.limit, 25)
  const threshold = parseNumber(record.threshold, 0.6)
  const page = parseNumber(record.page, 1)

  const paginationError = validatePagination(limit, threshold, page)
  if (paginationError) {
    return { error: paginationError, status: 400 }
  }

  const croppedError = validateBase64Image(croppedImageData, 'croppedImageData')
  if (croppedError) {
    return croppedError
  }

  if (fullImageData !== null) {
    const fullError = validateBase64Image(fullImageData, 'fullImageData')
    if (fullError) {
      return fullError
    }
  }

  return {
    data: {
      croppedImageData: croppedImageData as string,
      fullImageData: fullImageData as string | null,
      limit: Math.trunc(limit),
      threshold,
      page: Math.trunc(page),
    },
  }
}

export function parseSearchQueryParams(
  searchParams: URLSearchParams,
): { data: SearchQueryParams } | { error: string; status: number } {
  const limit = parseNumber(searchParams.get('limit'), 25)
  const threshold = parseNumber(searchParams.get('threshold'), 0.6)
  const page = parseNumber(searchParams.get('page'), 1)

  const paginationError = validatePagination(limit, threshold, page)
  if (paginationError) {
    return { error: paginationError, status: 400 }
  }

  return {
    data: {
      limit: Math.trunc(limit),
      threshold,
      page: Math.trunc(page),
    },
  }
}
