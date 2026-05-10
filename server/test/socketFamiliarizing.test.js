// socketFamiliarizing.test.js
//
// Socket-level regression tests for familiarizing-phase forfeit and
// familiarization auto-start timer orchestration.
//
// Why jest.resetModules() is required here:
//   jest.setup.js loads `roomController`, which transitively loads
//   `socket/index.js`, caching it with the REAL gameService before
//   the jest.mock call takes effect.  jest.resetModules() clears that
//   cache so the subsequent require('./socket') gets a fresh load that
//   picks up the mocked gameService.

jest.mock('../src/services/gameService', () => ({
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
  serializeGame: jest.fn((g) => g),
  clearRoomTimeout: jest.fn(),
  scheduleRoomTimeout: jest.fn(),
  cleanupGameLater: jest.fn(),
}));

// Clear the module cache so the socket module is reloaded with the mock above.
jest.resetModules();

const { Server } = require('socket.io');
const { initSocket } = require('../src/socket');
const gameService = require('../src/services/gameService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIo() {
  const io = {
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };
  Server.mockImplementation(() => io);
  return io;
}

// Call initSocket, extract the connection handler, create a synthetic socket,
// and invoke the handler so that socket event listeners are registered.
function connectSocket(io, userId = 'user2', roomCode = 'ROOM1') {
  initSocket({}, 'http://localhost:5173');
  const [, onConnection] = io.on.mock.calls.find(([e]) => e === 'connection');
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
  const call = socket.on.mock.calls.find(([e]) => e === eventName);
  return call ? call[1] : null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('socket: familiarizing-phase forfeit timer orchestration', () => {
  let io;

  beforeEach(() => {
    jest.clearAllMocks();
    io = makeIo();
    // Default: getGame returns a familiarizing game so scheduleFamiliarAutoStart proceeds.
    gameService.getGame.mockReturnValue({ status: 'familiarizing', roomCode: 'ROOM1' });
    gameService.getFamiliarizeEndsAt.mockReturnValue(Date.now() + 5000);
  });

  describe('leave_room forfeit during familiarizing', () => {
    it('re-arms the familiarization timer when multiple alive players remain', () => {
      gameService.forfeitPlayer.mockReturnValue({ ok: true, game: { status: 'familiarizing', scores: {} } });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      getHandler(socket, 'leave_room')({ roomCode: 'ROOM1' });

      // clearRoomTimeout fires first, then scheduleRoomTimeout via scheduleFamiliarAutoStart.
      expect(gameService.clearRoomTimeout).toHaveBeenCalledWith('ROOM1');
      expect(gameService.scheduleRoomTimeout).toHaveBeenCalledWith('ROOM1', expect.any(Function), expect.any(Number));
      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
    });

    it('schedules cleanup when the forfeit finishes the game (only one alive player)', () => {
      gameService.forfeitPlayer.mockReturnValue({
        ok: true,
        game: { status: 'finished', scores: { user1: 2, user2: 0 } },
      });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      getHandler(socket, 'leave_room')({ roomCode: 'ROOM1' });

      expect(gameService.cleanupGameLater).toHaveBeenCalledWith('ROOM1');
      // The familiarization timer must NOT be re-armed for a finished game.
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
    });

    it('does nothing when forfeitPlayer returns not-ok', () => {
      gameService.forfeitPlayer.mockReturnValue({ ok: false, error: 'Not a participant.' });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      getHandler(socket, 'leave_room')({ roomCode: 'ROOM1' });

      expect(gameService.clearRoomTimeout).not.toHaveBeenCalled();
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
    });
  });

  describe('disconnecting forfeit during familiarizing', () => {
    it('re-arms the familiarization timer when multiple alive players remain', () => {
      gameService.forfeitPlayer.mockReturnValue({ ok: true, game: { status: 'familiarizing', scores: {} } });

      const socket = connectSocket(io, 'user3', 'ROOM1');
      getHandler(socket, 'disconnecting')();

      expect(gameService.clearRoomTimeout).toHaveBeenCalledWith('ROOM1');
      expect(gameService.scheduleRoomTimeout).toHaveBeenCalledWith('ROOM1', expect.any(Function), expect.any(Number));
      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
    });

    it('schedules cleanup when the forfeit finishes the game (only one alive player)', () => {
      gameService.forfeitPlayer.mockReturnValue({
        ok: true,
        game: { status: 'finished', scores: { user1: 0, user3: 0 } },
      });

      const socket = connectSocket(io, 'user3', 'ROOM1');
      getHandler(socket, 'disconnecting')();

      expect(gameService.cleanupGameLater).toHaveBeenCalledWith('ROOM1');
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
    });
  });

  describe('familiarization auto-start timeout callback', () => {
    // Trigger a leave_room forfeit that keeps the game familiarizing so that
    // scheduleFamiliarAutoStart is called.  Capture and return the timeout
    // callback registered with scheduleRoomTimeout so tests can fire it manually.
    function armFamiliarTimer(socket) {
      gameService.forfeitPlayer.mockReturnValueOnce({ ok: true, game: { status: 'familiarizing', scores: {} } });
      getHandler(socket, 'leave_room')({ roomCode: 'ROOM1' });
      const scheduleCall = gameService.scheduleRoomTimeout.mock.calls.find(([code]) => code === 'ROOM1');
      expect(scheduleCall).toBeDefined();
      return scheduleCall[1];
    }

    it('calls cleanupGameLater and does NOT schedule a turn timer when forceStartPlaying returns finished', () => {
      gameService.forceStartPlaying.mockReturnValue({
        ok: true,
        game: { status: 'finished', scores: { user1: 3, user2: 0 } },
      });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      const timeoutCb = armFamiliarTimer(socket);

      jest.clearAllMocks();

      timeoutCb();

      expect(gameService.clearRoomTimeout).toHaveBeenCalledWith('ROOM1');
      expect(gameService.cleanupGameLater).toHaveBeenCalledWith('ROOM1');
      // Turn timer must NOT be re-scheduled for a finished game.
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
    });

    it('schedules the turn timer when forceStartPlaying transitions to playing', () => {
      gameService.forceStartPlaying.mockReturnValue({
        ok: true,
        game: { status: 'playing', turnEndsAt: Date.now() + 20000 },
      });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      const timeoutCb = armFamiliarTimer(socket);

      jest.clearAllMocks();
      // getGame must return a playing game so scheduleTurnTimer does not bail early.
      gameService.getGame.mockReturnValue({ status: 'playing', turnEndsAt: Date.now() + 20000 });

      timeoutCb();

      expect(gameService.scheduleRoomTimeout).toHaveBeenCalledWith('ROOM1', expect.any(Function), expect.any(Number));
      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
    });

    it('does nothing when forceStartPlaying returns not-ok', () => {
      gameService.forceStartPlaying.mockReturnValue({ ok: false, error: 'No active game.' });

      const socket = connectSocket(io, 'user2', 'ROOM1');
      const timeoutCb = armFamiliarTimer(socket);

      jest.clearAllMocks();

      timeoutCb();

      expect(gameService.cleanupGameLater).not.toHaveBeenCalled();
      expect(gameService.scheduleRoomTimeout).not.toHaveBeenCalled();
    });
  });
});
