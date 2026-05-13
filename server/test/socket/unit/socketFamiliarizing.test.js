// Unit scope: socket familiarizing timer orchestration is verified with mocked game and room services.

jest.mock('../../../src/services/gameService', () => ({
  TURN_MS: 20000,
  getGame: jest.fn(),
  startGame: jest.fn(),
  markFamiliarReady: jest.fn(),
  forceStartPlaying: jest.fn(),
  forfeitPlayer: jest.fn(),
  registerFamiliarPadPress: jest.fn(),
  registerPadPress: jest.fn(),
  registerTurnTimeout: jest.fn(),
  getFamiliarizeEndsAt: jest.fn(() => Date.now() + 5000),
  serializeGame: jest.fn((game) => game),
  clearRoomTimeout: jest.fn(),
  scheduleRoomTimeout: jest.fn(),
  removeGame: jest.fn(),
  cleanupGameLater: jest.fn(),
}));

jest.mock('../../../src/services/roomStateService', () => ({
  normalizeRoomParticipants: jest.fn(() => false),
  removeParticipantFromRoom: jest.fn(),
}));

jest.resetModules();

const { Server } = require('socket.io');
const { initSocket } = require('../../../src/socket');
const gameService = require('../../../src/services/gameService');
const roomStateService = require('../../../src/services/roomStateService');

function makeIo() {
  const io = {
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };
  Server.mockImplementation(() => io);
  return io;
}

function connectSocket(io, userId = 'user2', roomCode = 'ROOM1') {
  initSocket({}, 'http://localhost:5173');
  const [, onConnection] = io.on.mock.calls.find(([eventName]) => eventName === 'connection');
  const socket = {
    id: 'socket-id',
    user: { sub: userId },
    rooms: new Set(['socket-id', roomCode]),
    on: jest.fn(),
    leave: jest.fn(),
  };
  onConnection(socket);
  return socket;
}

function getHandler(socket, eventName) {
  return socket.on.mock.calls.find(([registeredEventName]) => registeredEventName === eventName)?.[1] ?? null;
}

describe('socket familiarizing timer orchestration', () => {
  let io;

  beforeEach(() => {
    jest.clearAllMocks();
    io = makeIo();
    gameService.getGame.mockReturnValue({ status: 'familiarizing', roomCode: 'ROOM1' });
    gameService.getFamiliarizeEndsAt.mockReturnValue(Date.now() + 5000);
    roomStateService.removeParticipantFromRoom.mockResolvedValue({
      ok: true,
      deleted: false,
      roomState: { roomCode: 'ROOM1' },
    });
  });

  describe('leave_room during familiarizing', () => {
    it('should re-arm the familiarization timer when multiple players remain', () => {
      gameService.forfeitPlayer.mockReturnValue({ ok: true, game: { status: 'familiarizing', scores: {} } });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      getHandler(socket, 'leave_room')({ roomCode: 'ROOM1' });

      expect(gameService.clearRoomTimeout).toHaveBeenCalledWith('ROOM1');
      expect(gameService.scheduleRoomTimeout).toHaveBeenCalledWith('ROOM1', expect.any(Function), expect.any(Number));
      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
    });

    it('should schedule cleanup when the forfeit finishes the game', () => {
      gameService.forfeitPlayer.mockReturnValue({ ok: true, game: { status: 'finished', scores: { user1: 2 } } });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      getHandler(socket, 'leave_room')({ roomCode: 'ROOM1' });

      expect(gameService.cleanupGameLater).toHaveBeenCalledWith('ROOM1');
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
    });

    it('should not mutate timers when forfeitPlayer rejects the event', () => {
      gameService.forfeitPlayer.mockReturnValue({ ok: false, error: 'Not a participant.' });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      getHandler(socket, 'leave_room')({ roomCode: 'ROOM1' });

      expect(gameService.clearRoomTimeout).not.toHaveBeenCalled();
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
    });

    it('should remove the in-memory game when room deletion succeeds', async () => {
      gameService.forfeitPlayer.mockReturnValue({ ok: true, game: { status: 'finished', scores: { user1: 2 } } });
      roomStateService.removeParticipantFromRoom.mockResolvedValue({ ok: true, deleted: true, roomState: null });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      await getHandler(socket, 'leave_room')({ roomCode: 'ROOM1' });

      expect(gameService.removeGame).toHaveBeenCalledWith('ROOM1');
    });
  });

  describe('disconnecting during familiarizing', () => {
    it('should re-arm the familiarization timer when multiple players remain', () => {
      gameService.forfeitPlayer.mockReturnValue({ ok: true, game: { status: 'familiarizing', scores: {} } });

      const socket = connectSocket(io, 'user3', 'ROOM1');
      getHandler(socket, 'disconnecting')();

      expect(gameService.clearRoomTimeout).toHaveBeenCalledWith('ROOM1');
      expect(gameService.scheduleRoomTimeout).toHaveBeenCalledWith('ROOM1', expect.any(Function), expect.any(Number));
      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
    });

    it('should schedule cleanup when the forfeit finishes the game', () => {
      gameService.forfeitPlayer.mockReturnValue({ ok: true, game: { status: 'finished', scores: { user1: 0 } } });

      const socket = connectSocket(io, 'user3', 'ROOM1');
      getHandler(socket, 'disconnecting')();

      expect(gameService.cleanupGameLater).toHaveBeenCalledWith('ROOM1');
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
    });
  });

  describe('familiarization auto-start timeout callback', () => {
    function armFamiliarTimer(socket) {
      gameService.forfeitPlayer.mockReturnValueOnce({ ok: true, game: { status: 'familiarizing', scores: {} } });
      getHandler(socket, 'leave_room')({ roomCode: 'ROOM1' });
      const scheduleCall = gameService.scheduleRoomTimeout.mock.calls.find(([roomCode]) => roomCode === 'ROOM1');
      expect(scheduleCall).toBeDefined();
      return scheduleCall[1];
    }

    it('should cleanup and not schedule a turn timer when force start finishes the game', () => {
      gameService.forceStartPlaying.mockReturnValue({ ok: true, game: { status: 'finished', scores: { user1: 3 } } });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      const timeoutCallback = armFamiliarTimer(socket);

      jest.clearAllMocks();
      timeoutCallback();

      expect(gameService.clearRoomTimeout).toHaveBeenCalledWith('ROOM1');
      expect(gameService.cleanupGameLater).toHaveBeenCalledWith('ROOM1');
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
    });

    it('should schedule a turn timer when force start transitions to playing', () => {
      gameService.forceStartPlaying.mockReturnValue({ ok: true, game: { status: 'playing', turnEndsAt: Date.now() + 20000 } });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      const timeoutCallback = armFamiliarTimer(socket);

      jest.clearAllMocks();
      gameService.getGame.mockReturnValue({ status: 'playing', turnEndsAt: Date.now() + 20000 });
      timeoutCallback();

      expect(gameService.scheduleRoomTimeout).toHaveBeenCalledWith('ROOM1', expect.any(Function), expect.any(Number));
      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
    });

    it('should do nothing when force start fails', () => {
      gameService.forceStartPlaying.mockReturnValue({ ok: false, error: 'No active game.' });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      const timeoutCallback = armFamiliarTimer(socket);

      jest.clearAllMocks();
      timeoutCallback();

      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
    });
  });
});
