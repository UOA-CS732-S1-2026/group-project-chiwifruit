const request = require('supertest');

jest.mock('../../src/socket', () => ({
  emitRoomUpdate: jest.fn(),
  cancelPendingRoomRosterCleanup: jest.fn(),
}));

jest.mock('../../src/services/gameService', () => ({
  getGame: jest.fn(() => null),
  removeGame: jest.fn(),
}));

const { emitRoomUpdate, cancelPendingRoomRosterCleanup } = require('../../src/socket');
const { getGame, removeGame } = require('../../src/services/gameService');
const app = require('../../src/app');
const Room = require('../../src/models/Room');

function rawUserParticipant(id = 'userId123', username = 'Host', overrides = {}) {
  return { user: id, mockUsername: username, isReady: false, correctCount: 0, ...overrides };
}

function guestParticipant(id = 'guest-2', username = 'Guest Two', overrides = {}) {
  return { guestId: id, guestName: username, isReady: false, correctCount: 0, ...overrides };
}

function populateParticipants(participants) {
  return participants.map((participant) => {
    const { mockUsername, ...rest } = participant;
    if (rest.user && typeof rest.user !== 'object') {
      return { ...rest, user: { _id: rest.user, username: mockUsername || 'User' } };
    }
    return rest;
  });
}

function populatedRoomCopy(room) {
  return { ...room, participants: populateParticipants(room.participants) };
}

function mockRoomState(roomOrFactory, times = 1) {
  Array.from({ length: times }).forEach(() => {
    Room.findOne.mockReturnValueOnce({
      populate: jest.fn().mockImplementation(async () => {
        const room = typeof roomOrFactory === 'function' ? roomOrFactory() : roomOrFactory;
        return room ? populatedRoomCopy(room) : null;
      }),
    });
  });
}

function buildRoom(overrides = {}) {
  const room = {
    _id: 'room-1',
    roomCode: 'ABC',
    host: 'userId123',
    mode: 'bird',
    difficulty: 'easy',
    participants: [rawUserParticipant('userId123', 'Host'), guestParticipant('guest-2', 'Guest Two', { isReady: true, correctCount: 5 })],
    save: jest.fn(),
    ...overrides,
  };

  room.populate = jest.fn().mockImplementation(async () => {
    room.participants = populateParticipants(room.participants);
    return room;
  });

  return room;
}

function countParticipantsByIdentity(participants, identity) {
  return participants.filter((participant) => {
    if (identity.isGuest) return participant.guestId === identity.sub;
    if (participant.user && typeof participant.user === 'object') return String(participant.user._id) === String(identity.sub);
    return String(participant.user) === String(identity.sub);
  }).length;
}

// Unit scope: room API controller behaviour is isolated with mocked Mongoose models and socket/game services.
describe('Room API', () => {
  const token = 'Bearer test-token';
  const userIdentity = { sub: 'userId123', isGuest: false };

  beforeEach(() => {
    ['findOne', 'find', 'create', 'exists', 'updateOne', 'deleteOne'].forEach((method) => {
      if (!Room[method]) Room[method] = jest.fn();
      Room[method].mockReset();
    });

    emitRoomUpdate.mockReset();
    cancelPendingRoomRosterCleanup.mockReset();
    getGame.mockReset();
    getGame.mockReturnValue(null);
    removeGame.mockReset();
    Room.find.mockResolvedValue([]);

    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementation(() => ({ ...userIdentity, username: 'testuser' }));
  });

  it('should reject protected room operations without a token', async () => {
    await request(app).post('/api/rooms').expect(401);
  });

  describe('POST /api/rooms', () => {
    it('should create a new room for the authenticated user', async () => {
      const room = buildRoom({ roomCode: 'ABC123' });
      Room.exists.mockResolvedValue(false);
      Room.create.mockResolvedValue(room);
      mockRoomState(room, 2);

      const response = await request(app).post('/api/rooms').set('Authorization', token).send({}).expect(201);

      expect(response.body.roomCode).toBeDefined();
      expect(Room.create).toHaveBeenCalledWith(expect.objectContaining({ roomCode: response.body.roomCode, host: 'userId123' }));
    });

    it('should join an existing room exactly once and cancel pending roster cleanup', async () => {
      const room = buildRoom({ roomCode: 'XYZ', participants: [guestParticipant('guest-2', 'Guest Two')] });
      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(() => room, 2);

      const response = await request(app).post('/api/rooms').set('Authorization', token).send({ joinRoomCode: 'xyz' }).expect(200);

      expect(room.participants).toHaveLength(2);
      expect(room.participants[1]).toMatchObject({ user: 'userId123', isReady: false, correctCount: 0 });
      expect(cancelPendingRoomRosterCleanup).toHaveBeenCalledWith('XYZ', 'userId123');
      expect(response.body).toMatchObject({ message: 'Joined room', roomCode: 'XYZ', roomId: 'room-1' });
    });

    it('should collapse duplicate participants without losing the current participant state', async () => {
      const room = buildRoom({
        participants: [
          rawUserParticipant('userId123', 'Host', { isReady: true, correctCount: 3 }),
          rawUserParticipant('userId123', 'Host Duplicate'),
          guestParticipant('guest-2', 'Guest Two'),
          guestParticipant('guest-2', 'Guest Two Duplicate'),
        ],
      });
      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room, 2);

      await request(app).post('/api/rooms').set('Authorization', token).send({ joinRoomCode: 'ABC' }).expect(200);

      expect(countParticipantsByIdentity(room.participants, userIdentity)).toBe(1);
      expect(room.participants).toHaveLength(2);
      expect(room.participants.find((participant) => String(participant.user) === 'userId123')).toMatchObject({ isReady: true, correctCount: 3 });
    });

    it('should persistently collapse duplicate participants written by concurrent join requests', async () => {
      const beforeSave = buildRoom({ participants: [guestParticipant('guest-2', 'Guest Two')] });
      const persisted = buildRoom({ participants: [guestParticipant('guest-2', 'Guest Two'), rawUserParticipant('userId123'), rawUserParticipant('userId123', 'Duplicate')] });
      Room.findOne.mockResolvedValueOnce(beforeSave).mockResolvedValueOnce(persisted);
      mockRoomState(() => persisted);

      await request(app).post('/api/rooms').set('Authorization', token).send({ joinRoomCode: 'ABC' }).expect(200);

      expect(beforeSave.save).toHaveBeenCalled();
      expect(persisted.save).toHaveBeenCalled();
      expect(countParticipantsByIdentity(persisted.participants, userIdentity)).toBe(1);
    });

    it('should remove existing user and guest room membership before joining another room', async () => {
      const oldRoom = buildRoom({ _id: 'old', roomCode: 'OLD111', host: 'userId123', participants: [rawUserParticipant('userId123'), guestParticipant('guest-2')] });
      const targetRoom = buildRoom({ _id: 'new', roomCode: 'NEW111', host: 'guest-2', participants: [guestParticipant('guest-2')] });
      Room.findOne.mockResolvedValueOnce(targetRoom);
      Room.find.mockResolvedValue([oldRoom, targetRoom]);
      mockRoomState(() => oldRoom);
      mockRoomState(() => targetRoom, 2);

      await request(app).post('/api/rooms').set('Authorization', token).send({ joinRoomCode: 'new111' }).expect(200);

      expect(countParticipantsByIdentity(oldRoom.participants, userIdentity)).toBe(0);
      expect(countParticipantsByIdentity(targetRoom.participants, userIdentity)).toBe(1);
      expect(oldRoom.host).toBe('guest-2');
      expect(emitRoomUpdate).toHaveBeenCalledWith(undefined, 'OLD111', expect.objectContaining({ roomCode: 'OLD111' }));
      expect(emitRoomUpdate).toHaveBeenCalledWith(undefined, 'NEW111', expect.objectContaining({ roomCode: 'NEW111' }));
    });

    it('should reject joining a full or missing room', async () => {
      Room.findOne.mockResolvedValueOnce(buildRoom({ participants: Array.from({ length: 6 }, (_, index) => guestParticipant(`guest-${index}`, `Guest ${index}`)) }));
      await request(app).post('/api/rooms').set('Authorization', token).send({ joinRoomCode: 'ABC' }).expect(409);

      Room.findOne.mockResolvedValueOnce(null);
      const response = await request(app).post('/api/rooms').set('Authorization', token).send({ joinRoomCode: 'XYZ' }).expect(404);
      expect(response.body.message).toBe('Room not found');
    });
  });

  describe('room readiness', () => {
    it('should update and return normalized readiness state', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('userId123', 'Host', { isReady: false })] });
      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room);

      await request(app).patch('/api/rooms/ABC/ready').set('Authorization', token).send({ isReady: true }).expect(200);
      expect(room.participants[0].isReady).toBe(true);

      Room.exists.mockResolvedValue(true);
      const duplicateRoom = buildRoom({ participants: [rawUserParticipant('userId123'), rawUserParticipant('userId123', 'Duplicate'), guestParticipant('guest-2', 'Guest Two', { isReady: true })] });
      mockRoomState(duplicateRoom);

      const response = await request(app).get('/api/rooms/ABC/ready').set('Authorization', token).expect(200);
      expect(response.body.participantCount).toBe(2);
      expect(response.body.participants.filter((participant) => String(participant.userId) === 'userId123')).toHaveLength(1);
    });
  });

  describe('host-controlled room settings', () => {
    it('should normalize mode, keep difficulty strict, and reset readiness on valid changes', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('userId123', 'Host', { isReady: true })] });
      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room);

      const modeResponse = await request(app).patch('/api/rooms/ABC/mode').set('Authorization', token).send({ mode: '  AUSSIE  ' }).expect(200);
      expect(modeResponse.body.mode).toBe('aussie');
      expect(room.participants[0].isReady).toBe(false);

      const difficultyRoom = buildRoom({ participants: [rawUserParticipant('userId123', 'Host', { isReady: true })] });
      Room.findOne.mockResolvedValueOnce(difficultyRoom);
      mockRoomState(difficultyRoom);

      const difficultyResponse = await request(app).patch('/api/rooms/ABC/difficulty').set('Authorization', token).send({ difficulty: 'hard' }).expect(200);
      expect(difficultyResponse.body.difficulty).toBe('hard');
      expect(difficultyRoom.participants[0].isReady).toBe(false);
    });

    it.each([
      ['invalid mode', '/api/rooms/ABC/mode', { mode: 'invalid' }, 'mode must be bird, piano, maori, animal, or aussie'],
      ['missing mode', '/api/rooms/ABC/mode', {}, 'mode must be bird, piano, maori, animal, or aussie'],
      ['invalid difficulty', '/api/rooms/ABC/difficulty', { difficulty: 'invalid' }, 'difficulty must be easy, medium, or hard'],
      ['uppercase difficulty', '/api/rooms/ABC/difficulty', { difficulty: 'HARD' }, 'difficulty must be easy, medium, or hard'],
    ])('should reject %s before reading the room', async (_label, path, body, expectedMessage) => {
      const response = await request(app).patch(path).set('Authorization', token).send(body).expect(400);
      expect(response.body.message).toBe(expectedMessage);
      expect(Room.findOne).not.toHaveBeenCalled();
    });
  });

  describe('ranking', () => {
    it.each([
      ['negative value', { roundCorrectCount: -1 }],
      ['missing value', {}],
      ['string value', { roundCorrectCount: '2' }],
      ['decimal value', { roundCorrectCount: 1.5 }],
    ])('should reject invalid round result: %s', async (_label, body) => {
      const response = await request(app).patch('/api/rooms/ABC/ranking').set('Authorization', token).send(body).expect(400);
      expect(response.body.message).toBe('roundCorrectCount must be a non-negative integer');
      expect(Room.updateOne).not.toHaveBeenCalled();
    });

    it('should submit ranking and handle a missing room after the score update', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('userId123', 'Host', { correctCount: 4 })] });
      Room.updateOne.mockResolvedValueOnce({ matchedCount: 1 });
      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room);

      const response = await request(app).patch('/api/rooms/ABC/ranking').set('Authorization', token).send({ roundCorrectCount: 2 }).expect(200);
      expect(response.body.ranking[0]).toMatchObject({ username: 'Host', correctCount: 4, rank: 1 });

      Room.updateOne.mockResolvedValueOnce({ matchedCount: 1 });
      Room.findOne.mockResolvedValueOnce(null);
      await request(app).patch('/api/rooms/ABC/ranking').set('Authorization', token).send({ roundCorrectCount: 2 }).expect(404);
    });

    it('should rank by active in-memory game scores when a game exists', async () => {
      const room = populatedRoomCopy(buildRoom({ participants: [rawUserParticipant('userId123', 'Host'), rawUserParticipant('user2', 'Player Two'), guestParticipant('guest-3', 'Guest Three')] }));
      Room.findOne.mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(room) });
      getGame.mockReturnValue({
        players: [
          { userId: 'userId123', username: 'Host', isGuest: false, score: 3, initialOrder: 1 },
          { userId: 'user2', username: 'Player Two', isGuest: false, score: 7, initialOrder: 2 },
          { userId: 'guest-3', username: 'Guest Three', isGuest: true, score: 7, initialOrder: 3 },
        ],
      });

      const response = await request(app).get('/api/rooms/ABC/ranking').set('Authorization', token).expect(200);

      expect(room.save).toHaveBeenCalled();
      expect(response.body.ranking.map(({ userId, rank }) => ({ userId, rank }))).toEqual([
        { userId: 'guest-3', rank: 1 },
        { userId: 'user2', rank: 2 },
        { userId: 'userId123', rank: 3 },
      ]);
    });
  });

  describe('DELETE /api/rooms/:roomCode', () => {
    it('should delete the room and remove game state when the last participant leaves', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('userId123', 'Host')] });
      Room.findOne.mockResolvedValue(room);
      Room.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const response = await request(app).delete('/api/rooms/ABC').set('Authorization', token).expect(200);

      expect(Room.deleteOne).toHaveBeenCalledWith({ _id: 'room-1' });
      expect(removeGame).toHaveBeenCalledWith('ABC');
      expect(response.body).toMatchObject({ message: 'Left room', roomCode: 'ABC', deleted: true });
    });

    it('should remove all duplicate entries for the leaving participant', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('userId123'), rawUserParticipant('userId123', 'Duplicate'), guestParticipant('guest-2')] });
      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room);

      const response = await request(app).delete('/api/rooms/ABC').set('Authorization', token).expect(200);

      expect(countParticipantsByIdentity(room.participants, userIdentity)).toBe(0);
      expect(response.body).toMatchObject({ message: 'Left room', roomCode: 'ABC', hostId: 'guest-2' });
    });
  });
});
