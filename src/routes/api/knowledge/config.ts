import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  readKnowledgeBaseConfig,
  writeKnowledgeBaseConfig,
} from '../../../server/knowledge-config'
import type { KnowledgeBaseConfig } from '../../../server/knowledge-config'

export const Route = createFileRoute('/api/knowledge/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          return json({ config: readKnowledgeBaseConfig() })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to read knowledge base config',
            },
            { status: 500 },
          )
        }
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await request.json()) as Partial<KnowledgeBaseConfig>
          const current = readKnowledgeBaseConfig()
          const requestedBase = body.activeBaseId
            ? current.bases?.find((base) => base.id === body.activeBaseId)
            : null
          const next: KnowledgeBaseConfig = {
            source: requestedBase?.source ?? body.source ?? current.source,
            activeBaseId: body.activeBaseId ?? current.activeBaseId,
            bases: body.bases ?? current.bases,
          }
          writeKnowledgeBaseConfig(next)
          return json({ config: readKnowledgeBaseConfig() })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to save knowledge base config',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
