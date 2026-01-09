import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getFaceById, searchSimilarFaces } from '@/lib/qdrant'

export const Route = createFileRoute('/api/search/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const { id } = params

          const face = await getFaceById(id)
          if (!face) {
            return json({ error: 'Face not found' }, { status: 404 })
          }

          const { searchParams } = new URL(request.url)
          const limit = parseInt(searchParams.get('limit') || '25')
          const threshold = parseFloat(searchParams.get('threshold') || '0.6')
          const page = parseInt(searchParams.get('page') || '1')
          const offset = (page - 1) * limit

          const searchResult = await searchSimilarFaces(
            id,
            limit,
            threshold,
            offset,
          )

          return json({
            success: true,
            face: {
              id: face.id,
              payload: face.payload,
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
          return json(
            { error: 'Failed to fetch search results' },
            { status: 500 },
          )
        }
      },
    },
  },
})
