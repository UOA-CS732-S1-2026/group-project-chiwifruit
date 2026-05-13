const { test, expect } = require('@playwright/test')
const {
  BACKEND_ORIGIN,
  API_ORIGIN,
  authHeader,
  createGuestSession,
  createRoomByApi,
  expectOk,
} = require('./support/fixtures')

async function joinRoomAs(page, roomCode, username) {
  const session = await createGuestSession(page, username)
  const response = await page.request.post(`${API_ORIGIN}/rooms`, {
    headers: authHeader(session),
    data: { joinRoomCode: roomCode },
  })
  await expectOk(response, `Join room as ${username}`)
  return session
}

async function getRoomState(page, roomCode, session) {
  const response = await page.request.get(`${API_ORIGIN}/rooms/${roomCode}/ready`, {
    headers: authHeader(session),
  })
  await expectOk(response, 'Get room state')
  return response.json()
}

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

  test('rejects invalid host-selected room settings', async ({ page }) => {
    const host = await createGuestSession(page, 'Invalid Setting Host')
    const createResponse = await page.request.post(`${API_ORIGIN}/rooms`, {
      headers: authHeader(host),
    })
    await expectOk(createResponse, 'Create room for invalid settings')
    const room = await createResponse.json()

    const invalidModeResponse = await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/mode`, {
      headers: authHeader(host),
      data: { mode: 'kazoo' },
    })
    expect(invalidModeResponse.status()).toBe(400)
    await expect(invalidModeResponse.json()).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }))

    const invalidDifficultyResponse = await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/difficulty`, {
      headers: authHeader(host),
      data: { difficulty: 'extreme' },
    })
    expect(invalidDifficultyResponse.status()).toBe(400)
    await expect(invalidDifficultyResponse.json()).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }))
  })

  test('supports ready on-off-on transitions for multiple players', async ({ page }) => {
    const host = await createGuestSession(page, 'Ready Transition Host')
    const createResponse = await page.request.post(`${API_ORIGIN}/rooms`, {
      headers: authHeader(host),
    })
    await expectOk(createResponse, 'Create room for ready transitions')
    const room = await createResponse.json()
    const guestOne = await joinRoomAs(page, room.roomCode, 'Ready Transition Guest One')
    const guestTwo = await joinRoomAs(page, room.roomCode, 'Ready Transition Guest Two')

    await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/ready`, {
      headers: authHeader(guestOne),
      data: { isReady: true },
    }).then((response) => expectOk(response, 'Guest one ready'))
    await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/ready`, {
      headers: authHeader(guestTwo),
      data: { isReady: true },
    }).then((response) => expectOk(response, 'Guest two ready'))

    let state = await getRoomState(page, room.roomCode, host)
    expect(state.canStartGame).toBe(true)
    expect(state.participants.filter((participant) => participant.isReady)).toHaveLength(2)

    await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/ready`, {
      headers: authHeader(guestOne),
      data: { isReady: false },
    }).then((response) => expectOk(response, 'Guest one unready'))

    state = await getRoomState(page, room.roomCode, host)
    expect(state.canStartGame).toBe(false)
    expect(state.participants.filter((participant) => participant.isReady)).toHaveLength(1)

    await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/ready`, {
      headers: authHeader(guestOne),
      data: { isReady: true },
    }).then((response) => expectOk(response, 'Guest one ready again'))

    state = await getRoomState(page, room.roomCode, host)
    expect(state.canStartGame).toBe(true)
    expect(state.participants.filter((participant) => participant.isReady)).toHaveLength(2)
  })

  test('rejects ready and leave actions from a user who is not in the room', async ({ page }) => {
    const room = await createRoomByApi(page, 'Not Joined Host')
    const outsider = await createGuestSession(page, 'Not Joined Outsider')

    const readyResponse = await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/ready`, {
      headers: authHeader(outsider),
      data: { isReady: true },
    })
    expect(readyResponse.status()).toBe(403)

    const leaveResponse = await page.request.delete(`${API_ORIGIN}/rooms/${room.roomCode}`, {
      headers: authHeader(outsider),
    })
    expect(leaveResponse.status()).toBe(403)
  })

  test('tracks six participants, readiness, and host-selected settings', async ({ page }) => {
    const host = await createGuestSession(page, 'Six Player Host')
    const createResponse = await page.request.post(`${API_ORIGIN}/rooms`, {
      headers: authHeader(host),
    })
    await expectOk(createResponse, 'Create six-player room')
    const room = await createResponse.json()

    const guests = []
    for (let index = 1; index <= 5; index += 1) {
      guests.push(await joinRoomAs(page, room.roomCode, `Six Player Guest ${index}`))
    }

    await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/mode`, {
      headers: authHeader(host),
      data: { mode: 'aussie' },
    }).then((response) => expectOk(response, 'Set mode'))

    await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/difficulty`, {
      headers: authHeader(host),
      data: { difficulty: 'hard' },
    }).then((response) => expectOk(response, 'Set difficulty'))

    for (const guest of guests) {
      await page.request.patch(`${API_ORIGIN}/rooms/${room.roomCode}/ready`, {
        headers: authHeader(guest),
        data: { isReady: true },
      }).then((response) => expectOk(response, 'Set guest ready'))
    }

    const state = await getRoomState(page, room.roomCode, host)

    expect(state).toMatchObject({
      roomCode: room.roomCode,
      participantCount: 6,
      maxParticipantCount: 6,
      mode: 'aussie',
      difficulty: 'hard',
      canStartGame: true,
    })
    expect(state.participants).toHaveLength(6)
    expect(state.participants.filter((participant) => participant.isReady)).toHaveLength(5)
  })

  test('updates the roster and transfers host after the current host leaves', async ({ page }) => {
    const host = await createGuestSession(page, 'Leaving Host')
    const createResponse = await page.request.post(`${API_ORIGIN}/rooms`, {
      headers: authHeader(host),
    })
    await expectOk(createResponse, 'Create room before host leave')
    const room = await createResponse.json()

    const guestOne = await joinRoomAs(page, room.roomCode, 'Remaining Guest One')
    const guestTwo = await joinRoomAs(page, room.roomCode, 'Remaining Guest Two')

    const leaveResponse = await page.request.delete(`${API_ORIGIN}/rooms/${room.roomCode}`, {
      headers: authHeader(host),
    })
    await expectOk(leaveResponse, 'Host leaves room')

    const state = await getRoomState(page, room.roomCode, guestOne)

    expect(state.participantCount).toBe(2)
    expect(state.hostId).toBe(guestOne.user.id)
    expect(state.participants.map((participant) => participant.userId)).toEqual([
      guestOne.user.id,
      guestTwo.user.id,
    ])
  })

  test('deletes the room after the last participant leaves', async ({ page }) => {
    const host = await createGuestSession(page, 'Last Leaver Host')
    const createResponse = await page.request.post(`${API_ORIGIN}/rooms`, {
      headers: authHeader(host),
    })
    await expectOk(createResponse, 'Create room before final leave')
    const room = await createResponse.json()

    const leaveResponse = await page.request.delete(`${API_ORIGIN}/rooms/${room.roomCode}`, {
      headers: authHeader(host),
    })
    await expectOk(leaveResponse, 'Last participant leaves room')

    const stateResponse = await page.request.get(`${API_ORIGIN}/rooms/${room.roomCode}/ready`, {
      headers: authHeader(host),
    })

    expect(stateResponse.status()).toBe(404)
    await expect(stateResponse.json()).resolves.toEqual(expect.objectContaining({ message: 'Room not found' }))
  })

  test('rejects the seventh participant and preserves the six-player room limit', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const hostPage = await hostContext.newPage()

    try {
      const room = await createRoomByApi(hostPage, 'Capacity Host')

      for (let index = 1; index <= 5; index += 1) {
        const context = await browser.newContext()
        const page = await context.newPage()
        await joinRoomAs(page, room.roomCode, `Capacity Guest ${index}`)
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
