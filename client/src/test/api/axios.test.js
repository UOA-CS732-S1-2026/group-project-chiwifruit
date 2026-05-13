import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadAxiosModule() {
  vi.resetModules()
  return import('../../api/axios')
}

function readJson(storage, key) {
  return JSON.parse(storage.getItem(key))
}

// Unit scope: verify browser-session persistence and request auth wiring without making HTTP calls.
describe('frontend auth storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-13T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should store guest sessions in sessionStorage and clear localStorage', async () => {
    const { setStoredAuthSession, getStoredAuthToken, getStoredAuthUser } = await loadAxiosModule()

    window.localStorage.setItem('kichain:authToken', 'old-user-token')
    window.localStorage.setItem('kichain:authUser', JSON.stringify({ id: 'old-user', isGuest: false }))
    window.localStorage.setItem('kichain:authExpiresAt', String(Date.now() + 1000))

    setStoredAuthSession({
      token: 'guest-token',
      user: { id: 'guest-1', username: 'Guest One', isGuest: true },
    })

    expect(window.sessionStorage.getItem('kichain:authToken')).toBe('guest-token')
    expect(readJson(window.sessionStorage, 'kichain:authUser')).toEqual({
      id: 'guest-1',
      username: 'Guest One',
      isGuest: true,
    })
    expect(Number(window.sessionStorage.getItem('kichain:authExpiresAt'))).toBe(Date.now() + 60 * 60 * 1000)
    expect(window.localStorage.getItem('kichain:authToken')).toBeNull()
    expect(getStoredAuthToken()).toBe('guest-token')
    expect(getStoredAuthUser()).toEqual({ id: 'guest-1', username: 'Guest One', isGuest: true })
  })

  it('should store registered user sessions in localStorage and clear sessionStorage', async () => {
    const { setStoredAuthSession, getStoredAuthToken, getStoredAuthUser } = await loadAxiosModule()

    window.sessionStorage.setItem('kichain:authToken', 'old-guest-token')
    window.sessionStorage.setItem('kichain:authUser', JSON.stringify({ id: 'guest-1', isGuest: true }))
    window.sessionStorage.setItem('kichain:authExpiresAt', String(Date.now() + 1000))

    setStoredAuthSession({
      token: 'user-token',
      user: { id: 'user-1', username: 'Zoe', isGuest: false },
    })

    expect(window.localStorage.getItem('kichain:authToken')).toBe('user-token')
    expect(readJson(window.localStorage, 'kichain:authUser')).toEqual({
      id: 'user-1',
      username: 'Zoe',
      isGuest: false,
    })
    expect(window.sessionStorage.getItem('kichain:authToken')).toBeNull()
    expect(getStoredAuthToken()).toBe('user-token')
    expect(getStoredAuthUser()).toEqual({ id: 'user-1', username: 'Zoe', isGuest: false })
  })

  it('should clear expired sessions before returning auth values', async () => {
    const { getStoredAuthToken, getStoredAuthUser } = await loadAxiosModule()

    window.localStorage.setItem('kichain:authToken', 'expired-token')
    window.localStorage.setItem('kichain:authUser', JSON.stringify({ id: 'user-1', isGuest: false }))
    window.localStorage.setItem('kichain:authExpiresAt', String(Date.now() - 1))

    expect(getStoredAuthToken()).toBeNull()
    expect(getStoredAuthUser()).toBeNull()
    expect(window.localStorage.getItem('kichain:authToken')).toBeNull()
    expect(window.localStorage.getItem('kichain:authUser')).toBeNull()
    expect(window.localStorage.getItem('kichain:authExpiresAt')).toBeNull()
  })

  it('should backfill expiry for legacy sessions without an expiresAt value', async () => {
    const { getStoredAuthToken } = await loadAxiosModule()

    window.localStorage.setItem('kichain:authToken', 'legacy-token')
    window.localStorage.setItem('kichain:authUser', JSON.stringify({ id: 'user-legacy', isGuest: false }))

    expect(getStoredAuthToken()).toBe('legacy-token')
    expect(Number(window.localStorage.getItem('kichain:authExpiresAt'))).toBe(Date.now() + 60 * 60 * 1000)
  })

  it('should clear storage when setStoredAuthSession receives an invalid session', async () => {
    const { setStoredAuthSession, getStoredAuthToken } = await loadAxiosModule()

    window.localStorage.setItem('kichain:authToken', 'token')
    window.localStorage.setItem('kichain:authUser', JSON.stringify({ id: 'user-1' }))
    window.localStorage.setItem('kichain:authExpiresAt', String(Date.now() + 1000))

    setStoredAuthSession({ token: '', user: { id: 'user-1' } })

    expect(getStoredAuthToken()).toBeNull()
    expect(window.localStorage.getItem('kichain:authToken')).toBeNull()
  })

  it('should attach the active token to axios requests', async () => {
    const { default: api, setStoredAuthSession } = await loadAxiosModule()

    setStoredAuthSession({ token: 'request-token', user: { id: 'user-1', isGuest: false } })

    const requestConfig = await api.interceptors.request.handlers[0].fulfilled({ headers: {} })

    expect(requestConfig.headers.Authorization).toBe('Bearer request-token')
  })
})
