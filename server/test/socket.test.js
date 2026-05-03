const { Server } = require('socket.io');
const { initSocket, emitRoomUpdate } = require('../src/socket');

function mockSocketServer() {
  const io = {
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  };

  Server.mockImplementation(() => io);
  return io;
}

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

    it('should do nothing when io is missing', () => {
      expect(() => emitRoomUpdate(null, 'abc123', {})).not.toThrow();
    });

    it('should do nothing when roomCode is missing', () => {
      const io = { to: jest.fn() };

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
});