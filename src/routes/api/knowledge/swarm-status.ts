import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getKnowledgeSwarmStatus } from '../../../server/knowledge-swarm-status'
import { readKnowledgeBaseConfig } from '../../../server/knowledge-config'

export const Route = createFileRoute('/api/knowledge/swarm-status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const config = readKnowledgeBaseConfig()
          const baseId = url.searchParams.get('baseId') || config.activeBaseId
          return json(getKnowledgeSwarmStatus(baseId))
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to read knowledge swarm status',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
