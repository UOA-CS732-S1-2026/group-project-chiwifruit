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
  registerFamiliarPadPress,
  getFamiliarizeEndsAt,
  serializeGame,
  registerPadPress,
  registerTurnTimeout,
  clearRoomTimeout,
  scheduleRoomTimeout,
  cleanupGameLater,
} = require('../services/gameService');

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
      }
    }, ms);
  }

  // NOTE (2026-04-27): Authenticate socket connections using the same JWT as REST.
  // Reason: game actions (start/press) must be attributed to a specific user and
  // should not be spoofable by anonymous clients.
  io.use((socket, next) => {
    const token = socket.handshake?.auth?.token;
    if (!token) {
      return next(new Error('Missing bearer token'));
    }

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
      if (!userId) return;

      const result = forfeitPlayer({ roomCode: code, userId, reason });
      if (!result.ok) return;

      io.to(code).emit('game_state', result.game);

      // Reschedule timers if needed.
      clearRoomTimeout(code);
      if (result.game.status === 'playing') {
        scheduleTurnTimer(code);
      }
      if (result.game.status === 'finished') {
        persistFinalScores(code, result.game.scores);
        cleanupGameLater(code);
      }
    }

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

      // NOTE (2026-04-29): 本项目里 socket leave_room 的语义是“离开比赛=直接判负”。
      // 所以客户端只有在玩家明确退出比赛/关闭页面时才应该 emit 这个事件。
      // 仅仅想从房间 participants 列表里移除自己（回首页/离开等待房间）应调用 REST
      // DELETE /api/rooms/:roomCode，由后端更新 DB 并广播 room_update。
      handleForfeitInRoom(roomCode, 'leave_room');

      socket.leave(String(roomCode).toUpperCase());
    });

    socket.on('disconnect', () => {
      // Closing tab / network drop: treat as leaving the match.
      // Forfeit in any joined game rooms (excluding the socket's private room).
      try {
        for (const roomCode of socket.rooms) {
          if (roomCode === socket.id) continue;
          handleForfeitInRoom(roomCode, 'disconnect');
        }
      } catch {
        // no-op
      }
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

    // If there is already an active game, do NOT start a new one.
    // This commonly happens when the host refreshes the page and the client
    // re-emits `game_start`.
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

        // NOTE (2026-04-27): Re-check readiness server-side before starting.
        // Reason: prevent clients from starting games when not everyone is ready.
        const hostId = room.host != null ? String(room.host) : null;
        const nonHostParticipants = room.participants.filter((participant) => {
          const participantId = participant.user?._id
            ? String(participant.user._id)
            : participant.guestId
              ? String(participant.guestId)
              : null;
          if (!participantId) return true;
          if (!hostId) return true;
          return participantId !== hostId;
        });

        const everyoneReady = nonHostParticipants.length > 0 && nonHostParticipants.every((p) => p.isReady);
        if (!everyoneReady) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Not everyone is ready.' });
          return;
        }

        // NOTE (2026-04-27): Reset scores at game start.
        // Reason: `participants.correctCount` is used for ranking/results; we want
        // a clean slate per game.
        room.participants.forEach((p) => {
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

      if (result.game.status === 'playing') {
        scheduleTurnTimer(code);
      }
    });

    socket.on('game_familiar_pad_press', async (payload = {}) => {
      const { roomCode, padIndex } = payload;
      const userId = socket.user?.sub;

      if (!roomCode) return;
      const code = String(roomCode).toUpperCase();

      const result = registerFamiliarPadPress({ roomCode: code, userId, padIndex });
      if (!result.ok) return;

      socket.to(code).emit('game_pad_sound', {
        roomCode: code,
        padIndex: Number(padIndex),
        userId: String(userId),
      });

      io.to(code).emit('game_state', result.game);

      if (result.game.status === 'playing') {
        scheduleTurnTimer(code);
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

      socket.to(code).emit('game_pad_sound', {
        roomCode: code,
        padIndex: Number(padIndex),
        userId: String(userId),
      });
      io.to(code).emit('game_state', result.game);

      // Reschedule timeout on any state change.
      clearRoomTimeout(code);

      if (result.game.status === 'finished') {
        // Persist final scores to Mongo for existing /ranking endpoint.
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
  if (!io || !roomCode) {
    return;
  }

  io.to(String(roomCode).toUpperCase()).emit('room_update', roomState);
}

module.exports = {
  initSocket,
  emitRoomUpdate
};
