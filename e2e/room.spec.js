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

  test('redirects an invalid room code back to the landing page', async ({ page }) => {
    await createGuestSession(page, 'Invalid Room Guest')

    await page.goto('/room/NOPE99')

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: /build the sequence/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /create a room/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /join with code/i })).toBeVisible()
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
