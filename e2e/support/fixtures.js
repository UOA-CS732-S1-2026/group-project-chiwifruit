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

function getTokenExpiryMs(token) {
  const [, payload] = String(token || '').split('.')
  if (!payload) return Date.now() + 60 * 60 * 1000

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
    const expSeconds = Number(parsed?.exp)
    return Number.isFinite(expSeconds) && expSeconds > 0 ? expSeconds * 1000 : Date.now() + 60 * 60 * 1000
  } catch {
    return Date.now() + 60 * 60 * 1000
  }
}

function authHeader(session) {
  return { Authorization: `Bearer ${session.token}` }
}

async function createGuestSession(page, username) {
  const response = await page.request.post(`${API_ORIGIN}/auth/guest`, {
    data: { username },
  })
  await expectOk(response, 'Create guest session')

  const session = await response.json()
  const expiresAt = getTokenExpiryMs(session.token)

  await page.addInitScript(({ token, user, expiresAtMs }) => {
    window.sessionStorage.setItem('kichain:authToken', token)
    window.sessionStorage.setItem('kichain:authUser', JSON.stringify(user))
    window.sessionStorage.setItem('kichain:authExpiresAt', String(expiresAtMs))
    window.localStorage.removeItem('kichain:authToken')
    window.localStorage.removeItem('kichain:authUser')
    window.localStorage.removeItem('kichain:authExpiresAt')
  }, { token: session.token, user: session.user, expiresAtMs: expiresAt })

  return session
}

async function createRoomByApi(page, username = 'Host') {
  const session = await createGuestSession(page, username)

  const response = await page.request.post(`${API_ORIGIN}/rooms`, {
    headers: authHeader(session),
  })
  await expectOk(response, 'Create room')

  return response.json()
}

async function createRoomThroughUi(page, username = 'Host UI') {
  await createGuestSession(page, username)
  await page.goto('/')
  await page.getByRole('button', { name: /create a room/i }).click()
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]+$/)
  await expect(page.getByRole('heading', { name: /waiting room/i })).toBeVisible()

  const url = page.url()
  return url.slice(url.lastIndexOf('/') + 1).toUpperCase()
}

async function joinRoomThroughUi(page, roomCode, username = 'Guest UI') {
  await createGuestSession(page, username)
  await page.goto('/')
  await page.getByRole('button', { name: /join with code/i }).click()
  await page.getByLabel(/room code/i).fill(roomCode)
  await page.getByRole('button', { name: /join game/i }).click()
  await expect(page).toHaveURL(new RegExp(`/room/${roomCode}$`, 'i'))
  await expect(page.getByRole('heading', { name: /waiting room/i })).toBeVisible()
}

module.exports = {
  API_ORIGIN,
  authHeader,
  expectOk,
  createGuestSession,
  createRoomByApi,
  createRoomThroughUi,
  joinRoomThroughUi,
}
