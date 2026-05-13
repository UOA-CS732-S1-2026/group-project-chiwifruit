import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = {
  post: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
}

const getStoredAuthTokenMock = vi.fn()

vi.mock('../../api/axios', () => ({
  default: apiMock,
  getStoredAuthToken: getStoredAuthTokenMock,
}))

async function loadRoomsModule() {
  vi.resetModules()
  return import('../../api/rooms')
}

// Unit scope: verify endpoint contracts and browser keepalive behaviour at the API wrapper boundary.
describe('room API wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn()
  })

  it('should create a room through POST /rooms', async () => {
    apiMock.post.mockResolvedValue({ data: { roomCode: 'ABC123' } })
    const { createRoom } = await loadRoomsModule()

    await expect(createRoom()).resolves.toEqual({ roomCode: 'ABC123' })

    expect(apiMock.post).toHaveBeenCalledWith('/rooms')
  })

  it('should join a room through POST /rooms with the provided room code', async () => {
    apiMock.post.mockResolvedValue({ data: { roomCode: 'ABC123' } })
    const { joinRoom } = await loadRoomsModule()

    await expect(joinRoom('abc123')).resolves.toEqual({ roomCode: 'ABC123' })

    expect(apiMock.post).toHaveBeenCalledWith('/rooms', { joinRoomCode: 'abc123' })
  })

  it('should normalize room code before leaving a room', async () => {
    apiMock.delete.mockResolvedValue({ data: { deleted: true } })
    const { leaveRoom } = await loadRoomsModule()

    await expect(leaveRoom(' abc123 ')).resolves.toEqual({ deleted: true })

    expect(apiMock.delete).toHaveBeenCalledWith('/rooms/ABC123')
  })

  it('should fetch room state from the readiness endpoint', async () => {
    apiMock.get.mockResolvedValue({ data: { roomCode: 'ABC123', participantCount: 2 } })
    const { getRoomState } = await loadRoomsModule()

    await expect(getRoomState('ABC123')).resolves.toEqual({ roomCode: 'ABC123', participantCount: 2 })

    expect(apiMock.get).toHaveBeenCalledWith('/rooms/ABC123/ready')
  })

  it('should update ready status through the room readiness endpoint', async () => {
    apiMock.patch.mockResolvedValue({ data: { isReady: true } })
    const { setReadyStatus } = await loadRoomsModule()

    await expect(setReadyStatus('ABC123', true)).resolves.toEqual({ isReady: true })

    expect(apiMock.patch).toHaveBeenCalledWith('/rooms/ABC123/ready', { isReady: true })
  })

  it('should select mode and difficulty through host-controlled endpoints', async () => {
    apiMock.patch
      .mockResolvedValueOnce({ data: { mode: 'bird' } })
      .mockResolvedValueOnce({ data: { difficulty: 'hard' } })
    const { selectMode, selectDifficulty } = await loadRoomsModule()

    await expect(selectMode('ABC123', 'bird')).resolves.toEqual({ mode: 'bird' })
    await expect(selectDifficulty('ABC123', 'hard')).resolves.toEqual({ difficulty: 'hard' })

    expect(apiMock.patch).toHaveBeenNthCalledWith(1, '/rooms/ABC123/mode', { mode: 'bird' })
    expect(apiMock.patch).toHaveBeenNthCalledWith(2, '/rooms/ABC123/difficulty', { difficulty: 'hard' })
  })

  it('should submit and fetch ranking through ranking endpoints', async () => {
    apiMock.patch.mockResolvedValue({ data: { totalCorrectCount: 3 } })
    apiMock.get.mockResolvedValue({ data: { ranking: [{ rank: 1 }] } })
    const { submitRoundResult, getRanking } = await loadRoomsModule()

    await expect(submitRoundResult('ABC123', 3)).resolves.toEqual({ totalCorrectCount: 3 })
    await expect(getRanking('ABC123')).resolves.toEqual({ ranking: [{ rank: 1 }] })

    expect(apiMock.patch).toHaveBeenCalledWith('/rooms/ABC123/ranking', { roundCorrectCount: 3 })
    expect(apiMock.get).toHaveBeenCalledWith('/rooms/ABC123/ranking')
  })

  it('should skip keepalive leave when room code is empty', async () => {
    const { leaveRoomKeepalive } = await loadRoomsModule()

    await expect(leaveRoomKeepalive('  ', 'token')).resolves.toBeNull()

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('should skip keepalive leave when no token is available', async () => {
    getStoredAuthTokenMock.mockReturnValue(null)
    const { leaveRoomKeepalive } = await loadRoomsModule()

    await expect(leaveRoomKeepalive('ABC123')).resolves.toBeNull()

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('should send a DELETE keepalive request with bearer token', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true })
    const { leaveRoomKeepalive } = await loadRoomsModule()

    await leaveRoomKeepalive(' abc123 ', 'token-123')

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3000/api/rooms/ABC123', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer token-123',
      },
      keepalive: true,
    })
  })
})
