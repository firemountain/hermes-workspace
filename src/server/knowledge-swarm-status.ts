import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { getKnowledgeBaseById, readKnowledgeBaseConfig } from './knowledge-config'

type PackageRecord = { status?: string; [key: string]: unknown }

function readJsonFile(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function summarizeLedger(ledger: unknown): { total: number; byStatus: Record<string, number> } {
  const ledgerObject = ledger as { packages?: unknown } | null
  const packages = Array.isArray(ledger)
    ? ledger
    : ledgerObject && Array.isArray(ledgerObject.packages)
      ? ledgerObject.packages
      : []
  const byStatus: Record<string, number> = {}
  for (const item of packages as Array<PackageRecord>) {
    const status = item.status || 'unknown'
    byStatus[status] = (byStatus[status] ?? 0) + 1
  }
  return { total: packages.length, byStatus }
}

function findNewestReport(root: string): string | null {
  const reportsDir = path.join(root, 'reports')
  try {
    if (!fs.existsSync(reportsDir)) return null
    const files = fs
      .readdirSync(reportsDir)
      .map((name) => path.join(reportsDir, name))
      .filter((filePath) => fs.statSync(filePath).isFile())
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    return files[0] ?? null
  } catch {
    return null
  }
}

function runQa(qaCommand: string | undefined, wikiRoot: string): string | null {
  if (!qaCommand) return null
  const [command, ...args] = qaCommand.split(/\s+/).filter(Boolean)
  if (!command) return null
  try {
    return execFileSync(command, args, {
      cwd: wikiRoot,
      encoding: 'utf-8',
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    })
  } catch (error) {
    const maybe = error as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string }
    return `${maybe.stdout ? String(maybe.stdout) : ''}${maybe.stderr ? String(maybe.stderr) : ''}${maybe.message || ''}`.trim()
  }
}

export function getKnowledgeSwarmStatus(baseId?: string): Record<string, unknown> {
  const config = readKnowledgeBaseConfig()
  const base = getKnowledgeBaseById(baseId || config.activeBaseId)
  if (!base?.swarm) {
    return { available: false, reason: 'No swarm configured for this knowledge base' }
  }

  const root = base.swarm.root
  const state = readJsonFile(path.join(root, 'state', 'swarm-state.json'))
  const ledger = readJsonFile(path.join(root, 'inventory', 'package-ledger.json'))
  const newestReport = findNewestReport(root)
  const wikiRoot = base.source.type === 'local' ? base.source.path : process.cwd()

  return {
    available: fs.existsSync(root),
    baseId: base.id,
    root,
    state,
    ledger: summarizeLedger(ledger),
    newestReport: newestReport
      ? {
          path: newestReport,
          modified: fs.statSync(newestReport).mtime.toISOString(),
        }
      : null,
    qa: runQa(base.swarm.qaCommand, wikiRoot),
  }
}
