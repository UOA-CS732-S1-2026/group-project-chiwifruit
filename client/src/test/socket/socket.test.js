import { beforeEach, describe, expect, it, vi } from 'vitest'

const socketMock = {
  connected: false,
  auth: {},
  connect: vi.fn(() => {
    socketMock.connected = true
  }),
  emit: vi.fn(),
}

const ioMock = vi.fn(() => socketMock)
const getStoredAuthTokenMock = vi.fn()

vi.mock('socket.io-client', () => ({
  io: ioMock,
}))

vi.mock('../../api/axios', () => ({
  getStoredAuthToken: getStoredAuthTokenMock,
}))

async function loadSocketModule() {
  vi.resetModules()
  return import('../../socket/socket')
}

function resetSocketMock() {
  socketMock.connected = false
  socketMock.auth = {}
  socketMock.connect.mockClear()
  socketMock.emit.mockClear()
  ioMock.mockClear()
  getStoredAuthTokenMock.mockReset()
}

// Unit scope: verify client-side socket wrapper contracts without opening a real Socket.IO connection.
describe('socket helper wrappers', () => {
  beforeEach(() => {
    resetSocketMock()
    window.history.pushState({}, '', '/')
  })

  it('should build the socket with websocket transport and the stored auth token', async () => {
    getStoredAuthTokenMock.mockReturnValue('initial-token')
    const { getSocket } = await loadSocketModule()

    const socket = getSocket()

    expect(socket).toBe(socketMock)
    expect(ioMock).toHaveBeenCalledWith('http://localhost:3000', {
      autoConnect: true,
      transports: ['websocket'],
      auth: {
        token: 'initial-token',
      },
    })
  })

  it('should refresh socket auth and connect when reconnecting a disconnected socket', async () => {
    getStoredAuthTokenMock
      .mockReturnValueOnce('initial-token')
      .mockReturnValueOnce('fresh-token')
    const { getSocket, reconnectSocket } = await loadSocketModule()

    getSocket()
    const socket = reconnectSocket()

    expect(socket).toBe(socketMock)
    expect(socketMock.auth).toEqual({ token: 'fresh-token' })
    expect(socketMock.connect).toHaveBeenCalledTimes(1)
  })

  it('should join a socket room through the shared JOIN_ROOM event', async () => {
    getStoredAuthTokenMock.mockReturnValue('token')
    const { joinSocketRoom } = await loadSocketModule()

    joinSocketRoom('ABC123')

    expect(socketMock.emit).toHaveBeenCalledWith('join_room', { roomCode: 'ABC123' })
  })

  it('should leave a socket room through the game-forfeit LEAVE_ROOM event', async () => {
    const { leaveSocketRoom } = await loadSocketModule()

    leaveSocketRoom('ABC123')

    expect(socketMock.emit).toHaveBeenCalledWith('leave_room', { roomCode: 'ABC123' })
  })

  it('should block game start from a stale /game route and return an ack error', async () => {
    window.history.pushState({}, '', '/game/ABC123')
    const ack = vi.fn()
    const { emitGameStart } = await loadSocketModule()

    emitGameStart('ABC123', ack)

    expect(ack).toHaveBeenCalledWith({ ok: false, error: 'Game start must be triggered from the room.' })
    expect(socketMock.emit).not.toHaveBeenCalled()
  })

  it('should emit game start from a non-game route', async () => {
    window.history.pushState({}, '', '/room/ABC123')
    const ack = vi.fn()
    const { emitGameStart } = await loadSocketModule()

    emitGameStart('ABC123', ack)

    expect(socketMock.emit).toHaveBeenCalledWith('game_start', { roomCode: 'ABC123' }, ack)
  })

  it('should emit game lifecycle helper events with room code payloads', async () => {
    const {
      emitGameRequestState,
      emitGameFamiliarTiming,
      emitGameFamiliarAudioReady,
      emitGameFamiliarAutoplayStarted,
      emitGameFamiliarAutoplayFinished,
      emitGameFamiliarReady,
      emitGameFamiliarPadPress,
      emitGamePadPress,
    } = await loadSocketModule()
    const ack = vi.fn()

    emitGameRequestState('ABC123', ack)
    emitGameFamiliarTiming('ABC123', 1200, ack)
    emitGameFamiliarAudioReady('ABC123', ack)
    emitGameFamiliarAutoplayStarted('ABC123', ack)
    emitGameFamiliarAutoplayFinished('ABC123', ack)
    emitGameFamiliarReady('ABC123', ack)
    emitGameFamiliarPadPress('ABC123', 2)
    emitGamePadPress('ABC123', 3)

    expect(socketMock.emit).toHaveBeenNthCalledWith(1, 'game_request_state', { roomCode: 'ABC123' }, ack)
    expect(socketMock.emit).toHaveBeenNthCalledWith(2, 'game_familiar_timing', { roomCode: 'ABC123', familiarAutoDurationMs: 1200 }, ack)
    expect(socketMock.emit).toHaveBeenNthCalledWith(3, 'game_familiar_audio_ready', { roomCode: 'ABC123' }, ack)
    expect(socketMock.emit).toHaveBeenNthCalledWith(4, 'game_familiar_autoplay_started', { roomCode: 'ABC123' }, ack)
    expect(socketMock.emit).toHaveBeenNthCalledWith(5, 'game_familiar_autoplay_finished', { roomCode: 'ABC123' }, ack)
    expect(socketMock.emit).toHaveBeenNthCalledWith(6, 'game_familiar_ready', { roomCode: 'ABC123' }, ack)
    expect(socketMock.emit).toHaveBeenNthCalledWith(7, 'game_familiar_pad_press', { roomCode: 'ABC123', padIndex: 2 })
    expect(socketMock.emit).toHaveBeenNthCalledWith(8, 'game_pad_press', { roomCode: 'ABC123', padIndex: 3 })
  })

  it('should no-op socket emit helpers when room code is empty', async () => {
    const { joinSocketRoom, leaveSocketRoom, emitGamePadPress } = await loadSocketModule()

    joinSocketRoom('')
    leaveSocketRoom(null)
    emitGamePadPress(undefined, 1)

    expect(ioMock).not.toHaveBeenCalled()
    expect(socketMock.emit).not.toHaveBeenCalled()
  })
})
