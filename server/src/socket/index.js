const { Server } = require('socket.io');

function initSocket(httpServer, frontendOrigin) {
  const io = new Server(httpServer, {
    cors: {
      origin: frontendOrigin || '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_room', (payload = {}) => {
      const { roomCode } = payload;
      if (!roomCode) {
        return;
      }

      socket.join(String(roomCode).toUpperCase());
    });

    socket.on('leave_room', (payload = {}) => {
      const { roomCode } = payload;
      if (!roomCode) {
        return;
      }

      socket.leave(String(roomCode).toUpperCase());
    });
  });

  return io;
}

function emitRoomUpdate(io, roomCode, roomState) {
  if (!io || !roomCode) {
    return;
  }

  io.to(String(roomCode).toUpperCase()).emit('room_update', roomState);
}

module.exports = {
  initSocket,
  emitRoomUpdate
};
