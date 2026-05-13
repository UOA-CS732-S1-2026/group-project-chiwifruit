const request = require('supertest')

const {
  connectIntegrationDatabase,
  clearIntegrationDatabase,
  disconnectIntegrationDatabase,
} = require('../../helpers/database')
const { createAuthHeader, guestIdentity } = require('../../helpers/auth')
const {
  emitWithAck,
  once,
  waitForEvent,
  waitUntil,
  startSocketIntegrationServer,
} = require('../../helpers/socketServer')

const app = require('../../../src/app')
const Room = require('../../../src/models/Room')

jest.setTimeout(30_000)

async function createRoom(identity) {
  const response = await request(app)
    .post('/api/rooms')
    .set('Authorization', createAuthHeader(identity))
    .send({})
    .expect(201)

  return response.body.roomCode
}

async function joinRoom(roomCode, identity) {
  await request(app)
    .post('/api/rooms')
    .set('Authorization', createAuthHeader(identity))
    .send({ joinRoomCode: roomCode })
    .expect(200)
}

async function readyParticipant(roomCode, identity) {
  await request(app)
    .patch(`/api/rooms/${roomCode}/ready`)
    .set('Authorization', createAuthHeader(identity))
    .send({ isReady: true })
    .expect(200)
}

function socketPlayers(seed) {
  return {
    host: guestIdentity(`guest-host-${seed}`, `Socket Host ${seed}`),
    guest: guestIdentity(`guest-player-${seed}`, `Socket Player ${seed}`),
  }
}

// Integration scope: verify real Socket.IO transport, JWT auth, Mongo-backed room state, and gameService together.
describe('Socket integration', () => {
  let server
  const sockets = []

  beforeAll(async () => {
    await connectIntegrationDatabase()
    server = await startSocketIntegrationServer()
  })

  beforeEach(async () => {
    await clearIntegrationDatabase()
  })

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect())
  })

  afterAll(async () => {
    if (server) await server.close()
    await disconnectIntegrationDatabase()
  })

  async function connect(identity) {
    const socket = await server.connectClient(identity)
    sockets.push(socket)
    return socket
  }

  async function createReadySocketRoom(seed) {
    const { host, guest } = socketPlayers(seed)
    const roomCode = await createRoom(host)
    await joinRoom(roomCode, guest)
    await readyParticipant(roomCode, guest)

    const hostSocket = await connect(host)
    const guestSocket = await connect(guest)
    hostSocket.emit('join_room', { roomCode })
    guestSocket.emit('join_room', { roomCode })

    return { host, guest, roomCode, hostSocket, guestSocket }
  }

  async function startPlayingSocketGame(seed) {
    const context = await createReadySocketRoom(seed)
    const { host, guest, roomCode, hostSocket, guestSocket } = context

    const startAck = await emitWithAck(hostSocket, 'game_start', { roomCode })
    expect(startAck).toMatchObject({ ok: true })
    await emitWithAck(hostSocket, 'game_familiar_ready', { roomCode })
    const guestReadyAck = await emitWithAck(guestSocket, 'game_familiar_ready', { roomCode })
    expect(guestReadyAck.game).toMatchObject({ status: 'playing', currentTurnUserId: host.sub })
    expect(guestReadyAck.game.participantsOrder).toEqual([host.sub, guest.sub])

    return context
  }

  it('should reject socket connections without a valid token', async () => {
    const { io: createClient } = require('socket.io-client')
    const badSocket = createClient(`http://127.0.0.1:${server.port}`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: 'invalid-token' },
    })

    await expect(new Promise((resolve, reject) => {
      badSocket.once('connect', () => resolve('connected'))
      badSocket.once('connect_error', (error) => reject(error))
    })).rejects.toThrow('Invalid or expired token')

    badSocket.disconnect()
  })

  it('should start a game from a real room and broadcast familiarizing state to joined clients', async () => {
    const { guest, roomCode, hostSocket, guestSocket } = await createReadySocketRoom('start')

    const hostState = once(hostSocket, 'game_state')
    const guestState = once(guestSocket, 'game_state')
    const ack = await emitWithAck(hostSocket, 'game_start', { roomCode })

    expect(ack).toMatchObject({ ok: true })
    expect(ack.game).toMatchObject({ roomCode, status: 'familiarizing' })
    await expect(hostState).resolves.toMatchObject({ roomCode, status: 'familiarizing' })
    await expect(guestState).resolves.toMatchObject({ roomCode, status: 'familiarizing' })

    const room = await Room.findOne({ roomCode }).lean()
    expect(room.participants.every((participant) => participant.correctCount === 0)).toBe(true)
    expect(room.participants.find((participant) => participant.guestId === guest.sub).isReady).toBe(false)
  })

  it('should move from familiarizing to playing when all players are ready', async () => {
    const { host, guest, roomCode, hostSocket, guestSocket } = await createReadySocketRoom('ready')

    const startAck = await emitWithAck(hostSocket, 'game_start', { roomCode })
    expect(startAck).toMatchObject({ ok: true })

    await emitWithAck(hostSocket, 'game_familiar_ready', { roomCode })
    const playingState = waitForEvent(
      guestSocket,
      'game_state',
      (state) => state.status === 'playing' && state.currentTurnUserId === host.sub,
    )
    const readyAck = await emitWithAck(guestSocket, 'game_familiar_ready', { roomCode })

    expect(readyAck).toMatchObject({ ok: true })
    expect(readyAck.game).toMatchObject({ roomCode, status: 'playing', currentTurnUserId: host.sub })
    expect(readyAck.game.participantsOrder).toEqual([host.sub, guest.sub])
    await expect(playingState).resolves.toMatchObject({ roomCode, status: 'playing', currentTurnUserId: host.sub })
  })

  it('should broadcast pad sounds and game state when the current player presses a pad', async () => {
    const { host, guest, roomCode, hostSocket, guestSocket } = await startPlayingSocketGame('pad')

    const padSound = once(guestSocket, 'game_pad_sound')
    const gameState = waitForEvent(
      guestSocket,
      'game_state',
      (state) => Array.isArray(state.sequence) && state.sequence[0] === 2,
    )

    hostSocket.emit('game_pad_press', { roomCode, padIndex: 2 })

    await expect(padSound).resolves.toMatchObject({ roomCode, padIndex: 2, userId: host.sub })
    await expect(gameState).resolves.toMatchObject({
      roomCode,
      status: 'playing',
      sequence: [2],
      currentTurnUserId: guest.sub,
    })
  })

  it('should finish the game, broadcast elimination, and persist final scores after a wrong note', async () => {
    const { host, guest, roomCode, hostSocket, guestSocket } = await startPlayingSocketGame('wrong-note')

    hostSocket.emit('game_pad_press', { roomCode, padIndex: 2 })
    await waitForEvent(
      guestSocket,
      'game_state',
      (state) => Array.isArray(state.sequence) && state.sequence[0] === 2,
    )

    const finishedState = waitForEvent(
      hostSocket,
      'game_state',
      (state) => state.status === 'finished' && state.lastEvent?.winnerUserId === host.sub,
    )

    guestSocket.emit('game_pad_press', { roomCode, padIndex: 3 })

    const finalGame = await finishedState
    expect(finalGame).toMatchObject({
      roomCode,
      status: 'finished',
      lastEvent: { type: 'game_finished', winnerUserId: host.sub },
    })
    expect(finalGame.players.find((player) => player.userId === guest.sub)).toMatchObject({
      isEliminated: true,
      eliminationReason: 'wrong_note',
      leftDuringGame: false,
    })

    await waitUntil(async () => {
      const room = await Room.findOne({ roomCode }).lean()
      const hostParticipant = room.participants.find((participant) => participant.guestId === host.sub)
      const guestParticipant = room.participants.find((participant) => participant.guestId === guest.sub)

      expect(hostParticipant.correctCount).toBe(finalGame.scores[host.sub])
      expect(guestParticipant.correctCount).toBe(finalGame.scores[guest.sub])
    })
  })

  it('should forfeit an active game through leave_room and clean the waiting-room roster', async () => {
    const { host, guest, roomCode, hostSocket, guestSocket } = await startPlayingSocketGame('leave-room')

    const finishedState = waitForEvent(
      hostSocket,
      'game_state',
      (state) => state.status === 'finished' && state.lastEvent?.winnerUserId === host.sub,
    )
    const roomUpdate = waitForEvent(
      hostSocket,
      'room_update',
      (state) => state === null || state.participants?.every((participant) => participant.userId !== guest.sub),
    )

    guestSocket.emit('leave_room', { roomCode })

    const finalGame = await finishedState
    expect(finalGame).toMatchObject({
      roomCode,
      status: 'finished',
      lastEvent: { type: 'game_finished', winnerUserId: host.sub },
    })
    expect(finalGame.players.find((player) => player.userId === guest.sub)).toMatchObject({
      isEliminated: true,
      leftDuringGame: true,
    })

    await expect(roomUpdate).resolves.toEqual(expect.anything())
    await waitUntil(async () => {
      const room = await Room.findOne({ roomCode }).lean()
      expect(room).not.toBeNull()
      expect(room.participants).toHaveLength(1)
      expect(room.participants[0].guestId).toBe(host.sub)
      expect(room.host).toBe(host.sub)
    })
  })
})
