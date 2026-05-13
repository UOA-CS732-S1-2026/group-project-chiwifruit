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

async function createStartedGame(browser, playerCount = 2) {
  const contexts = []
  const pages = []
  const sessions = []
  const sockets = []

  for (let index = 0; index < playerCount; index += 1) {
    const context = await browser.newContext()
    const page = await context.newPage()
    contexts.push(context)
    pages.push(page)
  }

  const hostPage = pages[0]
  const hostSession = await seedGuestAuth(hostPage, 'Gameplay Host')
  sessions.push(hostSession)

  await hostPage.getByRole('button', { name: /create a room/i }).click()
  await expect(hostPage).toHaveURL(/\/room\/[A-Z0-9]+$/)
  const roomCode = hostPage.url().slice(hostPage.url().lastIndexOf('/') + 1).toUpperCase()

  for (let index = 1; index < playerCount; index += 1) {
    const page = pages[index]
    const session = await seedGuestAuth(page, `Gameplay Guest ${index}`)
    sessions.push(session)

    await page.getByRole('button', { name: /join with code/i }).click()
    await page.getByLabel(/room code/i).fill(roomCode)
    await page.getByRole('button', { name: /join game/i }).click()
    await expect(page).toHaveURL(new RegExp(`/room/${roomCode}$`, 'i'))
    await page.getByRole('button', { name: /click to ready/i }).click()
  }

  await expect(hostPage.getByRole('button', { name: /start game/i })).toBeEnabled()
  await hostPage.getByRole('button', { name: /start game/i }).click()

  for (const page of pages) {
    await expect(page).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'))
  }

  for (const session of sessions) {
    const socket = await connectSocket(session)
    socket.emit('join_room', { roomCode })
    sockets.push(socket)
  }

  for (const socket of sockets) {
    const ack = await emitWithAck(socket, 'game_familiar_ready', { roomCode })
    expect(ack).toMatchObject({ ok: true })
  }

  await expect(hostPage.getByRole('button', { name: /sound pad 3/i })).toBeEnabled({ timeout: 10_000 })

  return {
    roomCode,
    contexts,
    pages,
    sessions,
    sockets,
    hostPage: pages[0],
    guestPage: pages[1],
    guestTwoPage: pages[2],
  }
}

async function hostAddsOpeningNote(game) {
  await game.hostPage.getByRole('button', { name: /sound pad 3/i }).click()
}

async function wrongNoteByUi(page) {
  await expect(page.getByRole('button', { name: /sound pad 4/i })).toBeEnabled({ timeout: 10_000 })
  await page.getByRole('button', { name: /sound pad 4/i }).click()
}

async function wrongNoteBySocket(game, playerIndex) {
  game.sockets[playerIndex].emit('game_pad_press', { roomCode: game.roomCode, padIndex: 3 })
}

async function expectPlayerOut(page) {
  await expect(page.getByRole('heading', { name: /you're out/i })).toBeVisible({ timeout: 10_000 })
}

async function expectGameOver(page) {
  await expect(page.getByRole('heading', { name: /game over/i })).toBeVisible({ timeout: 10_000 })
}

async function expectNoGameOver(page) {
  await expect(page.getByRole('heading', { name: /game over/i })).toHaveCount(0)
}

async function finishTwoPlayerGameByWrongNote(game) {
  await hostAddsOpeningNote(game)
  await wrongNoteByUi(game.guestPage)

  await expectGameOver(game.hostPage)
  await expectGameOver(game.guestPage)
}

async function eliminateFirstGuestInThreePlayerGame(game) {
  await hostAddsOpeningNote(game)
  await wrongNoteByUi(game.guestPage)

  await expectPlayerOut(game.guestPage)
  await expectNoGameOver(game.hostPage)
}

async function finishThreePlayerGameAfterFirstGuestIsOut(game) {
  await wrongNoteByUi(game.guestTwoPage)

  await expectGameOver(game.hostPage)
  await expectGameOver(game.guestTwoPage)
}

async function closeGame(game) {
  game.sockets.forEach((socket) => socket.disconnect())
  await Promise.all(game.contexts.map((context) => context.close()))
}

test.describe('Gameplay and results E2E', () => {
  test('plays a real two-player round, finishes on a wrong note, and returns home from results', async ({ browser }) => {
    const game = await createStartedGame(browser, 2)

    try {
      await finishTwoPlayerGameByWrongNote(game)

      await expect(game.hostPage.getByText(/points/i).first()).toBeVisible()
      await game.hostPage.getByRole('button', { name: /back to home/i }).click()

      await expect(game.hostPage).toHaveURL(/\/$/)
      await expect(game.hostPage.getByRole('heading', { name: /build the sequence/i })).toBeVisible()
    } finally {
      await closeGame(game)
    }
  })

  test('returns from game results back to the waiting room', async ({ browser }) => {
    const game = await createStartedGame(browser, 2)

    try {
      await finishTwoPlayerGameByWrongNote(game)

      await game.guestPage.getByRole('button', { name: /back to room/i }).click()

      await expect(game.guestPage).toHaveURL(new RegExp(`/room/${game.roomCode}$`, 'i'))
      await expect(game.guestPage.getByRole('heading', { name: /waiting room/i })).toBeVisible()
      await expect(game.guestPage.getByText(game.roomCode)).toBeVisible()
    } finally {
      await closeGame(game)
    }
  })

  test('keeps a three-player game running after the first wrong note and lets the eliminated player spectate', async ({ browser }) => {
    const game = await createStartedGame(browser, 3)

    try {
      await eliminateFirstGuestInThreePlayerGame(game)

      await game.guestPage.getByRole('button', { name: /keep spectating/i }).click()
      await expect(game.guestPage.getByRole('heading', { name: /you're out/i })).toHaveCount(0)
      await expect(game.guestPage.getByRole('heading', { name: /game over/i })).toHaveCount(0)
      await expect(game.guestTwoPage.getByRole('button', { name: /sound pad 4/i })).toBeEnabled({ timeout: 10_000 })
    } finally {
      await closeGame(game)
    }
  })

  test('lets an eliminated player return to the waiting room while the game continues', async ({ browser }) => {
    const game = await createStartedGame(browser, 3)

    try {
      await eliminateFirstGuestInThreePlayerGame(game)

      await game.guestPage.getByRole('button', { name: /back to waiting room/i }).click()

      await expect(game.guestPage).toHaveURL(new RegExp(`/room/${game.roomCode}$`, 'i'))
      await expect(game.guestPage.getByRole('heading', { name: /waiting room/i })).toBeVisible()
      await expectNoGameOver(game.hostPage)
    } finally {
      await closeGame(game)
    }
  })

  test('finishes a three-player game after two wrong notes and returns home from results', async ({ browser }) => {
    const game = await createStartedGame(browser, 3)

    try {
      await eliminateFirstGuestInThreePlayerGame(game)
      await finishThreePlayerGameAfterFirstGuestIsOut(game)

      await expect(game.hostPage.getByText(/points/i).first()).toBeVisible()
      await game.guestTwoPage.getByRole('button', { name: /back to home/i }).click()

      await expect(game.guestTwoPage).toHaveURL(/\/$/)
      await expect(game.guestTwoPage.getByRole('heading', { name: /build the sequence/i })).toBeVisible()
    } finally {
      await closeGame(game)
    }
  })

  test('continues a four-player game after one player returns to the waiting room and then reaches results', async ({ browser }) => {
    const game = await createStartedGame(browser, 4)

    try {
      await hostAddsOpeningNote(game)
      await wrongNoteByUi(game.pages[1])
      await expectPlayerOut(game.pages[1])
      await game.pages[1].getByRole('button', { name: /back to waiting room/i }).click()
      await expect(game.pages[1]).toHaveURL(new RegExp(`/room/${game.roomCode}$`, 'i'))
      await expectNoGameOver(game.hostPage)

      await wrongNoteBySocket(game, 2)
      await expectPlayerOut(game.pages[2])
      await expectNoGameOver(game.hostPage)

      await wrongNoteBySocket(game, 3)
      await expectGameOver(game.hostPage)
      await expect(game.hostPage.getByText(/points/i).first()).toBeVisible()
    } finally {
      await closeGame(game)
    }
  })

  test('keeps a six-player game alive through cascading eliminations until the final wrong note', async ({ browser }) => {
    const game = await createStartedGame(browser, 6)

    try {
      await hostAddsOpeningNote(game)

      for (let playerIndex = 1; playerIndex <= 4; playerIndex += 1) {
        await wrongNoteBySocket(game, playerIndex)
        await expectPlayerOut(game.pages[playerIndex])
        await expectNoGameOver(game.hostPage)
      }

      await wrongNoteBySocket(game, 5)
      await expectGameOver(game.hostPage)
      await expect(game.hostPage.getByText(/points/i).first()).toBeVisible()
    } finally {
      await closeGame(game)
    }
  })
})
