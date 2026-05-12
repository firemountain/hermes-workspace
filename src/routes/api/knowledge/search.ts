import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { searchKnowledgePages } from '../../../server/knowledge-browser'
import { readKnowledgeBaseConfig } from '../../../server/knowledge-config'

export const Route = createFileRoute('/api/knowledge/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const query = url.searchParams.get('q') || ''
        const config = readKnowledgeBaseConfig()
        const baseId = url.searchParams.get('baseId') || config.activeBaseId

        try {
          return json({ results: searchKnowledgePages(query, baseId) })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to search knowledge pages',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
