/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cacheClaudeAuthStatus,
  fetchClaudeAuthStatus,
  getCachedClaudeAuthStatus,
} from './claude-auth'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('Claude auth cache', () => {
  it('caches successful authenticated app-level login status', () => {
    cacheClaudeAuthStatus({ authenticated: true, authRequired: true }, 1_000)

    expect(getCachedClaudeAuthStatus(2_000)).toEqual({
      authenticated: true,
      authRequired: true,
    })
  })

  it('clears cached auth when the server says the user is not authenticated', () => {
    cacheClaudeAuthStatus({ authenticated: true, authRequired: true }, 1_000)
    cacheClaudeAuthStatus({ authenticated: false, authRequired: true }, 2_000)

    expect(getCachedClaudeAuthStatus(3_000)).toBeNull()
  })

  it('falls back to the cached auth state when auth-check returns a transient error', async () => {
    cacheClaudeAuthStatus(
      { authenticated: true, authRequired: true },
      Date.now(),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })),
    )

    await expect(fetchClaudeAuthStatus()).resolves.toEqual({
      authenticated: true,
      authRequired: true,
    })
    expect(fetch).toHaveBeenCalledWith('/api/auth-check', {
      credentials: 'same-origin',
      signal: expect.any(AbortSignal),
    })
  })
})
