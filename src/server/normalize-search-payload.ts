import type { SearchResultPayload } from '@/shared/search-types'

export function normalizeSearchPayload(
  payload?: Record<string, unknown> | null,
): SearchResultPayload | undefined {
  if (!payload) {
    return undefined
  }

  const faceImageUrl =
    (payload.imageUrl as string | undefined) ||
    (payload.croppedImageUrl as string | undefined) ||
    (payload.image_url as string | undefined)

  const originalUrl =
    (payload.originalUrl as string | undefined) ||
    (payload.source_url as string | undefined) ||
    (payload.fullImageUrl as string | undefined)

  const name = payload.name as string | undefined

  return {
    faceImageUrl,
    originalUrl,
    name,
    croppedImageUrl: payload.croppedImageUrl as string | undefined,
    fullImageUrl: payload.fullImageUrl as string | undefined,
    metadata: payload,
  }
}
