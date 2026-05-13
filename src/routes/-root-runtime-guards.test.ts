import { describe, expect, it, vi } from 'vitest'
import {
  isBackendReadyForWorkspace,
  registerAppServiceWorker,
  syncWorkspaceOnboardingFromBackend,
  wrapInlineScript,
} from './__root'

describe('root runtime guards', () => {
  it('wraps inline scripts in a top-level try/catch', () => {
    const wrapped = wrapInlineScript('window.answer = 42;')
    expect(wrapped).toContain('try {')
    expect(wrapped).toContain('window.answer = 42;')
    expect(wrapped).toContain("console.error('Inline bootstrap script failed'")
  })

  it('clears old caches and registers the network-only PWA service worker', async () => {
    const register = vi.fn().mockResolvedValue(undefined)
    const deleteCache = vi.fn().mockResolvedValue(true)

    await expect(
      registerAppServiceWorker({
        serviceWorker: { register },
        cachesApi: { keys: vi.fn().mockResolvedValue(['stale']), delete: deleteCache },
      }),
    ).resolves.toBeUndefined()

    expect(deleteCache).toHaveBeenCalledWith('stale')
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
  })

  it('marks connection-status enhanced/connected responses as backend-ready', () => {
    expect(isBackendReadyForWorkspace({ status: 'enhanced' })).toBe(true)
    expect(isBackendReadyForWorkspace({ status: 'connected' })).toBe(true)
    expect(
      isBackendReadyForWorkspace({ chatReady: true, modelConfigured: true }),
    ).toBe(true)
    expect(
      isBackendReadyForWorkspace({ capabilities: { chatCompletions: true } }),
    ).toBe(true)
    expect(isBackendReadyForWorkspace({ status: 'partial', chatReady: false })).toBe(false)
  })

  it('persists onboarding completion from the first healthy backend probe', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'enhanced' }),
    })
    const storage = { setItem: vi.fn() }

    await expect(
      syncWorkspaceOnboardingFromBackend({
        fetcher: fetcher as unknown as typeof fetch,
        storage,
      }),
    ).resolves.toBe(true)

    expect(fetcher).toHaveBeenCalledWith('/api/connection-status', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    expect(storage.setItem).toHaveBeenCalledWith(
      'claude-onboarding-complete',
      'true',
    )
  })

  it('falls back to gateway-status when connection-status is not yet authorized', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ capabilities: { chatCompletions: true } }),
      })
    const storage = { setItem: vi.fn() }

    await expect(
      syncWorkspaceOnboardingFromBackend({
        fetcher: fetcher as unknown as typeof fetch,
        storage,
      }),
    ).resolves.toBe(true)

    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/gateway-status', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    expect(storage.setItem).toHaveBeenCalledWith(
      'claude-onboarding-complete',
      'true',
    )
  })
})
