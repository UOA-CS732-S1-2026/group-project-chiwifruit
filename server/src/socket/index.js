const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Room = require('../models/Room');
const {
  TURN_MS,
  getGame,
  startGame,
  markFamiliarReady,
  forceStartPlaying,
  forfeitPlayer,
  getFamiliarizeEndsAt,
  serializeGame,
  registerPadPress,
  registerTurnTimeout,
  clearRoomTimeout,
  scheduleRoomTimeout,
  cleanupGameLater,
} = require('../services/gameService');
const { removeIdentityFromRoom } = require('../services/roomMembershipService');

function initSocket(httpServer, frontendOrigin) {
  const io = new Server(httpServer, {
    cors: {
      origin: frontendOrigin || '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    }
  });

  async function persistFinalScores(roomCode, scores) {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return;

      room.participants.forEach((p) => {
        const participantId = p.user ? String(p.user) : p.guestId ? String(p.guestId) : null;
        if (!participantId) return;
        p.correctCount = Number(scores?.[participantId]) || 0;
      });

      await room.save();
    } catch {
      // best-effort persistence
    }
  }

  function scheduleTurnTimer(roomCode) {
    const internal = getGame(roomCode);
    if (!internal) return;
    if (internal.status !== 'playing') return;
    if (!internal.turnEndsAt) return;

    const ms = Math.max(0, Number(internal.turnEndsAt) - Date.now());
    scheduleRoomTimeout(roomCode, () => {
      const updated = registerTurnTimeout(roomCode);
      if (!updated) return;
      io.to(roomCode).emit('game_state', updated);

      if (updated.status === 'finished') {
        clearRoomTimeout(roomCode);
        persistFinalScores(roomCode, updated.scores);
        cleanupGameLater(roomCode);
        return;
      }

      scheduleTurnTimer(roomCode);
    }, ms || TURN_MS);
  }

  function scheduleFamiliarAutoStart(roomCode) {
    const internal = getGame(roomCode);
    if (!internal) return;
    if (internal.status !== 'familiarizing') return;

    const endsAt = getFamiliarizeEndsAt(internal);
    const ms = Math.max(0, Number(endsAt) - Date.now());

    scheduleRoomTimeout(roomCode, () => {
      const forced = forceStartPlaying({ roomCode, reason: 'familiar_timeout' });
      if (!forced.ok) return;

      io.to(roomCode).emit('game_state', forced.game);
      if (forced.game.status === 'playing') {
        scheduleTurnTimer(roomCode);
        return;
      }
      if (forced.game.status === 'finished') {
        clearRoomTimeout(roomCode);
        persistFinalScores(roomCode, forced.game.scores);
        cleanupGameLater(roomCode);
      }
    }, ms);
  }

  io.use((socket, next) => {
    const token = socket.handshake?.auth?.token;
    if (!token) return next(new Error('Missing bearer token'));

    try {
      const payload = jwt.verify(String(token), env.jwtSecret);
      socket.user = payload;
      return next();
    } catch (error) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    function handleForfeitInRoom(roomCode, reason) {
      const code = String(roomCode).toUpperCase();
      const userId = socket.user?.sub;
      if (!userId) return null;

      const result = forfeitPlayer({ roomCode: code, userId, reason });
      if (!result.ok) return null;

      io.to(code).emit('game_state', result.game);
      clearRoomTimeout(code);

      if (result.game.status === 'playing') {
        scheduleTurnTimer(code);
      }
      if (result.game.status === 'finished') {
        persistFinalScores(code, result.game.scores);
        cleanupGameLater(code);
      }

      return result.game;
    }

    async function handleDisconnectRoom(roomCode) {
      const code = String(roomCode).toUpperCase();
      const userId = socket.user?.sub;
      if (!userId || !code) return;

      // Confirmed MVP rule: refresh / browser close / network disconnect means
      // leaving the room. This also forfeits any active game in that room.
      handleForfeitInRoom(code, 'disconnect');
      await removeIdentityFromRoom({ identity: socket.user, roomCode: code, io });
    }

    socket.on('join_room', (payload = {}) => {
      const { roomCode } = payload;
      if (!roomCode) return;
      socket.join(String(roomCode).toUpperCase());
    });

    socket.on('leave_room', (payload = {}) => {
      const { roomCode } = payload;
      if (!roomCode) return;

      // Explicit in-game exit means forfeit the current match, but does not remove
      // the player from the waiting-room roster. Back Home / tab close handle room cleanup.
      handleForfeitInRoom(roomCode, 'leave_room');
      socket.leave(String(roomCode).toUpperCase());
    });

    socket.on('disconnecting', () => {
      const joinedRooms = [...socket.rooms].filter((roomCode) => roomCode !== socket.id);
      joinedRooms.forEach((roomCode) => {
        handleDisconnectRoom(roomCode).catch(() => null);
      });
    });

    socket.on('game_request_state', (payload = {}, ack) => {
      const { roomCode } = payload;
      if (!roomCode) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Missing room code.' });
        return;
      }

      const internal = getGame(roomCode);
      if (!internal) {
        if (typeof ack === 'function') ack({ ok: false, error: 'No active game.' });
        return;
      }

      if (typeof ack === 'function') ack({ ok: true, game: serializeGame(internal) });
    });

    socket.on('game_start', async (payload = {}, ack) => {
      const { roomCode } = payload;
      const userId = socket.user?.sub;

      if (!roomCode) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Missing room code.' });
        return;
      }

      try {
        const code = String(roomCode).toUpperCase();
        const existing = getGame(code);
        if (existing && existing.status !== 'finished') {
          const snapshot = serializeGame(existing);
          io.to(code).emit('game_state', snapshot);
          if (typeof ack === 'function') ack({ ok: false, error: 'Game already in progress.', game: snapshot });
          return;
        }

        const room = await Room.findOne({ roomCode: code }).populate('participants.user', 'username');
        if (!room) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Room not found.' });
          return;
        }

        const hostId = room.host != null ? String(room.host) : null;
        const nonHostParticipants = room.participants.filter((participant) => {
          const participantId = participant.user?._id ? String(participant.user._id) : participant.guestId ? String(participant.guestId) : null;
          if (!participantId) return true;
          if (!hostId) return true;
          return participantId !== hostId;
        });

        const everyoneReady = nonHostParticipants.length > 0 && nonHostParticipants.every((p) => p.isReady);
        if (!everyoneReady) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Not everyone is ready.' });
          return;
        }

        room.participants.forEach((p) => {
          const participantId = p.user?._id ? String(p.user._id) : p.guestId ? String(p.guestId) : null;
          if (participantId && hostId && participantId !== hostId) p.isReady = false;
          p.correctCount = 0;
        });
        await room.save();

        const result = startGame({ room, requestedByUserId: userId });
        if (!result.ok) {
          if (typeof ack === 'function') ack(result);
          return;
        }

        io.to(code).emit('game_state', result.game);
        if (typeof ack === 'function') ack({ ok: true, game: result.game });
        scheduleFamiliarAutoStart(code);
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, error: error.message });
      }
    });

    socket.on('game_familiar_ready', async (payload = {}, ack) => {
      const { roomCode } = payload;
      const userId = socket.user?.sub;
      if (!roomCode) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Missing room code.' });
        return;
      }

      const code = String(roomCode).toUpperCase();
      const result = markFamiliarReady({ roomCode: code, userId });
      if (!result.ok) {
        if (typeof ack === 'function') ack(result);
        return;
      }

      io.to(code).emit('game_state', result.game);
      if (typeof ack === 'function') ack({ ok: true, game: result.game });

      if (result.game.status === 'playing') scheduleTurnTimer(code);
      if (result.game.status === 'finished') {
        clearRoomTimeout(code);
        persistFinalScores(code, result.game.scores);
        cleanupGameLater(code);
      }
    });

    socket.on('game_pad_press', async (payload = {}) => {
      const { roomCode, padIndex } = payload;
      const userId = socket.user?.sub;
      if (!roomCode) return;
      const code = String(roomCode).toUpperCase();

      const result = registerPadPress({ roomCode: code, userId, padIndex });
      if (!result.ok) {
        socket.emit('game_error', { message: result.error });
        return;
      }

      socket.to(code).emit('game_pad_sound', { roomCode: code, padIndex: Number(padIndex), userId: String(userId) });
      io.to(code).emit('game_state', result.game);

      clearRoomTimeout(code);
      if (result.game.status === 'finished') {
        persistFinalScores(code, result.game.scores);
        cleanupGameLater(code);
        return;
      }
      scheduleTurnTimer(code);
    });
  });

  return io;
}

function emitRoomUpdate(io, roomCode, roomState) {
  if (!io || !roomCode) return;
  io.to(String(roomCode).toUpperCase()).emit('room_update', roomState);
}

module.exports = { initSocket, emitRoomUpdate };
