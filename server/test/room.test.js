const request = require('supertest');
const app = require('../src/app');
const Room = require('../src/models/Room');

function rawUserParticipant(id = 'userId123', username = 'Host', overrides = {}) {
  return {
    user: id,
    mockUsername: username,
    isReady: false,
    correctCount: 0,
    ...overrides,
  };
}

function guestParticipant(id = 'guest-2', username = 'Guest Two', overrides = {}) {
  return {
    guestId: id,
    guestName: username,
    isReady: false,
    correctCount: 0,
    ...overrides,
  };
}

function populateParticipants(participants) {
  return participants.map((participant) => {
    const { mockUsername, ...rest } = participant;

    if (rest.user && typeof rest.user !== 'object') {
      return {
        ...rest,
        user: {
          _id: rest.user,
          username: mockUsername || 'User',
        },
      };
    }

    return rest;
  });
}

function populatedRoomCopy(room) {
  return {
    ...room,
    participants: populateParticipants(room.participants),
  };
}

function mockRoomState(roomOrFactory) {
  Room.findOne.mockReturnValueOnce({
    populate: jest.fn().mockImplementation(async () => {
      const room = typeof roomOrFactory === 'function' ? roomOrFactory() : roomOrFactory;
      return room ? populatedRoomCopy(room) : null;
    }),
  });
}

function buildRoom(overrides = {}) {
  const room = {
    _id: 'room-1',
    roomCode: 'ABC',
    host: 'userId123',
    mode: 'bird',
    difficulty: 'easy',
    participants: [
      rawUserParticipant('userId123', 'Host', { correctCount: 2 }),
      guestParticipant('guest-2', 'Guest Two', { isReady: true, correctCount: 5 }),
    ],
    save: jest.fn(),
    ...overrides,
  };

  room.populate = jest.fn().mockImplementation(async () => {
    room.participants = populateParticipants(room.participants);
    return room;
  });

  return room;
}

describe('Room API', () => {
  const token = 'Bearer test-token';

  beforeEach(() => {
    ['findOne', 'create', 'exists', 'updateOne', 'deleteOne'].forEach((method) => {
      if (!Room[method]) {
        Room[method] = jest.fn();
      }
      Room[method].mockReset();
    });
  });

  it('should reject without token', async () => {
    await request(app).post('/api/rooms').expect(401);
  });

  describe('POST /api/rooms', () => {
    it('should create a new room', async () => {
      const room = buildRoom({ roomCode: 'ABC123' });

      Room.exists.mockResolvedValue(false);
      Room.create.mockResolvedValue(room);
      mockRoomState(room);

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', token)
        .send({})
        .expect(201);

      expect(response.body.roomCode).toBeDefined();
      expect(Room.create).toHaveBeenCalledWith(expect.objectContaining({
        roomCode: response.body.roomCode,
        host: 'userId123',
      }));
    });

    it('should join an existing room and add the participant', async () => {
      const roomBeforeSave = buildRoom({
        roomCode: 'XYZ',
        participants: [guestParticipant('guest-2', 'Guest Two')],
      });

      Room.findOne.mockResolvedValueOnce(roomBeforeSave);
      mockRoomState(() => roomBeforeSave);

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', token)
        .send({ joinRoomCode: 'xyz' })
        .expect(200);

      expect(roomBeforeSave.participants).toHaveLength(2);
      expect(roomBeforeSave.participants[1]).toMatchObject({ user: 'userId123', isReady: false, correctCount: 0 });
      expect(roomBeforeSave.save).toHaveBeenCalled();
      expect(response.body).toMatchObject({ message: 'Joined room', roomCode: 'XYZ', roomId: 'room-1' });
    });

    it('should not duplicate participant when joining the same room again', async () => {
      const room = buildRoom({
        participants: [rawUserParticipant('userId123', 'Host')],
      });

      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room);

      await request(app)
        .post('/api/rooms')
        .set('Authorization', token)
        .send({ joinRoomCode: 'ABC' })
        .expect(200);

      expect(room.participants).toHaveLength(1);
      expect(room.save).not.toHaveBeenCalled();
    });

    it('should reject joining a full room', async () => {
      const room = buildRoom({
        participants: Array.from({ length: 6 }, (_, index) => guestParticipant(`guest-${index}`, `Guest ${index}`)),
      });

      Room.findOne.mockResolvedValue(room);

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', token)
        .send({ joinRoomCode: 'ABC' })
        .expect(409);

      expect(response.body.message).toContain('Room is full');
    });

    it('should return 404 when joining non-existent room', async () => {
      Room.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', token)
        .send({ joinRoomCode: 'XYZ' })
        .expect(404);

      expect(response.body.message).toBe('Room not found');
    });
  });

  describe('PATCH /api/rooms/:roomCode/ready', () => {
    it('should update participant readiness', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('userId123', 'Host', { isReady: false })] });

      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room);

      const response = await request(app)
        .patch('/api/rooms/ABC/ready')
        .set('Authorization', token)
        .send({ isReady: true })
        .expect(200);

      expect(room.participants[0].isReady).toBe(true);
      expect(room.save).toHaveBeenCalled();
      expect(response.body).toMatchObject({ message: 'Readiness updated', roomCode: 'ABC', isReady: true });
    });

    it('should return 404 when setting ready for missing room', async () => {
      Room.findOne.mockResolvedValueOnce(null);

      await request(app)
        .patch('/api/rooms/MISSING/ready')
        .set('Authorization', token)
        .send({ isReady: true })
        .expect(404);
    });

    it('should return 403 when setting ready before joining room', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('someone-else', 'Other')] });
      Room.findOne.mockResolvedValue(room);

      const response = await request(app)
        .patch('/api/rooms/ABC/ready')
        .set('Authorization', token)
        .send({ isReady: true })
        .expect(403);

      expect(response.body.message).toBe('Join the room first before setting readiness');
    });
  });

  describe('GET /api/rooms/:roomCode/ready', () => {
    it('should return room readiness state', async () => {
      const room = buildRoom();

      Room.exists.mockResolvedValue(true);
      mockRoomState(room);

      const response = await request(app)
        .get('/api/rooms/ABC/ready')
        .set('Authorization', token)
        .expect(200);

      expect(response.body).toMatchObject({
        roomCode: 'ABC',
        participantCount: 2,
        canStartGame: true,
        everyoneReady: true,
      });
    });

    it('should return 404 when reading readiness for missing room', async () => {
      Room.exists.mockResolvedValue(false);

      await request(app)
        .get('/api/rooms/MISSING/ready')
        .set('Authorization', token)
        .expect(404);
    });
  });

  describe('PATCH /api/rooms/:roomCode/mode', () => {
    it('should reject invalid mode', async () => {
      await request(app)
        .patch('/api/rooms/ABC/mode')
        .set('Authorization', token)
        .send({ mode: 'invalid' })
        .expect(400);
    });

    it('should return 404 when selecting mode for missing room', async () => {
      Room.findOne.mockResolvedValue(null);

      await request(app)
        .patch('/api/rooms/ABC/mode')
        .set('Authorization', token)
        .send({ mode: 'bird' })
        .expect(404);
    });

    it('should return 403 when non-host selects mode', async () => {
      const room = buildRoom({ host: 'someone-else' });
      Room.findOne.mockResolvedValue(room);

      await request(app)
        .patch('/api/rooms/ABC/mode')
        .set('Authorization', token)
        .send({ mode: 'bird' })
        .expect(403);
    });

    it('should reset readiness when mode changes', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('userId123', 'Host', { isReady: true })] });

      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room);

      await request(app)
        .patch('/api/rooms/ABC/mode')
        .set('Authorization', token)
        .send({ mode: 'bird' })
        .expect(200);

      expect(room.mode).toBe('bird');
      expect(room.participants[0].isReady).toBe(false);
    });
  });

  describe('PATCH /api/rooms/:roomCode/difficulty', () => {
    it('should reject invalid difficulty', async () => {
      await request(app)
        .patch('/api/rooms/ABC/difficulty')
        .set('Authorization', token)
        .send({ difficulty: 'invalid' })
        .expect(400);
    });

    it('should reset readiness when difficulty changes', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('userId123', 'Host', { isReady: true })] });

      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room);

      const response = await request(app)
        .patch('/api/rooms/ABC/difficulty')
        .set('Authorization', token)
        .send({ difficulty: 'hard' })
        .expect(200);

      expect(room.difficulty).toBe('hard');
      expect(room.participants[0].isReady).toBe(false);
      expect(response.body.difficulty).toBe('hard');
    });

    it('should return 403 when non-host selects difficulty', async () => {
      const room = buildRoom({ host: 'someone-else' });
      Room.findOne.mockResolvedValue(room);

      await request(app)
        .patch('/api/rooms/ABC/difficulty')
        .set('Authorization', token)
        .send({ difficulty: 'medium' })
        .expect(403);
    });
  });

  describe('PATCH /api/rooms/:roomCode/ranking', () => {
    it('should reject invalid round result', async () => {
      await request(app)
        .patch('/api/rooms/ABC/ranking')
        .set('Authorization', token)
        .send({ roundCorrectCount: -1 })
        .expect(400);
    });

    it('should submit round result and return ranking', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('userId123', 'Host', { correctCount: 4 })] });

      Room.updateOne.mockResolvedValue({ matchedCount: 1 });
      Room.findOne.mockResolvedValueOnce(room);
      mockRoomState(room);

      const response = await request(app)
        .patch('/api/rooms/ABC/ranking')
        .set('Authorization', token)
        .send({ roundCorrectCount: 2 })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Round result submitted',
        roomCode: 'ABC',
        totalCorrectCount: 4,
      });
      expect(response.body.ranking[0]).toMatchObject({ username: 'Host', correctCount: 4, rank: 1 });
    });

    it('should return 403 when submitting result before joining room', async () => {
      Room.updateOne.mockResolvedValue({ matchedCount: 0 });

      await request(app)
        .patch('/api/rooms/ABC/ranking')
        .set('Authorization', token)
        .send({ roundCorrectCount: 1 })
        .expect(403);
    });
  });

  describe('GET /api/rooms/:roomCode/ranking', () => {
    it('should return current ranking', async () => {
      const room = populatedRoomCopy(buildRoom());
      Room.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(room),
      });

      const response = await request(app)
        .get('/api/rooms/ABC/ranking')
        .set('Authorization', token)
        .expect(200);

      expect(response.body.roomCode).toBe('ABC');
      expect(response.body.ranking[0]).toMatchObject({ username: 'Guest Two', correctCount: 5, rank: 1 });
    });

    it('should return 404 when ranking room is missing', async () => {
      Room.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(null),
      });

      await request(app)
        .get('/api/rooms/MISSING/ranking')
        .set('Authorization', token)
        .expect(404);
    });
  });

  describe('DELETE /api/rooms/:roomCode', () => {
    it('should leave and delete room when last participant leaves', async () => {
      const room = buildRoom({
        participants: [rawUserParticipant('userId123', 'Host')],
      });
      Room.findOne.mockResolvedValue(room);
      Room.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const response = await request(app)
        .delete('/api/rooms/ABC')
        .set('Authorization', token)
        .expect(200);

      expect(Room.deleteOne).toHaveBeenCalledWith({ _id: 'room-1' });
      expect(response.body).toMatchObject({ message: 'Left room', roomCode: 'ABC', deleted: true });
    });

    it('should return 404 when room not found', async () => {
      Room.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/rooms/ABC')
        .set('Authorization', token)
        .expect(404);

      expect(response.body.message).toBe('Room not found');
    });

    it('should return 403 when leaving before joining room', async () => {
      const room = buildRoom({ participants: [rawUserParticipant('someone-else', 'Other')] });
      Room.findOne.mockResolvedValue(room);

      const response = await request(app)
        .delete('/api/rooms/ABC')
        .set('Authorization', token)
        .expect(403);

      expect(response.body.message).toBe('Join the room first before leaving');
    });
  });
});