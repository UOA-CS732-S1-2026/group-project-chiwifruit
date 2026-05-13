const http = require('http')
const { spawn } = require('child_process')
const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')

const FRONTEND_PORT = 5173
const BACKEND_PORT = 3000
const FRONTEND_ORIGIN = `http://127.0.0.1:${FRONTEND_PORT}`
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`

let mongoServer
let httpServer
let socketServer
let viteProcess
let isShuttingDown = false

function applyE2eEnvironment(mongodbUri) {
  process.env.NODE_ENV = 'test'
  process.env.PORT = String(BACKEND_PORT)
  process.env.FRONTEND_ORIGIN = FRONTEND_ORIGIN
  process.env.MONGODB_URI = mongodbUri
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret'
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'
}

function waitForServer(url, timeoutMs = 60_000) {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const tryRequest = () => {
      http
        .get(url, (response) => {
          response.resume()
          resolve()
        })
        .on('error', (error) => {
          if (Date.now() - startedAt > timeoutMs) {
            reject(error)
            return
          }
          setTimeout(tryRequest, 250)
        })
    }

    tryRequest()
  })
}

async function startBackend() {
  mongoServer = await MongoMemoryServer.create()
  applyE2eEnvironment(mongoServer.getUri('kichain-e2e'))

  const app = require('../../server/src/app')
  const { initSocket } = require('../../server/src/socket')

  await mongoose.connect(process.env.MONGODB_URI)

  httpServer = http.createServer(app)
  socketServer = initSocket(httpServer, FRONTEND_ORIGIN)
  app.set('io', socketServer)

  // Bind to the default host instead of only 127.0.0.1 so browser requests to
  // both localhost and 127.0.0.1 can reach the managed backend.
  await new Promise((resolve) => httpServer.listen(BACKEND_PORT, resolve))
  await waitForServer(`${BACKEND_ORIGIN}/health`)
}

async function startFrontend() {
  viteProcess = spawn('npm', ['run', 'dev', '--workspace=client', '--', '--host', '127.0.0.1'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FRONTEND_PORT: String(FRONTEND_PORT),
      VITE_API_URL: `${BACKEND_ORIGIN}/api`,
      VITE_SOCKET_URL: BACKEND_ORIGIN,
      VITE_BUILD_VERSION: 'e2e',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  viteProcess.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`))
  viteProcess.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`))

  viteProcess.on('exit', (code) => {
    if (!isShuttingDown && code !== 0) {
      process.stderr.write(`[e2e] Vite exited unexpectedly with code ${code}\n`)
      process.exit(code || 1)
    }
  })

  await waitForServer(FRONTEND_ORIGIN)
}

async function shutdown() {
  if (isShuttingDown) return
  isShuttingDown = true

  if (viteProcess) {
    viteProcess.kill('SIGTERM')
  }

  if (socketServer) {
    await new Promise((resolve) => socketServer.close(resolve))
  }

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve))
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }

  if (mongoServer) {
    await mongoServer.stop()
  }
}

async function main() {
  await startBackend()
  await startFrontend()

  process.stdout.write(`[e2e] Frontend ready at ${FRONTEND_ORIGIN}\n`)
  process.stdout.write(`[e2e] Backend ready at ${BACKEND_ORIGIN}\n`)

  process.on('SIGTERM', async () => {
    await shutdown()
    process.exit(0)
  })
  process.on('SIGINT', async () => {
    await shutdown()
    process.exit(0)
  })
}

main().catch(async (error) => {
  console.error('[e2e] Failed to start E2E server', error)
  await shutdown()
  process.exit(1)
})
