import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { searchFaces } from '@/lib/qdrant'
import { uploadImage } from '@/lib/s3'
import { generateEmbeddingFromBase64 } from '@/lib/deepface'

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const {
            croppedImageData,
            fullImageData,
            limit = 25,
            threshold = 0.6,
            page = 1,
          } = await request.json()

          const offset = (page - 1) * limit

          if (!croppedImageData) {
            return json({ error: 'Missing croppedImageData' }, { status: 400 })
          }

          const uploadId = crypto.randomUUID()
          const timestamp = Date.now()

          let croppedImageUrl: string | undefined
          let fullImageUrl: string | undefined

          try {
            if (fullImageData) {
              fullImageUrl = await uploadImage(
                fullImageData,
                `${uploadId}-full-${timestamp}.jpg`,
              )
            }
            if (croppedImageData) {
              croppedImageUrl = await uploadImage(
                croppedImageData,
                `${uploadId}-cropped-${timestamp}.jpg`,
              )
            }
          } catch (uploadError) {
            console.error('Failed to upload images to S3:', uploadError)
          }

          const embeddingResult = await generateEmbeddingFromBase64(
            croppedImageData,
          )

          if (embeddingResult.error) {
            console.error('DeepFace error:', embeddingResult.error)
            return json({ error: embeddingResult.error }, { status: 400 })
          }

          if (embeddingResult.faces.length === 0) {
            return json({ error: 'No face detected in image' }, { status: 400 })
          }

          const embedding = embeddingResult.faces[0].embedding
          const searchResult = await searchFaces(embedding, limit, threshold, offset)

          return json({
            success: true,
            query: {
              croppedImageUrl,
              fullImageUrl,
            },
            results: searchResult.results,
            pagination: {
              total: searchResult.total,
              page: searchResult.page,
              pageSize: searchResult.pageSize,
              totalPages: searchResult.totalPages,
            },
          })
        } catch (error) {
          console.error('Search error:', error)
          return json({ error: 'Search failed. Please try again.' }, { status: 500 })
        }
      },
    },
  },
})
