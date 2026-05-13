const { test, expect } = require('@playwright/test')
const {
  createGuestSession,
  createRoomThroughUi,
  joinRoomThroughUi,
} = require('./support/fixtures')

test.describe('Room and game flow E2E', () => {
  test('creates a room from the landing page and shows host controls', async ({ page }) => {
    const roomCode = await createRoomThroughUi(page)

    await expect(page.getByText(roomCode)).toBeVisible()
    await expect(page.getByText(/1 \/ 6 players/i)).toBeVisible()
    await expect(page.getByText(/sound mode/i)).toBeVisible()
    await expect(page.getByText(/difficulty/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /start game/i })).toBeDisabled()
  })

  test('copies the room code from the waiting room', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const roomCode = await createRoomThroughUi(page)

    await page.getByRole('button', { name: /copy room code/i }).click()

    await expect(page.getByText(/^Copied$/i)).toBeVisible()
    await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(roomCode)
  })

  test('allows the host to change sound mode and difficulty before starting', async ({ page }) => {
    await createRoomThroughUi(page)

    await page.getByRole('button', { name: /^Piano$/i }).click()
    await page.getByRole('button', { name: /^Hard$/i }).click()

    await expect(page.getByRole('button', { name: /^Piano$/i })).toHaveClass(/text-primary-foreground/)
    await expect(page.getByRole('button', { name: /^Hard$/i })).toHaveClass(/text-primary-foreground/)
  })

  test('keeps room setting controls disabled for non-host players', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestPage = await guestContext.newPage()

    try {
      const roomCode = await createRoomThroughUi(hostPage)
      await joinRoomThroughUi(guestPage, roomCode)

      await expect(guestPage.getByRole('button', { name: /^Piano$/i })).toBeDisabled()
      await expect(guestPage.getByRole('button', { name: /^Hard$/i })).toBeDisabled()
      await expect(guestPage.getByRole('button', { name: /start game/i })).toHaveCount(0)
      await expect(guestPage.getByRole('button', { name: /click to ready/i })).toBeVisible()
    } finally {
      await hostContext.close()
      await guestContext.close()
    }
  })

  test('redirects an invalid room code back to the landing page', async ({ page }) => {
    await createGuestSession(page, 'Invalid Room Guest')

    await page.goto('/room/NOPE99')

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: /build the sequence/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /create a room/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /join with code/i })).toBeVisible()
  })

  test('shows a visible error and stays on landing when joining a missing room from the modal', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /join with code/i }).click()
    await page.getByLabel(/room code/i).fill('NOPE99')
    await page.getByRole('button', { name: /join game/i }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText(/room not found/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /join a room/i })).toBeVisible()
  })

  test('shows realtime roster updates across three browser sessions', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const guestOneContext = await browser.newContext()
    const guestTwoContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestOnePage = await guestOneContext.newPage()
    const guestTwoPage = await guestTwoContext.newPage()

    try {
      const roomCode = await createRoomThroughUi(hostPage)
      await joinRoomThroughUi(guestOnePage, roomCode)
      await joinRoomThroughUi(guestTwoPage, roomCode)

      await expect(hostPage.getByText(/3 \/ 6 players/i)).toBeVisible()
      await expect(guestOnePage.getByText(/3 \/ 6 players/i)).toBeVisible()
      await expect(guestTwoPage.getByText(/3 \/ 6 players/i)).toBeVisible()
      await expect(hostPage.getByRole('button', { name: /start game/i })).toBeDisabled()
    } finally {
      await hostContext.close()
      await guestOneContext.close()
      await guestTwoContext.close()
    }
  })

  test('updates the roster when a guest leaves the waiting room', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestPage = await guestContext.newPage()

    try {
      const roomCode = await createRoomThroughUi(hostPage)
      await joinRoomThroughUi(guestPage, roomCode)
      await expect(hostPage.getByText(/2 \/ 6 players/i)).toBeVisible()

      await guestPage.getByRole('button', { name: /leave room/i }).click()

      await expect(guestPage).toHaveURL(/\/$/)
      await expect(hostPage.getByText(/1 \/ 6 players/i)).toBeVisible()
      await expect(hostPage.getByRole('button', { name: /start game/i })).toBeDisabled()
    } finally {
      await hostContext.close()
      await guestContext.close()
    }
  })

  test('transfers host controls in the UI when the original host leaves', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestPage = await guestContext.newPage()

    try {
      const roomCode = await createRoomThroughUi(hostPage)
      await joinRoomThroughUi(guestPage, roomCode)

      await hostPage.getByRole('button', { name: /leave room/i }).click()

      await expect(hostPage).toHaveURL(/\/$/)
      await expect(guestPage.getByRole('button', { name: /start game/i })).toBeVisible()
      await expect(guestPage.getByRole('button', { name: /start game/i })).toBeDisabled()
      await expect(guestPage.getByRole('button', { name: /^Piano$/i })).toBeEnabled()
      await expect(guestPage.getByText(roomCode)).toBeVisible()
    } finally {
      await hostContext.close()
      await guestContext.close()
    }
  })

  test('requires all non-host players to be ready in a three-player room before starting', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const guestOneContext = await browser.newContext()
    const guestTwoContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestOnePage = await guestOneContext.newPage()
    const guestTwoPage = await guestTwoContext.newPage()

    try {
      const roomCode = await createRoomThroughUi(hostPage)
      await joinRoomThroughUi(guestOnePage, roomCode)
      await joinRoomThroughUi(guestTwoPage, roomCode)

      await guestOnePage.getByRole('button', { name: /click to ready/i }).click()
      await expect(guestOnePage.getByRole('button', { name: /ready!/i })).toBeVisible()
      await expect(hostPage.getByRole('button', { name: /start game/i })).toBeDisabled()

      await guestTwoPage.getByRole('button', { name: /click to ready/i }).click()
      await expect(guestTwoPage.getByRole('button', { name: /ready!/i })).toBeVisible()
      await expect(hostPage.getByRole('button', { name: /start game/i })).toBeEnabled()
    } finally {
      await hostContext.close()
      await guestOneContext.close()
      await guestTwoContext.close()
    }
  })

  test('starts the game for all players in a three-player room', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const guestOneContext = await browser.newContext()
    const guestTwoContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestOnePage = await guestOneContext.newPage()
    const guestTwoPage = await guestTwoContext.newPage()

    try {
      const roomCode = await createRoomThroughUi(hostPage)
      await joinRoomThroughUi(guestOnePage, roomCode)
      await joinRoomThroughUi(guestTwoPage, roomCode)

      await guestOnePage.getByRole('button', { name: /click to ready/i }).click()
      await guestTwoPage.getByRole('button', { name: /click to ready/i }).click()
      await expect(hostPage.getByRole('button', { name: /start game/i })).toBeEnabled()

      await hostPage.getByRole('button', { name: /start game/i }).click()

      await expect(hostPage).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'))
      await expect(guestOnePage).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'))
      await expect(guestTwoPage).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'))
    } finally {
      await hostContext.close()
      await guestOneContext.close()
      await guestTwoContext.close()
    }
  })

  test('allows a guest to toggle ready state before the host starts', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestPage = await guestContext.newPage()

    try {
      const roomCode = await createRoomThroughUi(hostPage)
      await joinRoomThroughUi(guestPage, roomCode)

      await guestPage.getByRole('button', { name: /click to ready/i }).click()
      await expect(guestPage.getByRole('button', { name: /ready!/i })).toBeVisible()
      await expect(hostPage.getByRole('button', { name: /start game/i })).toBeEnabled()

      await guestPage.getByRole('button', { name: /ready!/i }).click()
      await expect(guestPage.getByRole('button', { name: /click to ready/i })).toBeVisible()
      await expect(hostPage.getByRole('button', { name: /start game/i })).toBeDisabled()
    } finally {
      await hostContext.close()
      await guestContext.close()
    }
  })

  test('supports two browser sessions joining, readying up, and starting the game', async ({ browser }) => {
    const hostContext = await browser.newContext()
    const guestContext = await browser.newContext()
    const hostPage = await hostContext.newPage()
    const guestPage = await guestContext.newPage()

    try {
      const roomCode = await createRoomThroughUi(hostPage)
      await joinRoomThroughUi(guestPage, roomCode)

      await expect(hostPage.getByText(/2 \/ 6 players/i)).toBeVisible()
      await expect(guestPage.getByText(/2 \/ 6 players/i)).toBeVisible()

      await guestPage.getByRole('button', { name: /click to ready/i }).click()
      await expect(guestPage.getByRole('button', { name: /ready!/i })).toBeVisible()
      await expect(hostPage.getByRole('button', { name: /start game/i })).toBeEnabled()

      await hostPage.getByRole('button', { name: /start game/i }).click()

      await expect(hostPage).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'))
      await expect(guestPage).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'))
      await expect(hostPage.getByText(/waiting room/i)).not.toBeVisible()
      await expect(guestPage.getByText(/waiting room/i)).not.toBeVisible()
    } finally {
      await hostContext.close()
      await guestContext.close()
    }
  })
})
