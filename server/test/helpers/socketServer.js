jest.unmock('socket.io')
jest.unmock('jsonwebtoken')

const http = require('http')
const { io: createClient } = require('socket.io-client')

const app = require('../../src/app')
const { initSocket } = require('../../src/socket')
const { createAuthHeader } = require('./auth')

function extractToken(authHeader) {
  return String(authHeader).replace(/^Bearer\s+/i, '')
}

function once(socket, eventName, timeoutMs = 3000) {
  return waitForEvent(socket, eventName, () => true, timeoutMs)
}

function waitForEvent(socket, eventName, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent)
      reject(new Error(`Timed out waiting for socket event: ${eventName}`))
    }, timeoutMs)

    function onEvent(payload) {
      if (!predicate(payload)) return

      clearTimeout(timer)
      socket.off(eventName, onEvent)
      resolve(payload)
    }

    socket.on(eventName, onEvent)
  })
}

async function waitUntil(assertion, timeoutMs = 3000, intervalMs = 25) {
  const startedAt = Date.now()
  let lastError

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await assertion()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  throw lastError
}

function emitWithAck(socket, eventName, payload = {}, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ack: ${eventName}`))
    }, timeoutMs)

    socket.emit(eventName, payload, (ack) => {
      clearTimeout(timer)
      resolve(ack)
    })
  })
}

async function startSocketIntegrationServer() {
  const httpServer = http.createServer(app)
  const io = initSocket(httpServer, 'http://localhost:5173')

  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  const { port } = httpServer.address()

  async function connectClient(identity) {
    const socket = createClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      auth: {
        token: extractToken(createAuthHeader(identity)),
      },
    })

    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('connect_error', reject)
    })

    return socket
  }

  async function close() {
    await new Promise((resolve) => io.close(resolve))
    await new Promise((resolve) => httpServer.close(resolve))
  }

  return {
    io,
    httpServer,
    port,
    connectClient,
    close,
  }
}

module.exports = {
  once,
  waitForEvent,
  waitUntil,
  emitWithAck,
  startSocketIntegrationServer,
}
