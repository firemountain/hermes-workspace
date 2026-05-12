import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  knowledgeRootExists,
  listKnowledgePages,
} from '../../../server/knowledge-browser'
import {
  getKnowledgeBaseById,
  getKnowledgeBaseEffectiveRoot,
  readKnowledgeBaseConfig,
} from '../../../server/knowledge-config'

export const Route = createFileRoute('/api/knowledge/list')({
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
          const base = getKnowledgeBaseById(baseId)
          const source = base?.source ?? config.source
          const exists = knowledgeRootExists(base?.id)
          return json({
            pages: exists ? listKnowledgePages(base?.id) : [],
            exists,
            source,
            base,
            bases: config.bases ?? [],
            activeBaseId: base?.id ?? config.activeBaseId,
            knowledgeRoot: getKnowledgeBaseEffectiveRoot(source),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to list knowledge pages',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
