export interface AuthStatus {
  authenticated: boolean
  authRequired: boolean
  error?: string
}

const AUTH_CACHE_KEY = 'hermes-workspace-auth-cache-v1'
const AUTH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

type CachedAuthStatus = AuthStatus & {
  cachedAt: number
  expiresAt: number
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function cacheClaudeAuthStatus(
  status: AuthStatus,
  now = Date.now(),
): void {
  const storage = getStorage()
  if (!storage) return

  if (!status.authRequired || !status.authenticated) {
    storage.removeItem(AUTH_CACHE_KEY)
    return
  }

  const cached: CachedAuthStatus = {
    ...status,
    cachedAt: now,
    expiresAt: now + AUTH_CACHE_TTL_MS,
  }
  storage.setItem(AUTH_CACHE_KEY, JSON.stringify(cached))
}

export function getCachedClaudeAuthStatus(now = Date.now()): AuthStatus | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(AUTH_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as Partial<CachedAuthStatus>
    if (
      cached.authRequired === true &&
      cached.authenticated === true &&
      typeof cached.expiresAt === 'number' &&
      cached.expiresAt > now
    ) {
      return { authenticated: true, authRequired: true }
    }
  } catch {
    // Corrupt cache; clear it below.
  }

  storage.removeItem(AUTH_CACHE_KEY)
  return null
}

export async function fetchClaudeAuthStatus(
  timeoutMs = 5_000,
): Promise<AuthStatus> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch('/api/auth-check', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
  } catch (error) {
    const cached = getCachedClaudeAuthStatus()
    if (cached) return cached

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out after 5 seconds')
    }

    throw error instanceof Error
      ? error
      : new Error('Failed to connect to Hermes Agent')
  } finally {
    globalThis.clearTimeout(timeout)
  }

  if (!res.ok) {
    const cached = getCachedClaudeAuthStatus()
    if (cached) return cached
    throw new Error(`HTTP ${res.status}`)
  }

  const status = (await res.json()) as AuthStatus
  cacheClaudeAuthStatus(status)
  return status
}
