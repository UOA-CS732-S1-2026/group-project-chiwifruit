const { test, expect } = require('@playwright/test')
const {
  BACKEND_ORIGIN,
  API_ORIGIN,
  authHeader,
  createGuestSession,
  createRoomByApi,
  expectOk,
} = require('./support/fixtures')

test.describe('API-backed E2E contracts', () => {
  test('health endpoint is available in the managed E2E backend', async ({ page }) => {
    const response = await page.request.get(`${BACKEND_ORIGIN}/health`)

    await expectOk(response, 'Health check')
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  test('creates a guest session through the managed backend', async ({ page }) => {
    const session = await createGuestSession(page, 'API Guest')

    expect(session).toMatchObject({
      message: 'Guest session created',
      token: expect.any(String),
      user: expect.objectContaining({
        id: expect.stringMatching(/^guest_/),
        username: expect.any(String),
        isGuest: true,
        avatarUrl: expect.stringContaining('dicebear'),
      }),
    })
  })

  test('rejects room creation without an auth token', async ({ page }) => {
    const response = await page.request.post(`${API_ORIGIN}/rooms`)

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }))
  })

  test('creates a room through real API calls', async ({ page }) => {
    const room = await createRoomByApi(page, 'API Host')

    expect(room).toMatchObject({
      message: 'Room created',
      roomCode: expect.stringMatching(/^[A-Z0-9]+$/),
    })
  })

  test('returns 404 for joining a missing room', async ({ page }) => {
    const session = await createGuestSession(page, 'Missing Room Guest')

    const response = await page.request.post(`${API_ORIGIN}/rooms`, {
      headers: authHeader(session),
      data: { joinRoomCode: 'NOPE99' },
    })

    expect(response.status()).toBe(404)
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ message: 'Room not found' }))
  })

  test('rejects room state reads without an auth token', async ({ page }) => {
    const room = await createRoomByApi(page, 'Protected Room Host')

    const response = await page.request.get(`${API_ORIGIN}/rooms/${room.roomCode}/ready`)

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }))
  })

  test('rejects non-host room setting changes', async ({ page }) => {
    const room = await createRoomByApi(page, 'Mode Host')
    const guest = await createGuestSession(page, 'Mode Guest')

    const joinResponse = await page.request.post(`${API_ORIGIN}/rooms`, {
      headers: authHeader(guest),
      data: { joinRoomCode: room.roomCode },
    })
    await expectOk(joinResponse, 'Join room as non-host')

    const response = await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/mode`, {
      headers: authHeader(guest),
      data: { mode: 'piano' },
    })

    expect(response.status()).toBe(403)
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }))
  })

  test('rejects the seventh participant and preserves the six-player room limit', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const hostPage = await hostContext.newPage()

    try {
      const room = await createRoomByApi(hostPage, 'Capacity Host')

      for (let index = 1; index <= 5; index += 1) {
        const context = await browser.newContext()
        const page = await context.newPage()
        const session = await createGuestSession(page, `Capacity Guest ${index}`)

        const joinResponse = await page.request.post(`${API_ORIGIN}/rooms`, {
          headers: authHeader(session),
          data: { joinRoomCode: room.roomCode },
        })
        await expectOk(joinResponse, `Join room as guest ${index}`)
        await context.close()
      }

      const overflowContext = await browser.newContext()
      const overflowPage = await overflowContext.newPage()
      const overflowSession = await createGuestSession(overflowPage, 'Overflow Guest')

      const overflowResponse = await overflowPage.request.post(`${API_ORIGIN}/rooms`, {
        headers: authHeader(overflowSession),
        data: { joinRoomCode: room.roomCode },
      })

      expect(overflowResponse.status()).toBe(409)
      await expect(overflowResponse.json()).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }))
      await overflowContext.close()
    } finally {
      await hostContext.close()
    }
  })
})
