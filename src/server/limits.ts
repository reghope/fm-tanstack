const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024
const DEFAULT_MAX_LIMIT = 50
const DEFAULT_MAX_PAGE = 1000

function parseEnvInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const MAX_IMAGE_BYTES = parseEnvInt(
  process.env.MAX_IMAGE_BYTES,
  DEFAULT_MAX_IMAGE_BYTES,
)
export const MAX_SEARCH_LIMIT = parseEnvInt(
  process.env.SEARCH_MAX_LIMIT,
  DEFAULT_MAX_LIMIT,
)
export const MAX_SEARCH_PAGE = parseEnvInt(
  process.env.SEARCH_MAX_PAGE,
  DEFAULT_MAX_PAGE,
)
export const MIN_THRESHOLD = 0
export const MAX_THRESHOLD = 1

export function getBase64ByteSize(base64Data: string): number {
  const content = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const padding = content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0
  const size = Math.floor((content.length * 3) / 4) - padding
  return Number.isFinite(size) && size > 0 ? size : 0
}
