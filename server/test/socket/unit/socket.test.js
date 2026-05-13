const { Server } = require('socket.io');
const { initSocket, emitRoomUpdate, getScheduledFamiliarizeEndsAt } = require('../../../src/socket');

function mockSocketServer() {
  const io = {
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };

  Server.mockImplementation(() => io);
  return io;
}

// Unit scope: socket helper behaviour is verified with a mocked Socket.IO server.
describe('socket helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketServer();
  });

  describe('emitRoomUpdate', () => {
    it('should emit room_update to the upper-cased room code', () => {
      const emit = jest.fn();
      const to = jest.fn(() => ({ emit }));
      const io = { to };
      const roomState = { roomCode: 'ABC123', participantCount: 2 };

      emitRoomUpdate(io, 'abc123', roomState);

      expect(to).toHaveBeenCalledWith('ABC123');
      expect(emit).toHaveBeenCalledWith('room_update', roomState);
    });

    it('should do nothing when io or roomCode is missing', () => {
      const io = { to: jest.fn() };

      expect(() => emitRoomUpdate(null, 'abc123', {})).not.toThrow();
      expect(() => emitRoomUpdate(io, '', {})).not.toThrow();
      expect(io.to).not.toHaveBeenCalled();
    });
  });

  describe('initSocket', () => {
    it('should create a Socket.IO server with the configured CORS origin', () => {
      const io = initSocket({}, 'http://localhost:5173');

      expect(Server).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: 'http://localhost:5173',
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          }),
        })
      );
      expect(io.use).toHaveBeenCalledTimes(1);
      expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should fall back to wildcard CORS origin when none is provided', () => {
      initSocket({});

      expect(Server).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          cors: expect.objectContaining({ origin: '*' }),
        })
      );
    });
  });

  describe('getScheduledFamiliarizeEndsAt', () => {
    it('should use the real familiar finish anchor when familiarAutoFinishedAt exists', () => {
      expect(getScheduledFamiliarizeEndsAt({ familiarAutoFinishedAt: 14_750 })).toBe(14_750 + 20_000);
    });

    it('should fall back to a widened familiar timeout when no real finish anchor was reported', () => {
      const game = {
        startedAt: 10_000,
        familiarAutoStartedAt: null,
        familiarAutoDurationMs: null,
        padCount: 6,
      };

      expect(getScheduledFamiliarizeEndsAt(game)).toBe(10_000 + 500 + (6 * 1_000) + 15_000 + 20_000);
    });

    it('should use the autoplay start time as the base once autoplay has started', () => {
      const game = {
        startedAt: 10_000,
        familiarAutoStartedAt: 12_500,
        familiarAutoFinishedAt: null,
        familiarAutoDurationMs: 4_500,
        padCount: 6,
      };

      expect(getScheduledFamiliarizeEndsAt(game)).toBe(12_500 + 4_500 + 15_000 + 20_000);
    });
  });
});
