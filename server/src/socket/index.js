const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Room = require('../models/Room');
const { normalizeRoomParticipants, removeParticipantFromRoom } = require('../services/roomStateService');
const {
  TURN_MS,
  getGame,
  startGame,
  markFamiliarReady,
  setFamiliarAutoDuration,
  forceStartPlaying,
  forfeitPlayer,
  registerFamiliarPadPress,
  getFamiliarizeEndsAt,
  serializeGame,
  registerPadPress,
  registerTurnTimeout,
  clearRoomTimeout,
  scheduleRoomTimeout,
  removeGame,
  cleanupGameLater,
} = require('../services/gameService');

const WAITING_ROOM_DISCONNECT_GRACE_MS = 10_000;
const pendingRoomRosterCleanupTimers = new Map();

function getRoomRosterCleanupKey(roomCode, userId) {
  return `${String(roomCode).toUpperCase()}::${String(userId)}`;
}

function cancelPendingRoomRosterCleanup(roomCode, userId) {
  if (!roomCode || !userId) return;

  const cleanupKey = getRoomRosterCleanupKey(roomCode, userId);
  const pendingTimer = pendingRoomRosterCleanupTimers.get(cleanupKey);
  if (!pendingTimer) return;

  clearTimeout(pendingTimer);
  pendingRoomRosterCleanupTimers.delete(cleanupKey);
}

function initSocket(httpServer, frontendOrigin) {
  const io = new Server(httpServer, {
    cors: {
      origin: frontendOrigin || '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    }
  });

  function schedulePendingRoomRosterCleanup(roomCode, identity) {
    const userId = identity?.sub;
    if (!roomCode || !userId) return;

    const normalizedRoomCode = String(roomCode).toUpperCase();
    const cleanupKey = getRoomRosterCleanupKey(normalizedRoomCode, userId);
    cancelPendingRoomRosterCleanup(normalizedRoomCode, userId);

    const pendingTimer = setTimeout(() => {
      pendingRoomRosterCleanupTimers.delete(cleanupKey);

      void removeParticipantFromRoom({
        roomCode: normalizedRoomCode,
        identity,
      })
        .then((removal) => {
          if (removal?.ok) {
            if (removal.deleted) {
              removeGame(normalizedRoomCode);
            }
            emitRoomUpdate(io, normalizedRoomCode, removal.roomState ?? null);
          }
        })
        .catch(() => {
          // best-effort room cleanup
        });
    }, WAITING_ROOM_DISCONNECT_GRACE_MS);

    if (typeof pendingTimer.unref === 'function') {
      pendingTimer.unref();
    }

    pendingRoomRosterCleanupTimers.set(cleanupKey, pendingTimer);
  }

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
      if (forced.game.status === 'finished') {
        clearRoomTimeout(roomCode);
        persistFinalScores(roomCode, forced.game.scores);
        cleanupGameLater(roomCode);
        return;
      }
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
    async function handleForfeitInRoom(roomCode, reason) {
      const code = String(roomCode).toUpperCase();
      const userId = socket.user?.sub;
      if (!userId) return;
      const existingGame = getGame(code);
      const shouldCleanupRoomRoster = reason === 'disconnect' || reason === 'leave_room';
      const hasActiveGame = Boolean(existingGame && existingGame.status !== 'finished');

      const result = forfeitPlayer({ roomCode: code, userId, reason });
      if (result.ok) {
        io.to(code).emit('game_state', result.game);

        // Reschedule timers immediately after the authoritative game update.
        clearRoomTimeout(code);
        if (result.game.status === 'playing') {
          scheduleTurnTimer(code);
        }
        if (result.game.status === 'familiarizing') {
          scheduleFamiliarAutoStart(code);
        }
        if (result.game.status === 'finished') {
          persistFinalScores(code, result.game.scores);
          cleanupGameLater(code);
        }
      } else if (existingGame && existingGame.status === 'finished') {
        cleanupGameLater(code);
      }

      if (shouldCleanupRoomRoster) {
        if (reason === 'disconnect' && !hasActiveGame) {
          schedulePendingRoomRosterCleanup(code, socket.user);
          return;
        }

        void removeParticipantFromRoom({
          roomCode: code,
          identity: socket.user,
        })
          .then((removal) => {
            if (removal?.ok) {
              if (removal.deleted) {
                removeGame(code);
              }
              emitRoomUpdate(io, code, removal.roomState ?? null);
            }
          })
          .catch(() => {
            // best-effort room cleanup
          });
      }
    }

    socket.on('join_room', (payload = {}) => {
      const { roomCode } = payload;
      if (!roomCode) {
        return;
      }

      const normalizedRoomCode = String(roomCode).toUpperCase();
      cancelPendingRoomRosterCleanup(normalizedRoomCode, socket.user?.sub);
      socket.join(normalizedRoomCode);
    });

    socket.on('leave_room', async (payload = {}) => {
      const { roomCode } = payload;
      if (!roomCode) {
        return;
      }

      // NOTE (2026-04-29): 本项目里 socket leave_room 的语义是“离开比赛=直接判负”。
      // 所以客户端只有在玩家明确退出比赛/关闭页面时才应该 emit 这个事件。
      // 仅仅想从房间 participants 列表里移除自己（回首页/离开等待房间）应调用 REST
      // DELETE /api/rooms/:roomCode，由后端更新 DB 并广播 room_update。
      await handleForfeitInRoom(roomCode, 'leave_room');

      socket.leave(String(roomCode).toUpperCase());
    });

    socket.on('disconnecting', () => {
      // Closing tab / network drop: treat as leaving the match.
      // Use `disconnecting` so joined rooms are still available before Socket.IO
      // removes this socket from them.
      try {
        for (const roomCode of socket.rooms) {
          if (roomCode === socket.id) continue;
          void handleForfeitInRoom(roomCode, 'disconnect');
        }
      } catch {
        // no-op
      }
    });

    socket.on('game_request_state', (payload = {}, ack) => {
      const { roomCode } = payload;
      if (!roomCode) {
        if (typeof ack === 'function') ack({ ok: false, errorCode: 'MISSING_ROOM_CODE', error: 'Missing room code.' });
        return;
      }

      const code = String(roomCode).toUpperCase();
      const internal = getGame(code);
      if (!internal) {
        if (typeof ack === 'function') ack({ ok: false, errorCode: 'NO_ACTIVE_GAME', error: 'No active game.' });
        return;
      }

      const userId = socket.user?.sub ? String(socket.user.sub) : null;
      const player = userId
        ? internal.players.find((candidate) => String(candidate.userId) === userId)
        : null;

      if (!player || player.leftDuringGame) {
        if (typeof ack === 'function') ack({ ok: false, errorCode: 'GAME_NOT_PARTICIPANT', error: 'You are no longer part of this game.' });
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

        if (normalizeRoomParticipants(room)) {
          await room.save();
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

        // NOTE (2026-05-03): Reset per-round room state at game start.
        // Reason: avoid stale readiness/scores carrying into the next round and
        // accidentally allowing immediate re-starts when players are still in-game.
        room.participants.forEach((p) => {
          const participantId = p.user?._id
            ? String(p.user._id)
            : p.guestId
              ? String(p.guestId)
              : null;

          if (participantId && hostId && participantId !== hostId) {
            p.isReady = false;
          }

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

    socket.on('game_familiar_timing', async (payload = {}, ack) => {
      const { roomCode, familiarAutoDurationMs } = payload;
      const userId = socket.user?.sub ? String(socket.user.sub) : null;

      if (!roomCode) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Missing room code.' });
        return;
      }

      const code = String(roomCode).toUpperCase();
      const internal = getGame(code);
      if (!internal) {
        if (typeof ack === 'function') ack({ ok: false, error: 'No active game.' });
        return;
      }

      if (!userId || !internal.participantsOrder.includes(userId)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Not a game participant.' });
        return;
      }

      const result = setFamiliarAutoDuration({ roomCode: code, familiarAutoDurationMs });
      if (!result.ok) {
        if (typeof ack === 'function') ack(result);
        return;
      }

      io.to(code).emit('game_state', result.game);
      clearRoomTimeout(code);
      scheduleFamiliarAutoStart(code);

      if (typeof ack === 'function') ack({ ok: true, game: result.game });
    });

    socket.on('game_familiar_pad_press', async (payload = {}) => {
      const { roomCode, padIndex } = payload;
      const userId = socket.user?.sub;

      if (!roomCode) return;
      const code = String(roomCode).toUpperCase();

      const result = registerFamiliarPadPress({ roomCode: code, userId, padIndex });
      if (!result.ok) return;

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
  emitRoomUpdate,
  cancelPendingRoomRosterCleanup,
};
