const { test, expect } = require('@playwright/test')
const { API_ORIGIN, authHeader, createGuestSession, createRoomByApi, expectOk } = require('./support/fixtures')

test.describe('API-backed E2E contracts', () => {
  test('health endpoint is available in the managed E2E backend', async ({ page }) => {
    const response = await page.request.get('http://127.0.0.1:3000/health')

    await expectOk(response, 'Health check')
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  test('rejects room creation without an auth token', async ({ page }) => {
    const response = await page.request.post(`${API_ORIGIN}/rooms`)

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }))
  })

  test('creates a guest session and room through real API calls', async ({ page }) => {
    const session = await createGuestSession(page, 'API Guest')
    const room = await createRoomByApi(page, 'API Host')

    expect(session).toMatchObject({ token: expect.any(String), user: expect.objectContaining({ username: 'API Guest' }) })
    expect(room).toMatchObject({ message: 'Room created', roomCode: expect.stringMatching(/^[A-Z0-9]+$/) })
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
