import { createHash } from 'node:crypto'

const API_KEY = process.env.API_KEY || ''
const COOKIE_NAME = 'dashboard_auth'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12

function getExpectedCookieValue() {
  if (!API_KEY) {
    return null
  }
  return createHash('sha256').update(API_KEY).digest('hex')
}

function parseCookies(header: string | null) {
  if (!header) {
    return {}
  }

  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (!rawKey) {
      return acc
    }
    acc[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.join('='))
    return acc
  }, {})
}

export function isDashboardAuthenticated(request: Request) {
  const expected = getExpectedCookieValue()
  if (!expected) {
    return false
  }

  const cookies = parseCookies(request.headers.get('cookie'))
  return cookies[COOKIE_NAME] === expected
}

export function verifyDashboardApiKey(apiKey: string | undefined) {
  if (!API_KEY) {
    return { ok: false, status: 500, message: 'API_KEY is not configured' }
  }
  if (!apiKey || apiKey !== API_KEY) {
    return { ok: false, status: 401, message: 'Invalid API key' }
  }
  return { ok: true as const }
}

export function buildAuthCookie(value: string | null) {
  const secure = process.env.NODE_ENV === 'production'
  const base = `${COOKIE_NAME}=${value ?? ''}; Path=/; HttpOnly; SameSite=Lax`
  if (!value) {
    return `${base}; Max-Age=0`
  }
  return `${base}; Max-Age=${COOKIE_MAX_AGE_SECONDS}${
    secure ? '; Secure' : ''
  }`
}

export function getDashboardCookieValue() {
  return getExpectedCookieValue()
}
