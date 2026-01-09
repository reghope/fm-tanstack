import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  buildAuthCookie,
  getDashboardCookieValue,
  isDashboardAuthenticated,
  verifyDashboardApiKey,
} from '@/server/dashboard-auth'

type AuthRequest = {
  apiKey?: string
}

export const Route = createFileRoute('/api/dashboard-auth')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authenticated = isDashboardAuthenticated(request)
        return json({ authenticated })
      },
      POST: async ({ request }) => {
        let body: AuthRequest
        try {
          body = (await request.json()) as AuthRequest
        } catch {
          return json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const auth = verifyDashboardApiKey(body.apiKey)
        if (!auth.ok) {
          return json({ error: auth.message }, { status: auth.status })
        }

        const cookieValue = getDashboardCookieValue()
        if (!cookieValue) {
          return json({ error: 'API_KEY is not configured' }, { status: 500 })
        }

        return json(
          { authenticated: true },
          {
            headers: {
              'Set-Cookie': buildAuthCookie(cookieValue),
            },
          }
        )
      },
      DELETE: async () => {
        return json(
          { authenticated: false },
          {
            headers: {
              'Set-Cookie': buildAuthCookie(null),
            },
          }
        )
      },
    },
  },
})
