const { expect } = require('@playwright/test')

async function createGuestSession(page, username) {
  const response = await page.request.post('/api/auth/guest', {
    data: { username },
  })
  expect(response.ok()).toBeTruthy()

  const session = await response.json()
  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('authToken', token)
    window.localStorage.setItem('authUser', JSON.stringify(user))
  }, session)

  return session
}

async function createRoomByApi(page, username = 'Host') {
  await createGuestSession(page, username)
  const token = await page.evaluate(() => window.localStorage.getItem('authToken'))

  const response = await page.request.post('/api/rooms', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  expect(response.ok()).toBeTruthy()

  return response.json()
}

async function createRoomThroughUi(page) {
  await page.goto('/')
  await page.getByRole('button', { name: /create a room/i }).click()
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]+$/)
  await expect(page.getByRole('heading', { name: /waiting room/i })).toBeVisible()

  const url = page.url()
  return url.slice(url.lastIndexOf('/') + 1).toUpperCase()
}

async function joinRoomThroughUi(page, roomCode) {
  await page.goto('/')
  await page.getByRole('button', { name: /join with code/i }).click()
  await page.getByLabel(/room code/i).fill(roomCode)
  await page.getByRole('button', { name: /join game/i }).click()
  await expect(page).toHaveURL(new RegExp(`/room/${roomCode}$`, 'i'))
  await expect(page.getByRole('heading', { name: /waiting room/i })).toBeVisible()
}

module.exports = {
  createGuestSession,
  createRoomByApi,
  createRoomThroughUi,
  joinRoomThroughUi,
}
