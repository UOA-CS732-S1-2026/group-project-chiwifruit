const crypto = require('crypto');

// NOTE (2026-04-27): Multiplayer game state is kept in-memory.
// Reason: the game is ephemeral and driven by socket events; persisting to Mongo
// would add complexity (cleanup, contention) without benefit for this project.

const TURN_MS = 20_000;
const FAMILIARIZE_AUTOPLAY_MS = 900;
const FAMILIARIZE_FREE_PLAY_MS = 20_000;
const GAME_TTL_MS = 10 * 60_000;

const gamesByRoom = new Map();
const timeoutsByRoom = new Map();

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

function getParticipantId(participant) {
  if (participant?.user?._id) return String(participant.user._id);
  if (participant?.user && typeof participant.user !== 'object') return String(participant.user);
  if (participant?.userId) return String(participant.userId);
  if (participant?.guestId) return String(participant.guestId);
  return null;
}

function createPlayerSnapshot(participant) {
  const userId = getParticipantId(participant);
  if (!userId) return null;

  const isGuest = Boolean(participant?.isGuest || participant?.guestId || !participant?.user);
  const fallbackName = isGuest ? 'Guest' : 'Player';

  return {
    userId,
    username: participant?.user?.username || participant?.username || participant?.guestName || fallbackName,
    avatarUrl: participant?.user?.avatarUrl || participant?.avatarUrl || null,
    isGuest,
    score: 0,
    isEliminated: false,
    eliminationReason: null,
    leftDuringGame: false,
  };
}

function serializePlayer(player) {
  return {
    userId: String(player.userId),
    username: player.username || 'Player',
    avatarUrl: player.avatarUrl || null,
    isGuest: Boolean(player.isGuest),
    score: Number(player.score) || 0,
    isEliminated: Boolean(player.isEliminated),
    eliminationReason: player.eliminationReason || null,
    leftDuringGame: Boolean(player.leftDuringGame),
  };
}

function getPlayers(game) {
  if (Array.isArray(game.players)) {
    return game.players;
  }

  // Backwards-compatible fallback for any in-memory game created before this code
  // was loaded. New games always use `players` as the authoritative snapshot.
  return game.participantsOrder.map((userId) => ({
    userId: String(userId),
    username: 'Player',
    avatarUrl: null,
    isGuest: false,
    score: Number(game.scores?.[String(userId)]) || 0,
    isEliminated: game.eliminatedUserIds?.has(String(userId)) || false,
    eliminationReason: null,
    leftDuringGame: false,
  }));
}

function getPlayer(game, userId) {
  const participantId = String(userId);
  return getPlayers(game).find((player) => String(player.userId) === participantId) || null;
}

function getScoresFromPlayers(game) {
  return Object.fromEntries(getPlayers(game).map((player) => [String(player.userId), Number(player.score) || 0]));
}

function getEliminatedUserIdsFromPlayers(game) {
  return getPlayers(game)
    .filter((player) => player.isEliminated)
    .map((player) => String(player.userId));
}

function getResultsFromPlayers(game) {
  return [...getPlayers(game)]
    .map(serializePlayer)
    .sort((a, b) => {
      const scoreDelta = Number(b.score) - Number(a.score);
      if (scoreDelta !== 0) return scoreDelta;
      if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
      return String(a.username).localeCompare(String(b.username));
    });
}

function markPlayerEliminated(game, userId, reason, { leftDuringGame = false } = {}) {
  const player = getPlayer(game, userId);
  if (!player) return false;

  player.isEliminated = true;
  player.eliminationReason = reason || 'eliminated';
  if (leftDuringGame) {
    player.leftDuringGame = true;
  }

  game.eliminatedUserIds.add(String(userId));
  return true;
}

function incrementPlayerScore(game, userId, amount = 1) {
  const player = getPlayer(game, userId);
  if (!player) return;

  player.score = (Number(player.score) || 0) + amount;
  game.scores = getScoresFromPlayers(game);
}

function serializeGame(game) {
  const players = getPlayers(game).map(serializePlayer);
  const participantsOrder = players.map((player) => String(player.userId));
  const scores = Object.fromEntries(players.map((player) => [player.userId, player.score]));
  const eliminatedUserIds = players.filter((player) => player.isEliminated).map((player) => player.userId);

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
    players,
    participantsOrder,
    familiarReadyUserIds: [...game.familiarReadyUserIds],
    sequence: game.sequence,
    currentTurnIndex: game.currentTurnIndex,
    currentTurnUserId: participantsOrder[game.currentTurnIndex] ?? null,
    inputIndex: game.inputIndex,
    turnEndsAt: game.turnEndsAt,
    eliminatedUserIds,
    scores,
    results: getResultsFromPlayers(game),
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
    .map(createPlayerSnapshot)
    .filter(Boolean);
  const participantsOrder = players.map((player) => String(player.userId));

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
    mode: room.mode || 'bird',
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
      const player = getPlayer(game, id);
      if (player && !player.isEliminated) return index;
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
  const eliminatedUserIds = new Set(getEliminatedUserIdsFromPlayers(game));
  return game.participantsOrder.filter((id) => !eliminatedUserIds.has(String(id)));
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
  if (!getPlayer(game, participantId)) {
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
  if (!getPlayer(game, participantId)) {
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
  const alive = getAliveParticipantIds(game);
  if (alive.length <= 1) {
    game.status = 'finished';
    game.turnEndsAt = null;
    game.lastEvent = { type: 'game_finished', at: Date.now(), winnerUserId: alive[0] ?? null };
    return;
  }

  let nextIndex = game.currentTurnIndex;
  for (let i = 0; i < game.participantsOrder.length; i += 1) {
    nextIndex = (nextIndex + 1) % game.participantsOrder.length;
    const id = game.participantsOrder[nextIndex];
    const player = getPlayer(game, id);
    if (player && !player.isEliminated) {
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
    game.status = 'finished';
    game.turnEndsAt = null;
    game.lastEvent = { type: 'game_finished', at: Date.now(), winnerUserId: alive[0] ?? null };
    return true;
  }
  return false;
}

function forfeitPlayer({ roomCode, userId, reason }) {
  const game = getGame(roomCode);
  if (!game) return { ok: false, error: 'No active game.' };
  if (game.status === 'finished') return { ok: true, game: serializeGame(game) };

  const participantId = String(userId);
  const player = getPlayer(game, participantId);
  if (!player) {
    return { ok: false, error: 'Not a game participant.' };
  }

  // Idempotent: already eliminated.
  if (player.isEliminated) {
    return { ok: true, game: serializeGame(game) };
  }

  const currentUserId = game.participantsOrder[game.currentTurnIndex];

  markPlayerEliminated(game, participantId, reason || 'left_game', { leftDuringGame: true });
  game.lastEvent = {
    type: 'player_eliminated',
    at: Date.now(),
    userId: participantId,
    reason: reason || 'left_game',
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

  const currentPlayer = getPlayer(game, currentUserId);
  if (!currentPlayer || currentPlayer.isEliminated) {
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
      markPlayerEliminated(game, currentUserId, 'wrong_note');
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

    incrementPlayerScore(game, currentUserId, 1);
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
