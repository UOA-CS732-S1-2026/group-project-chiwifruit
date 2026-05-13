const { test, expect } = require('@playwright/test')
const { createRoomByApi } = require('./support/fixtures')

test.describe('Landing page E2E', () => {
  test('shows the main entry points and game guidance', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText(/the ultimate musical memory game/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /build the sequence/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /create a room/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /join with code/i })).toBeVisible()
    await expect(page.getByText(/1\. listen closely/i)).toBeVisible()
    await expect(page.getByText(/2\. add your sound/i)).toBeVisible()
    await expect(page.getByText(/3\. last one standing/i)).toBeVisible()
  })

  test('keeps the join action disabled until a room code is entered', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /join with code/i }).click()

    await expect(page.getByRole('heading', { name: /join a room/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /join game/i })).toBeDisabled()

    await page.getByLabel(/room code/i).fill('abc123')
    await expect(page.getByRole('button', { name: /join game/i })).toBeEnabled()
  })

  test('normalizes pasted room codes before joining', async ({ page }) => {
    const room = await createRoomByApi(page, 'Existing Host')

    await page.goto('/')
    await page.getByRole('button', { name: /join with code/i }).click()
    await page.getByLabel(/room code/i).fill(` ${room.roomCode.toLowerCase()} `)
    await page.getByRole('button', { name: /join game/i }).click()

    await expect(page).toHaveURL(new RegExp(`/room/${room.roomCode}$`, 'i'))
    await expect(page.getByRole('heading', { name: /waiting room/i })).toBeVisible()
  })
})
