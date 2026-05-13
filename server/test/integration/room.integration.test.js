const request = require('supertest')

const {
  mongoose,
  connectIntegrationDatabase,
  clearIntegrationDatabase,
  disconnectIntegrationDatabase,
} = require('../helpers/database')
const { createAuthHeader, userIdentity, guestIdentity } = require('../helpers/auth')

const app = require('../../src/app')
const Room = require('../../src/models/Room')

jest.setTimeout(30_000)

function registeredUser(username = 'User') {
  return userIdentity(new mongoose.Types.ObjectId().toString(), username)
}

async function createRoom(identity = registeredUser('Host')) {
  const response = await request(app)
    .post('/api/rooms')
    .set('Authorization', createAuthHeader(identity))
    .send({})
    .expect(201)

  return { identity, roomCode: response.body.roomCode, body: response.body }
}

function joinRoom(roomCode, identity) {
  return request(app)
    .post('/api/rooms')
    .set('Authorization', createAuthHeader(identity))
    .send({ joinRoomCode: roomCode })
}

// Integration scope: verify Express routes, auth middleware, Mongoose models, and Mongo persistence together.
describe('Room API integration', () => {
  beforeAll(connectIntegrationDatabase)
  beforeEach(clearIntegrationDatabase)
  afterAll(disconnectIntegrationDatabase)

  it('should create a persisted room for a registered host', async () => {
    const host = registeredUser('Host')
    const created = await createRoom(host)
    const room = await Room.findOne({ roomCode: created.roomCode }).lean()

    expect(created.body).toMatchObject({
      message: 'Room created',
      roomCode: created.roomCode,
    })
    expect(room).toMatchObject({
      roomCode: created.roomCode,
      host: host.sub,
      mode: 'bird',
      difficulty: 'easy',
    })
    expect(room.participants).toHaveLength(1)
    expect(String(room.participants[0].user)).toBe(host.sub)
    expect(room.participants[0].isReady).toBe(false)
  })

  it('should join a guest to an existing room and persist the roster', async () => {
    const { roomCode } = await createRoom(registeredUser('Host'))
    const guest = guestIdentity('guest-integration-1', 'Guest One')

    const response = await joinRoom(roomCode.toLowerCase(), guest).expect(200)
    const room = await Room.findOne({ roomCode }).lean()

    expect(response.body).toMatchObject({ message: 'Joined room', roomCode })
    expect(room.participants).toHaveLength(2)
    expect(room.participants[1]).toMatchObject({
      guestId: guest.sub,
      guestName: guest.username,
      isReady: false,
      correctCount: 0,
    })
  })

  it('should enforce single-room membership when the same user joins another room', async () => {
    const player = registeredUser('Player')
    const firstRoom = await createRoom(player)
    const secondRoom = await createRoom(registeredUser('Other Host'))

    await joinRoom(secondRoom.roomCode, player).expect(200)

    const oldRoom = await Room.findOne({ roomCode: firstRoom.roomCode }).lean()
    const newRoom = await Room.findOne({ roomCode: secondRoom.roomCode }).lean()

    expect(oldRoom).toBeNull()
    expect(newRoom.participants.map((participant) => String(participant.user || participant.guestId)))
      .toContain(player.sub)
  })

  it('should persist readiness, host settings, and readiness reset after setting changes', async () => {
    const host = registeredUser('Host')
    const created = await createRoom(host)
    const guest = guestIdentity('guest-ready-1', 'Ready Guest')
    await joinRoom(created.roomCode, guest).expect(200)

    await request(app)
      .patch(`/api/rooms/${created.roomCode}/ready`)
      .set('Authorization', createAuthHeader(guest))
      .send({ isReady: true })
      .expect(200)

    let room = await Room.findOne({ roomCode: created.roomCode }).lean()
    expect(room.participants.find((participant) => participant.guestId === guest.sub).isReady).toBe(true)

    await request(app)
      .patch(`/api/rooms/${created.roomCode}/mode`)
      .set('Authorization', createAuthHeader(host))
      .send({ mode: '  AUSSIE  ' })
      .expect(200)

    await request(app)
      .patch(`/api/rooms/${created.roomCode}/difficulty`)
      .set('Authorization', createAuthHeader(host))
      .send({ difficulty: 'hard' })
      .expect(200)

    room = await Room.findOne({ roomCode: created.roomCode }).lean()
    expect(room).toMatchObject({ mode: 'aussie', difficulty: 'hard' })
    expect(room.participants.every((participant) => participant.isReady === false)).toBe(true)
  })

  it('should reject room overflow without mutating the persisted roster', async () => {
    const created = await createRoom(registeredUser('Host'))

    for (let index = 1; index <= 5; index += 1) {
      await joinRoom(created.roomCode, guestIdentity(`guest-full-${index}`, `Guest ${index}`)).expect(200)
    }

    await joinRoom(created.roomCode, guestIdentity('guest-overflow', 'Overflow Guest')).expect(409)

    const room = await Room.findOne({ roomCode: created.roomCode }).lean()
    expect(room.participants).toHaveLength(6)
    expect(room.participants.some((participant) => participant.guestId === 'guest-overflow')).toBe(false)
  })

  it('should transfer host on leave and delete the room when the last participant leaves', async () => {
    const host = registeredUser('Host')
    const guest = guestIdentity('guest-host-transfer', 'Next Host')
    const created = await createRoom(host)
    await joinRoom(created.roomCode, guest).expect(200)

    await request(app)
      .delete(`/api/rooms/${created.roomCode}`)
      .set('Authorization', createAuthHeader(host))
      .expect(200)

    let room = await Room.findOne({ roomCode: created.roomCode }).lean()
    expect(room.host).toBe(guest.sub)
    expect(room.participants).toHaveLength(1)
    expect(room.participants[0].guestId).toBe(guest.sub)

    await request(app)
      .delete(`/api/rooms/${created.roomCode}`)
      .set('Authorization', createAuthHeader(guest))
      .expect(200)

    room = await Room.findOne({ roomCode: created.roomCode }).lean()
    expect(room).toBeNull()
  })
})
