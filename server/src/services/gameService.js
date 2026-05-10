const crypto = require('crypto');
const { buildAvatarUrl } = require('../controllers/authController');

// NOTE (2026-04-27): Multiplayer game state is kept in-memory.
// Reason: the game is ephemeral and driven by socket events; persisting to Mongo
// would add complexity (cleanup, contention) without benefit for this project.

const TURN_MS = 20_000;
const FAMILIARIZE_AUTOPLAY_MS = 900;
const FAMILIARIZE_FREE_PLAY_MS = 20_000;
const GAME_TTL_MS = 10 * 60_000;

const gamesByRoom = new Map();
const timeoutsByRoom = new Map();

function normalizeRoomMode(mode) {
  if (mode === 'bird') return 'kiwi';
  if (mode === 'Kiwi') return 'kiwi';
  if (mode === 'Piano') return 'piano';
  return mode === 'piano' ? 'piano' : 'kiwi';
}

function getPadCountByDifficulty(difficulty) {
  if (difficulty === 'easy') return 6;
  if (difficulty === 'hard') return 10;
  return 8;
}

function clearRoomTimeout(roomCode) {
  const existing = timeoutsByRoom.get(roomCode);
  if (existing) {
    clearTimeout(existing);
  }
  timeoutsByRoom.delete(roomCode);
}

function scheduleRoomTimeout(roomCode, callback, ms) {
  clearRoomTimeout(roomCode);
  const id = setTimeout(callback, ms);
  timeoutsByRoom.set(roomCode, id);
}

function cleanupGameLater(roomCode) {
  scheduleRoomTimeout(roomCode, () => {
    gamesByRoom.delete(roomCode);
    timeoutsByRoom.delete(roomCode);
  }, GAME_TTL_MS);
}

function participantIdOf(participant) {
  return participant.user?._id ? String(participant.user._id) : participant.guestId ? String(participant.guestId) : null;
}

function buildPlayerSnapshot(participant, initialOrder) {
  const userId = participantIdOf(participant);
  return {
    userId,
    username: participant.user?.username || participant.guestName || 'Unknown Player',
    avatarUrl: buildAvatarUrl(userId || 'unknown'),
    isGuest: Boolean(participant.guestId),
    // NOTE: Each new game starts scoring from zero.
    // Do not carry over room participant historical `correctCount`.
    score: 0,
    isEliminated: false,
    eliminationReason: null,
    leftDuringGame: false,
    initialOrder,
    failureLength: 0,
  };
}

function getPlayerByUserId(game, userId) {
  return game.players.find((player) => String(player.userId) === String(userId)) ?? null;
}

function addScore(game, userId, amount) {
  const participantId = String(userId);
  const nextScore = (Number(game.scores[participantId]) || 0) + Number(amount || 0);
  game.scores[participantId] = nextScore;
  const player = getPlayerByUserId(game, participantId);
  if (player) player.score = nextScore;
}

function startNewRound(game) {
  game.roundStartAliveUserIds = getAliveParticipantIds(game);
  game.roundTurnTakenUserIds = new Set();
}

function applyRoundSurvivalBonus(game, { excludedUserId = null } = {}) {
  const aliveNow = getAliveParticipantIds(game);
  aliveNow.forEach((id) => {
    if (excludedUserId && String(id) === String(excludedUserId)) return;
    addScore(game, id, 5);
    game.completedSurvivalRounds[id] = (Number(game.completedSurvivalRounds[id]) || 0) + 1;
  });
}

function finalizeGame(game) {
  const alive = getAliveParticipantIds(game);
  const winnerUserId = alive[0] ?? null;
  if (winnerUserId) addScore(game, winnerUserId, 5);
  game.status = 'finished';
  game.turnEndsAt = null;
  game.lastEvent = { type: 'game_finished', at: Date.now(), winnerUserId };
  if (winnerUserId) {
    const winnerPlayer = getPlayerByUserId(game, winnerUserId);
    if (winnerPlayer) winnerPlayer.failureLength = 0;
  }
}

function markPlayerEliminated(game, userId, reason, { leftDuringGame = false, failureLength = null } = {}) {
  const participantId = String(userId);
  const player = getPlayerByUserId(game, participantId);

  if (player) {
    player.isEliminated = true;
    player.eliminationReason = reason;
    player.leftDuringGame = Boolean(leftDuringGame);
    player.failureLength = Number.isFinite(failureLength) ? failureLength : game.inputIndex;
  }

  game.eliminatedUserIds.add(participantId);

  // If a player is eliminated before taking their turn in the current round
  // (e.g. off-turn forfeit/disconnect), remove them from the round-start alive
  // set so round completion doesn't get permanently blocked.
  if (Array.isArray(game.roundStartAliveUserIds)) {
    game.roundStartAliveUserIds = game.roundStartAliveUserIds.filter((id) => String(id) !== participantId);
  }
  if (game.roundTurnTakenUserIds instanceof Set) {
    game.roundTurnTakenUserIds.delete(participantId);
  }
}

function serializeGame(game) {
  return {
    // NOTE (2026-04-28): `serverNow` and `startedAt` are included so clients can
    // synchronize the familiarization phases without relying on local timers.
    serverNow: Date.now(),
    startedAt: game.startedAt,
    roomCode: game.roomCode,
    gameId: game.gameId,
    status: game.status,
    mode: game.mode,
    difficulty: game.difficulty,
    padCount: game.padCount,
    audioSeed: game.audioSeed,
    players: game.players,
    participantsOrder: game.participantsOrder,
    familiarReadyUserIds: [...game.familiarReadyUserIds],
    sequence: game.sequence,
    currentTurnIndex: game.currentTurnIndex,
    currentTurnUserId: game.participantsOrder[game.currentTurnIndex] ?? null,
    inputIndex: game.inputIndex,
    roundNumber: game.roundNumber ?? null,
    firstRoundStarterUserId: game.firstRoundStarterUserId ?? null,
    turnEndsAt: game.turnEndsAt,
    eliminatedUserIds: [...game.eliminatedUserIds],
    scores: game.scores,
    lastEvent: game.lastEvent ?? null,
  };
}

function getGame(roomCode) {
  return gamesByRoom.get(String(roomCode).toUpperCase()) ?? null;
}

function startGame({ room, requestedByUserId }) {
  const roomCode = String(room.roomCode).toUpperCase();
  const hostId = room.host != null ? String(room.host) : null;
  if (!hostId || String(requestedByUserId) !== hostId) {
    return { ok: false, error: 'Only the host can start the game.' };
  }

  const players = room.participants
    .map((participant, index) => {
      const snapshot = buildPlayerSnapshot(participant, index + 1);
      return snapshot.userId ? snapshot : null;
    })
    .filter(Boolean);

  const participantsOrder = players.map((player) => player.userId);

  if (participantsOrder.length < 2) {
    return { ok: false, error: 'Need at least 2 participants to start.' };
  }

  const difficulty = room.difficulty || 'easy';
  const padCount = getPadCountByDifficulty(difficulty);

  const game = {
    roomCode,
    gameId: crypto.randomUUID(),
    status: 'familiarizing',
    startedAt: Date.now(),
    mode: normalizeRoomMode(room.mode),
    difficulty,
    padCount,
    // Clients use this seed to deterministically pick audio files.
    audioSeed: crypto.randomUUID(),
    players,
    participantsOrder,
    familiarReadyUserIds: [],
    scores: Object.fromEntries(participantsOrder.map((id) => [id, 0])),
    sequence: [],
    currentTurnIndex: 0,
    inputIndex: 0,
    eliminatedUserIds: new Set(),
    roundStartAliveUserIds: participantsOrder,
    roundTurnTakenUserIds: new Set(),
    completedSurvivalRounds: Object.fromEntries(participantsOrder.map((id) => [id, 0])),
    turnEndsAt: null,
    lastEvent: { type: 'game_familiarizing_started', at: Date.now(), by: String(requestedByUserId) },
  };

  gamesByRoom.set(roomCode, game);
  return { ok: true, game: serializeGame(game) };
}

function startPlaying(game) {
  game.familiarReadyUserIds = [];

  if (finishIfOnlyOneAlive(game)) {
    return;
  }

  game.status = 'playing';

  // Pick the first alive participant to start.
  const firstAliveIndex = (() => {
    for (let index = 0; index < game.participantsOrder.length; index += 1) {
      const id = game.participantsOrder[index];
      if (!game.eliminatedUserIds.has(String(id))) return index;
    }
    return -1;
  })();

  if (firstAliveIndex === -1) {
    game.status = 'finished';
    game.turnEndsAt = null;
    game.lastEvent = { type: 'game_finished', at: Date.now(), winnerUserId: null };
    return;
  }

  game.currentTurnIndex = firstAliveIndex;
  game.inputIndex = 0;
  game.roundNumber = 1;
  game.firstRoundStarterUserId = game.participantsOrder[firstAliveIndex] ?? null;
  startNewRound(game);
  game.turnEndsAt = Date.now() + TURN_MS;
  game.lastEvent = { type: 'game_started', at: Date.now() };
}

function forceStartPlaying({ roomCode, reason }) {
  const game = getGame(roomCode);
  if (!game) return { ok: false, error: 'No active game.' };
  if (game.status === 'playing' || game.status === 'finished') {
    return { ok: true, game: serializeGame(game) };
  }

  startPlaying(game);
  if (game.status === 'playing') {
    game.lastEvent = { type: 'game_started', at: Date.now(), reason: reason || 'familiar_timeout' };
  }
  return { ok: true, game: serializeGame(game) };
}

function getFamiliarizeEndsAt(game) {
  return Number(game.startedAt) + Number(game.padCount) * FAMILIARIZE_AUTOPLAY_MS + FAMILIARIZE_FREE_PLAY_MS;
}

function getAliveParticipantIds(game) {
  return game.participantsOrder.filter((id) => !game.eliminatedUserIds.has(String(id)));
}

function isParticipantReady(game, userId) {
  return game.familiarReadyUserIds.includes(String(userId));
}

function markFamiliarReady({ roomCode, userId }) {
  const game = getGame(roomCode);
  if (!game) return { ok: false, error: 'No active game.' };
  if (game.status === 'finished' || game.status === 'playing') {
    return { ok: false, error: 'Game already started.' };
  }

  const participantId = String(userId);
  if (!game.participantsOrder.includes(participantId)) {
    return { ok: false, error: 'Not a game participant.' };
  }

  if (!game.familiarReadyUserIds.includes(participantId)) {
    game.familiarReadyUserIds.push(participantId);
  }

  const aliveParticipantIds = getAliveParticipantIds(game);
  const allReady = aliveParticipantIds.length > 0 && aliveParticipantIds.every((id) => game.familiarReadyUserIds.includes(id));
  if (allReady) {
    startPlaying(game);
  } else {
    game.lastEvent = {
      type: 'player_ready',
      at: Date.now(),
      userId: participantId,
    };
  }

  return { ok: true, game: serializeGame(game) };
}

function registerFamiliarPadPress({ roomCode, userId, padIndex }) {
  const game = getGame(roomCode);
  if (!game) return { ok: false, error: 'No active game.' };
  if (game.status === 'playing') return { ok: false, error: 'Game already started.' };

  const participantId = String(userId);
  if (!game.participantsOrder.includes(participantId)) {
    return { ok: false, error: 'Not a game participant.' };
  }

  if (isParticipantReady(game, participantId)) {
    return { ok: false, error: 'Player is waiting for the game to start.' };
  }

  const index = Number(padIndex);
  if (!Number.isInteger(index) || index < 0 || index >= game.padCount) {
    return { ok: false, error: 'Invalid pad index.' };
  }

  game.lastEvent = { type: 'familiar_pad_pressed', at: Date.now(), userId: participantId, padIndex: index };
  return { ok: true, game: serializeGame(game) };
}

function endTurnAdvance(game) {
  const currentUserId = game.participantsOrder[game.currentTurnIndex];
  if (currentUserId && game.roundStartAliveUserIds.includes(currentUserId)) {
    game.roundTurnTakenUserIds.add(String(currentUserId));
  }

  if (
    game.roundStartAliveUserIds.length > 0 &&
    game.roundTurnTakenUserIds.size >= game.roundStartAliveUserIds.length
  ) {
    const excludedUserId = game.roundNumber === 1 ? game.firstRoundStarterUserId : null;
    applyRoundSurvivalBonus(game, { excludedUserId });
    game.roundNumber += 1;
    startNewRound(game);
  }

  const alive = getAliveParticipantIds(game);
  if (alive.length <= 1) {
    finalizeGame(game);
    return;
  }

  let nextIndex = game.currentTurnIndex;
  for (let i = 0; i < game.participantsOrder.length; i += 1) {
    nextIndex = (nextIndex + 1) % game.participantsOrder.length;
    const id = game.participantsOrder[nextIndex];
    if (!game.eliminatedUserIds.has(id)) {
      game.currentTurnIndex = nextIndex;
      game.inputIndex = 0;
      game.turnEndsAt = Date.now() + TURN_MS;
      return;
    }
  }
}

function finishIfOnlyOneAlive(game) {
  const alive = getAliveParticipantIds(game);
  if (alive.length <= 1) {
    finalizeGame(game);
    return true;
  }
  return false;
}

function forfeitPlayer({ roomCode, userId, reason }) {
  const game = getGame(roomCode);
  if (!game) return { ok: false, error: 'No active game.' };
  if (game.status === 'finished') return { ok: true, game: serializeGame(game) };

  const participantId = String(userId);
  if (!game.participantsOrder.includes(participantId)) {
    return { ok: false, error: 'Not a game participant.' };
  }

  const player = getPlayerByUserId(game, participantId);
  if (!player) {
    return { ok: false, error: 'Not a game participant.' };
  }

  // Idempotent: already eliminated or already left.
  if (game.eliminatedUserIds.has(participantId) || player.isEliminated || player.leftDuringGame) {
    return { ok: true, game: serializeGame(game) };
  }

  const currentUserId = game.participantsOrder[game.currentTurnIndex];
  const normalizedReason = reason || 'left_game';
  const leftDuringGame = ['disconnect', 'leave_room', 'left_game'].includes(normalizedReason);

  markPlayerEliminated(game, participantId, normalizedReason, { leftDuringGame });
  game.lastEvent = {
    type: 'player_eliminated',
    at: Date.now(),
    userId: participantId,
    reason: normalizedReason,
  };

  if (finishIfOnlyOneAlive(game)) {
    return { ok: true, game: serializeGame(game) };
  }

  if (game.status === 'playing' && String(currentUserId) === participantId) {
    endTurnAdvance(game);
  }

  return { ok: true, game: serializeGame(game) };
}

function registerPadPress({ roomCode, userId, padIndex }) {
  const game = getGame(roomCode);
  if (!game) return { ok: false, error: 'No active game.' };
  if (game.status !== 'playing') return { ok: false, error: 'Game is not active.' };

  const currentUserId = game.participantsOrder[game.currentTurnIndex];
  if (!currentUserId || String(userId) !== String(currentUserId)) {
    return { ok: false, error: 'Not your turn.' };
  }

  const index = Number(padIndex);
  if (!Number.isInteger(index) || index < 0 || index >= game.padCount) {
    return { ok: false, error: 'Invalid pad index.' };
  }

  // If we are still repeating the existing sequence, validate input.
  if (game.inputIndex < game.sequence.length) {
    const expected = game.sequence[game.inputIndex];
    if (index !== expected) {
      markPlayerEliminated(game, currentUserId, 'wrong_note', { failureLength: game.inputIndex + 1 });
      game.lastEvent = {
        type: 'player_eliminated',
        at: Date.now(),
        userId: currentUserId,
        reason: 'wrong_note',
        expected,
        received: index,
      };
      endTurnAdvance(game);
      return { ok: true, game: serializeGame(game) };
    }

    addScore(game, currentUserId, 1);
    game.inputIndex += 1;
    game.lastEvent = { type: 'note_ok', at: Date.now(), userId: currentUserId, padIndex: index };
    return { ok: true, game: serializeGame(game) };
  }

  // Otherwise this press is the "add a new note" step.
  game.sequence.push(index);
  game.lastEvent = { type: 'note_added', at: Date.now(), userId: currentUserId, padIndex: index };
  endTurnAdvance(game);
  return { ok: true, game: serializeGame(game) };
}

function registerTurnTimeout(roomCode) {
  const game = getGame(roomCode);
  if (!game || game.status !== 'playing') return null;

  const currentUserId = game.participantsOrder[game.currentTurnIndex];
  if (currentUserId) {
    markPlayerEliminated(game, currentUserId, 'timeout');
    game.lastEvent = {
      type: 'player_eliminated',
      at: Date.now(),
      userId: currentUserId,
      reason: 'timeout',
    };
  }

  endTurnAdvance(game);
  return serializeGame(game);
}

module.exports = {
  TURN_MS,
  FAMILIARIZE_AUTOPLAY_MS,
  FAMILIARIZE_FREE_PLAY_MS,
  getGame,
  startGame,
  markFamiliarReady,
  forceStartPlaying,
  getFamiliarizeEndsAt,
  forfeitPlayer,
  registerFamiliarPadPress,
  serializeGame,
  registerPadPress,
  registerTurnTimeout,
  clearRoomTimeout,
  scheduleRoomTimeout,
  cleanupGameLater,
};
