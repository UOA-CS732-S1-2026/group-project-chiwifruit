const { expect } = require('@playwright/test')

const BACKEND_ORIGIN = 'http://127.0.0.1:3000'
const API_ORIGIN = `${BACKEND_ORIGIN}/api`

async function expectOk(response, label) {
  if (response.ok()) return

  let body = ''
  try {
    body = await response.text()
  } catch {
    body = '<unable to read response body>'
  }

  throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${body}`)
}

async function createGuestSession(page, username) {
  const response = await page.request.post(`${API_ORIGIN}/auth/guest`, {
    data: { username },
  })
  await expectOk(response, 'Create guest session')

  const session = await response.json()
  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('authToken', token)
    window.localStorage.setItem('authUser', JSON.stringify(user))
  }, session)

  return session
}

async function getStoredToken(page) {
  return page.evaluate(() => window.localStorage.getItem('authToken'))
}

async function createRoomByApi(page, username = 'Host') {
  await createGuestSession(page, username)
  const token = await getStoredToken(page)

  const response = await page.request.post(`${API_ORIGIN}/rooms`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  await expectOk(response, 'Create room')

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
  API_ORIGIN,
  expectOk,
  createGuestSession,
  createRoomByApi,
  createRoomThroughUi,
  joinRoomThroughUi,
}
