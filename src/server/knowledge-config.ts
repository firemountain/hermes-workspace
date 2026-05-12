import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type KnowledgeBaseSource =
  | { type: 'local'; path: string }
  | { type: 'github'; repo: string; branch: string; path: string }

export type KnowledgeBaseEntry = {
  id: string
  name: string
  description?: string
  source: KnowledgeBaseSource
  swarm?: {
    root: string
    qaCommand?: string
  }
}

export type KnowledgeBaseConfig = {
  source: KnowledgeBaseSource
  activeBaseId?: string
  bases?: Array<KnowledgeBaseEntry>
}

const DEFAULT_SOURCE: KnowledgeBaseSource = { type: 'local', path: '' }

const DEFAULT_CONFIG: KnowledgeBaseConfig = {
  source: DEFAULT_SOURCE,
  bases: [],
}

function hermesHome(): string {
  return process.env.HERMES_HOME ?? path.join(os.homedir(), '.hermes')
}

function getConfigPath(): string {
  return path.join(hermesHome(), 'knowledge-config.json')
}

function expandHome(input: string): string {
  return path.resolve(input.replace(/^~\//, os.homedir() + '/'))
}

function sourceSignature(source: KnowledgeBaseSource): string {
  if (source.type === 'github') {
    return `github:${source.repo}:${source.branch}:${source.path}`
  }
  return `local:${expandHome(source.path || '')}`
}

function defaultLocalBase(
  id: string,
  name: string,
  localPath: string,
  description: string,
  swarm?: KnowledgeBaseEntry['swarm'],
): KnowledgeBaseEntry | null {
  if (!fs.existsSync(localPath)) return null
  return {
    id,
    name,
    description,
    source: { type: 'local', path: localPath },
    ...(swarm ? { swarm } : {}),
  }
}

export function getDiscoveredKnowledgeBases(): Array<KnowledgeBaseEntry> {
  return [
    defaultLocalBase(
      'human-design',
      'Human Design LLM Wiki',
      '/home/avalon/wiki-human-design',
      'Source-grounded Human Design wiki for chart, transit, variable, and comparison analysis.',
      { root: '/home/avalon/hd-wiki-swarm', qaCommand: 'python3 scripts/wiki_qa.py' },
    ),
    defaultLocalBase(
      'astrology',
      'Astrology Wiki',
      '/home/avalon/wiki',
      'Astrology research/wiki vault.',
    ),
    defaultLocalBase(
      'human-design-legacy',
      'Human Design Wiki Legacy/Repo',
      '/home/avalon/wiki-human-design',
      'Alias for the current Human Design wiki path.',
    ),
  ].filter(Boolean) as Array<KnowledgeBaseEntry>
}

function mergeBases(config: KnowledgeBaseConfig): Array<KnowledgeBaseEntry> {
  const discovered = getDiscoveredKnowledgeBases()
  const configured = config.bases ?? []
  const byId = new Map<string, KnowledgeBaseEntry>()
  for (const base of discovered) byId.set(base.id, base)
  for (const base of configured) byId.set(base.id, base)

  if (config.source.type === 'local' && config.source.path.trim()) {
    const sig = sourceSignature(config.source)
    const exists = Array.from(byId.values()).some((base) => sourceSignature(base.source) === sig)
    if (!exists) {
      byId.set('configured', {
        id: 'configured',
        name: 'Configured Knowledge Base',
        description: 'Knowledge base from legacy single-source configuration.',
        source: config.source,
      })
    }
  }

  if (config.source.type === 'github') {
    const sig = sourceSignature(config.source)
    const exists = Array.from(byId.values()).some((base) => sourceSignature(base.source) === sig)
    if (!exists) {
      byId.set('configured', {
        id: 'configured',
        name: 'Configured GitHub Knowledge Base',
        description: 'Knowledge base from legacy single-source configuration.',
        source: config.source,
      })
    }
  }

  return Array.from(byId.values())
}

function normalizeConfig(parsed: Partial<KnowledgeBaseConfig>): KnowledgeBaseConfig {
  const source = parsed.source ?? DEFAULT_CONFIG.source
  const bases = mergeBases({
    source,
    activeBaseId: parsed.activeBaseId,
    bases: parsed.bases ?? [],
  })
  let activeBaseId = parsed.activeBaseId
  if (!activeBaseId && source.type === 'local' && source.path.trim()) {
    const sig = sourceSignature(source)
    activeBaseId = bases.find((base) => sourceSignature(base.source) === sig)?.id
  }
  if (!activeBaseId && bases.length > 0) activeBaseId = bases[0]?.id
  const activeBase = bases.find((base) => base.id === activeBaseId)
  return {
    source: activeBase?.source ?? source,
    activeBaseId,
    bases,
  }
}

export function readKnowledgeBaseConfig(): KnowledgeBaseConfig {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<KnowledgeBaseConfig>
      return normalizeConfig(parsed)
    }
  } catch {
    // ignore parse errors, use defaults + discovered bases
  }
  return normalizeConfig(DEFAULT_CONFIG)
}

export function writeKnowledgeBaseConfig(config: KnowledgeBaseConfig): void {
  const configPath = getConfigPath()
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const normalized = normalizeConfig(config)
  fs.writeFileSync(configPath, JSON.stringify(normalized, null, 2), 'utf-8')
}

export function getKnowledgeBaseById(id?: string): KnowledgeBaseEntry | null {
  const config = readKnowledgeBaseConfig()
  const targetId = id || config.activeBaseId
  if (!targetId) return null
  return config.bases?.find((base) => base.id === targetId) ?? null
}

export function getActiveKnowledgeBase(): KnowledgeBaseEntry | null {
  return getKnowledgeBaseById()
}

export function getKnowledgeBaseEffectiveRoot(source?: KnowledgeBaseSource): string {
  const targetSource = source ?? readKnowledgeBaseConfig().source
  if (targetSource.type === 'local') {
    const p = targetSource.path.trim()
    if (p) return expandHome(p)
  }
  // fallback: legacy env var or Hermes-native default. Claude path is kept only
  // as a final read-only compatibility fallback in the browser layer.
  if (process.env.KNOWLEDGE_DIR) return path.resolve(process.env.KNOWLEDGE_DIR)
  return path.join(hermesHome(), 'knowledge')
}
