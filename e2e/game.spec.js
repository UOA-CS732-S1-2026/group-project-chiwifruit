const { test, expect } = require('@playwright/test')
const { io } = require('socket.io-client')
const { BACKEND_ORIGIN, seedGuestAuth } = require('./support/fixtures')

function connectSocket(session) {
  return new Promise((resolve, reject) => {
    const socket = io(BACKEND_ORIGIN, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: session.token },
    })

    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve)
  })
}

async function createStartedTwoPlayerGame(browser) {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const hostPage = await hostContext.newPage()
  const guestPage = await guestContext.newPage()
  const sockets = []

  const hostSession = await seedGuestAuth(hostPage, 'Gameplay Host')
  await hostPage.getByRole('button', { name: /create a room/i }).click()
  await expect(hostPage).toHaveURL(/\/room\/[A-Z0-9]+$/)
  const roomCode = hostPage.url().slice(hostPage.url().lastIndexOf('/') + 1).toUpperCase()

  const guestSession = await seedGuestAuth(guestPage, 'Gameplay Guest')
  await guestPage.getByRole('button', { name: /join with code/i }).click()
  await guestPage.getByLabel(/room code/i).fill(roomCode)
  await guestPage.getByRole('button', { name: /join game/i }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/room/${roomCode}$`, 'i'))

  await guestPage.getByRole('button', { name: /click to ready/i }).click()
  await expect(hostPage.getByRole('button', { name: /start game/i })).toBeEnabled()
  await hostPage.getByRole('button', { name: /start game/i }).click()

  await expect(hostPage).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'))
  await expect(guestPage).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'))

  const hostSocket = await connectSocket(hostSession)
  const guestSocket = await connectSocket(guestSession)
  sockets.push(hostSocket, guestSocket)

  hostSocket.emit('join_room', { roomCode })
  guestSocket.emit('join_room', { roomCode })

  await emitWithAck(hostSocket, 'game_familiar_ready', { roomCode })
  const guestReadyAck = await emitWithAck(guestSocket, 'game_familiar_ready', { roomCode })
  expect(guestReadyAck).toMatchObject({ ok: true, game: expect.objectContaining({ status: 'playing' }) })

  await expect(hostPage.getByRole('button', { name: /sound pad 3/i })).toBeEnabled({ timeout: 10_000 })

  return {
    roomCode,
    hostPage,
    guestPage,
    hostContext,
    guestContext,
    sockets,
  }
}

async function finishGameByWrongNote(game) {
  const { hostPage, guestPage } = game

  await hostPage.getByRole('button', { name: /sound pad 3/i }).click()
  await expect(guestPage.getByRole('button', { name: /sound pad 4/i })).toBeEnabled({ timeout: 10_000 })
  await guestPage.getByRole('button', { name: /sound pad 4/i }).click()

  await expect(hostPage.getByRole('heading', { name: /game over/i })).toBeVisible({ timeout: 10_000 })
  await expect(guestPage.getByRole('heading', { name: /game over/i })).toBeVisible({ timeout: 10_000 })
}

async function closeGame(game) {
  game.sockets.forEach((socket) => socket.disconnect())
  await game.hostContext.close()
  await game.guestContext.close()
}

test.describe('Gameplay and results E2E', () => {
  test('plays a real two-player round, finishes on a wrong note, and returns home from results', async ({ browser }) => {
    const game = await createStartedTwoPlayerGame(browser)

    try {
      await finishGameByWrongNote(game)

      await expect(game.hostPage.getByText(/points/i).first()).toBeVisible()
      await game.hostPage.getByRole('button', { name: /back to home/i }).click()

      await expect(game.hostPage).toHaveURL(/\/$/)
      await expect(game.hostPage.getByRole('heading', { name: /build the sequence/i })).toBeVisible()
    } finally {
      await closeGame(game)
    }
  })

  test('returns from game results back to the waiting room', async ({ browser }) => {
    const game = await createStartedTwoPlayerGame(browser)

    try {
      await finishGameByWrongNote(game)

      await game.guestPage.getByRole('button', { name: /back to room/i }).click()

      await expect(game.guestPage).toHaveURL(new RegExp(`/room/${game.roomCode}$`, 'i'))
      await expect(game.guestPage.getByRole('heading', { name: /waiting room/i })).toBeVisible()
      await expect(game.guestPage.getByText(game.roomCode)).toBeVisible()
    } finally {
      await closeGame(game)
    }
  })
})
