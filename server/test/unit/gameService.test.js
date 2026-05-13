const gameService = require('../../src/services/gameService');

let roomSequence = 0;
const roomsStartedInTest = new Set();

function participant(id, username = id, overrides = {}) {
  return {
    user: { _id: id, username },
    isReady: true,
    correctCount: 0,
    ...overrides,
  };
}

function guestParticipant(id, username = id, overrides = {}) {
  return {
    guestId: id,
    guestName: username,
    isReady: true,
    correctCount: 0,
    ...overrides,
  };
}

function makeRoom(overrides = {}) {
  roomSequence += 1;
  const roomCode = overrides.roomCode || `UNIT_ROOM_${roomSequence}`;
  roomsStartedInTest.add(String(roomCode).toUpperCase());

  return {
    roomCode,
    host: overrides.host ?? 'user1',
    mode: Object.prototype.hasOwnProperty.call(overrides, 'mode') ? overrides.mode : 'bird',
    difficulty: Object.prototype.hasOwnProperty.call(overrides, 'difficulty') ? overrides.difficulty : 'easy',
    participants: overrides.participants || [participant('user1', 'Host'), participant('user2', 'Player Two')],
  };
}

function startGame(overrides = {}, requestedByUserId = 'user1') {
  const result = gameService.startGame({ room: makeRoom(overrides), requestedByUserId });
  expect(result.ok).toBe(true);
  return result.game;
}

function readyAll(roomCode, userIds = ['user1', 'user2']) {
  let result;

  userIds.forEach((userId) => {
    result = gameService.markFamiliarReady({ roomCode, userId });
    expect(result.ok).toBe(true);
  });

  expect(result.game.status).toBe('playing');
  return result.game;
}

function startPlayingGame(overrides = {}) {
  const game = startGame(overrides);
  return readyAll(game.roomCode, game.participantsOrder);
}

function press(roomCode, userId, padIndex) {
  const result = gameService.registerPadPress({ roomCode, userId, padIndex });
  expect(result.ok).toBe(true);
  return result.game;
}

// Unit scope: exercise the in-memory game state machine without socket or database dependencies.
describe('gameService state machine', () => {
  afterEach(() => {
    roomsStartedInTest.forEach((roomCode) => gameService.removeGame(roomCode));
    roomsStartedInTest.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('startGame configuration', () => {
    it('should reject non-host and single-player start attempts', () => {
      expect(gameService.startGame({
        room: makeRoom({ roomCode: 'START_NON_HOST' }),
        requestedByUserId: 'user2',
      })).toMatchObject({
        ok: false,
        error: 'Only the host can start the game.',
      });

      expect(gameService.startGame({
        room: makeRoom({
          roomCode: 'START_ONE_PLAYER',
          participants: [participant('user1', 'Host')],
        }),
        requestedByUserId: 'user1',
      })).toMatchObject({
        ok: false,
        error: 'Need at least 2 participants to start.',
      });
    });

    it.each([
      ['easy', 6],
      ['medium', 8],
      ['hard', 10],
      [undefined, 6],
    ])('should map difficulty %s to pad count %s', (difficulty, padCount) => {
      const game = startGame({ difficulty });

      expect(game.difficulty).toBe(difficulty || 'easy');
      expect(game.padCount).toBe(padCount);
    });

    it.each([
      ['bird', 'bird'],
      ['piano', 'piano'],
      ['maori', 'maori'],
      ['animal', 'animal'],
      ['aussie', 'aussie'],
      ['  MAORI  ', 'maori'],
      ['unsupported-mode', 'bird'],
      [undefined, 'bird'],
    ])('should normalize mode %s to %s', (mode, expectedMode) => {
      const game = startGame({ mode });

      expect(game.mode).toBe(expectedMode);
    });

    it('should snapshot users and guests without mutating room participants or carrying historical score', () => {
      const activeRoom = makeRoom({
        roomCode: 'SNAPSHOT_ROOM',
        participants: [
          participant('user1', 'Host', { correctCount: 12 }),
          guestParticipant('guest-1', 'Guest One', { correctCount: 9 }),
        ],
      });
      const originalParticipants = JSON.parse(JSON.stringify(activeRoom.participants));

      const result = gameService.startGame({ room: activeRoom, requestedByUserId: 'user1' });

      expect(result.ok).toBe(true);
      expect(activeRoom.participants).toEqual(originalParticipants);
      expect(result.game.participantsOrder).toEqual(['user1', 'guest-1']);
      expect(result.game.players).toEqual([
        expect.objectContaining({ userId: 'user1', username: 'Host', isGuest: false, score: 0, initialOrder: 1 }),
        expect.objectContaining({ userId: 'guest-1', username: 'Guest One', isGuest: true, score: 0, initialOrder: 2 }),
      ]);
    });
  });

  describe('familiarization phase', () => {
    it('should track familiar audio readiness idempotently and start autoplay only after all alive players are ready', () => {
      const game = startGame({ roomCode: 'AUDIO_READY' });

      const outsider = gameService.markFamiliarAudioReady({ roomCode: game.roomCode, userId: 'outsider' });
      expect(outsider).toMatchObject({ ok: false, error: 'Not a game participant.' });

      const first = gameService.markFamiliarAudioReady({ roomCode: game.roomCode, userId: 'user1' });
      expect(first.game.familiarAudioReadyUserIds).toEqual(['user1']);
      expect(first.game.familiarAutoStartedAt).toBeNull();

      const duplicate = gameService.markFamiliarAudioReady({ roomCode: game.roomCode, userId: 'user1' });
      expect(duplicate.game.familiarAudioReadyUserIds).toEqual(['user1']);

      const second = gameService.markFamiliarAudioReady({ roomCode: game.roomCode, userId: 'user2' });
      expect(second.game.familiarAudioReadyUserIds).toEqual(['user1', 'user2']);
      expect(second.game.familiarAutoStartedAt).toEqual(expect.any(Number));
      expect(second.game.lastEvent).toMatchObject({ type: 'game_familiar_autoplay_started' });
    });

    it('should validate and retain the longest familiar autoplay duration', () => {
      const game = startGame({ roomCode: 'FAMILIAR_DURATION' });

      expect(gameService.setFamiliarAutoDuration({ roomCode: game.roomCode, familiarAutoDurationMs: -1 }))
        .toMatchObject({ ok: false, error: 'Invalid familiar auto duration.' });
      expect(gameService.setFamiliarAutoDuration({ roomCode: game.roomCode, familiarAutoDurationMs: Number.NaN }))
        .toMatchObject({ ok: false, error: 'Invalid familiar auto duration.' });

      gameService.setFamiliarAutoDuration({ roomCode: game.roomCode, familiarAutoDurationMs: 5000 });
      const shorter = gameService.setFamiliarAutoDuration({ roomCode: game.roomCode, familiarAutoDurationMs: 3000 });

      expect(shorter.ok).toBe(true);
      expect(shorter.game.familiarAutoDurationMs).toBe(5000);
    });

    it('should compute familiarize end time only after the real autoplay finish time is known', () => {
      const game = startGame({ roomCode: 'FAMILIAR_END_TIME' });

      gameService.setFamiliarAutoDuration({ roomCode: game.roomCode, familiarAutoDurationMs: 1000 });
      const started = gameService.setFamiliarAutoStarted({ roomCode: game.roomCode });
      expect(started.game.familiarAutoStartedAt).toEqual(expect.any(Number));
      expect(gameService.getFamiliarizeEndsAt(gameService.getGame(game.roomCode))).toBeNull();

      const finished = gameService.setFamiliarAutoFinished({ roomCode: game.roomCode });
      const internal = gameService.getGame(game.roomCode);

      expect(finished.game.familiarAutoFinishedAt).toEqual(expect.any(Number));
      expect(gameService.getFamiliarizeEndsAt(internal)).toBe(
        Number(internal.familiarAutoFinishedAt) + gameService.FAMILIARIZE_FREE_PLAY_MS,
      );
    });

    it('should allow free-play pads before ready, block pads after ready, and start when all alive players are ready', () => {
      const game = startGame({ roomCode: 'FAMILIAR_READY' });

      const familiarPad = gameService.registerFamiliarPadPress({ roomCode: game.roomCode, userId: 'user1', padIndex: 2 });
      expect(familiarPad.game.lastEvent).toMatchObject({ type: 'familiar_pad_pressed', userId: 'user1', padIndex: 2 });

      const firstReady = gameService.markFamiliarReady({ roomCode: game.roomCode, userId: 'user1' });
      expect(firstReady.game.status).toBe('familiarizing');
      expect(gameService.registerFamiliarPadPress({ roomCode: game.roomCode, userId: 'user1', padIndex: 2 }))
        .toMatchObject({ ok: false, error: 'Player is waiting for the game to start.' });

      const started = gameService.markFamiliarReady({ roomCode: game.roomCode, userId: 'user2' });
      expect(started.game.status).toBe('playing');
      expect(started.game.currentTurnUserId).toBe('user1');
      expect(started.game.roundNumber).toBe(1);
    });

    it('should finish or keep familiarizing correctly when players forfeit before play starts', () => {
      const twoPlayerGame = startGame({ roomCode: 'FAMILIAR_FORFEIT_FINISH' });
      const finish = gameService.forfeitPlayer({ roomCode: twoPlayerGame.roomCode, userId: 'user2', reason: 'disconnect' });
      expect(finish.game).toMatchObject({ status: 'finished' });
      expect(finish.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });

      const threePlayerGame = startGame({
        roomCode: 'FAMILIAR_FORFEIT_CONTINUE',
        participants: [participant('user1'), participant('user2'), participant('user3')],
      });
      const continueGame = gameService.forfeitPlayer({ roomCode: threePlayerGame.roomCode, userId: 'user3', reason: 'disconnect' });
      expect(continueGame.game.status).toBe('familiarizing');
      expect(continueGame.game.eliminatedUserIds).toContain('user3');

      const ready = readyAll(threePlayerGame.roomCode, ['user1', 'user2']);
      expect(ready.status).toBe('playing');
    });

    it('should force-start only when enough players remain alive', () => {
      const active = startGame({ roomCode: 'FORCE_START_OK' });
      const started = gameService.forceStartPlaying({ roomCode: active.roomCode, reason: 'test_timeout' });
      expect(started.game).toMatchObject({ status: 'playing' });
      expect(started.game.lastEvent).toMatchObject({ type: 'game_started', reason: 'test_timeout' });

      const onlyOneAlive = startGame({ roomCode: 'FORCE_START_ONE_ALIVE' });
      gameService.forfeitPlayer({ roomCode: onlyOneAlive.roomCode, userId: 'user2', reason: 'disconnect' });
      const finished = gameService.forceStartPlaying({ roomCode: onlyOneAlive.roomCode, reason: 'test_timeout' });
      expect(finished.game.status).toBe('finished');
    });
  });

  describe('playing phase', () => {
    it('should reject pad input for missing, inactive, off-turn, or invalid-pad states', () => {
      expect(gameService.registerPadPress({ roomCode: 'NO_GAME', userId: 'user1', padIndex: 0 }))
        .toMatchObject({ ok: false, error: 'No active game.' });

      const game = startGame({ roomCode: 'PAD_BEFORE_PLAYING' });
      expect(gameService.registerPadPress({ roomCode: game.roomCode, userId: 'user1', padIndex: 0 }))
        .toMatchObject({ ok: false, error: 'Game is not active.' });

      const playing = startPlayingGame({ roomCode: 'PAD_VALIDATION' });
      expect(gameService.registerPadPress({ roomCode: playing.roomCode, userId: 'user2', padIndex: 0 }))
        .toMatchObject({ ok: false, error: 'Not your turn.' });
      expect(gameService.registerPadPress({ roomCode: playing.roomCode, userId: 'user1', padIndex: 99 }))
        .toMatchObject({ ok: false, error: 'Invalid pad index.' });
    });

    it('should add notes, validate replay input, award replay points, and apply round survival bonus', () => {
      const game = startPlayingGame({ roomCode: 'SCORING_FLOW' });

      const firstAdd = press(game.roomCode, 'user1', 3);
      expect(firstAdd).toMatchObject({ sequence: [3], currentTurnUserId: 'user2' });
      expect(firstAdd.scores.user1).toBe(0);

      const replay = press(game.roomCode, 'user2', 3);
      expect(replay.scores.user2).toBe(1);
      expect(replay.lastEvent).toMatchObject({ type: 'note_ok', userId: 'user2' });

      const secondAdd = press(game.roomCode, 'user2', 4);
      expect(secondAdd.sequence).toEqual([3, 4]);
      expect(secondAdd.roundNumber).toBe(2);
      expect(secondAdd.scores).toMatchObject({ user1: 1, user2: 2 });
    });

    it('should eliminate wrong replay input and finish a two-player game with no fixed winner bonus', () => {
      const game = startPlayingGame({ roomCode: 'WRONG_REPLAY' });
      press(game.roomCode, 'user1', 3);

      const result = press(game.roomCode, 'user2', 4);

      expect(result.status).toBe('finished');
      expect(result.eliminatedUserIds).toContain('user2');
      expect(result.players.find((player) => player.userId === 'user2')).toMatchObject({
        isEliminated: true,
        eliminationReason: 'wrong_note',
        leftDuringGame: false,
        failureLength: 1,
      });
      expect(result.scores).toMatchObject({ user1: 1, user2: 0 });
      expect(result.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
    });

    it('should award final-round survival bonus when the opponent fails after the winner completed the round', () => {
      const game = startPlayingGame({ roomCode: 'FINAL_ROUND_BONUS' });

      press(game.roomCode, 'user1', 1);
      press(game.roomCode, 'user2', 1);
      press(game.roomCode, 'user2', 2);
      press(game.roomCode, 'user1', 1);
      press(game.roomCode, 'user1', 2);
      press(game.roomCode, 'user1', 3);
      press(game.roomCode, 'user2', 1);
      press(game.roomCode, 'user2', 2);
      const result = press(game.roomCode, 'user2', 4);

      expect(result.status).toBe('finished');
      expect(result.scores.user1).toBe(6);
      expect(result.scores.user2).toBe(4);
      expect(result.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
    });
  });

  describe('timeout, forfeit, and cleanup', () => {
    it('should eliminate the current player on timeout and return null for non-active timeouts', () => {
      expect(gameService.registerTurnTimeout('NO_SUCH_GAME')).toBeNull();

      const familiarizing = startGame({ roomCode: 'TIMEOUT_NOT_PLAYING' });
      expect(gameService.registerTurnTimeout(familiarizing.roomCode)).toBeNull();

      const playing = startPlayingGame({ roomCode: 'TURN_TIMEOUT' });
      const result = gameService.registerTurnTimeout(playing.roomCode);

      expect(result.status).toBe('finished');
      expect(result.eliminatedUserIds).toContain('user1');
      expect(result.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user2' });
    });

    it('should advance turn only when the current player forfeits and finish when one player remains', () => {
      const currentLeaves = startPlayingGame({ roomCode: 'CURRENT_FORFEIT_THREE', participants: [participant('user1'), participant('user2'), participant('user3')] });
      const advance = gameService.forfeitPlayer({ roomCode: currentLeaves.roomCode, userId: 'user1', reason: 'disconnect' });
      expect(advance.game.status).toBe('playing');
      expect(advance.game.currentTurnUserId).toBe('user2');

      const offTurnLeaves = startPlayingGame({ roomCode: 'OFF_TURN_FORFEIT_THREE', participants: [participant('user1'), participant('user2'), participant('user3')] });
      const stay = gameService.forfeitPlayer({ roomCode: offTurnLeaves.roomCode, userId: 'user3', reason: 'leave_room' });
      expect(stay.game.status).toBe('playing');
      expect(stay.game.currentTurnUserId).toBe('user1');
      expect(stay.game.players.find((player) => player.userId === 'user3')).toMatchObject({ leftDuringGame: true });

      const final = gameService.forfeitPlayer({ roomCode: offTurnLeaves.roomCode, userId: 'user2', reason: 'disconnect' });
      expect(final.game.status).toBe('finished');
      expect(final.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
    });

    it('should keep round completion moving after an off-turn player leaves', () => {
      const game = startPlayingGame({ roomCode: 'OFF_TURN_ROUND_PROGRESS', participants: [participant('user1'), participant('user2'), participant('user3')] });

      press(game.roomCode, 'user1', 1);
      gameService.forfeitPlayer({ roomCode: game.roomCode, userId: 'user3', reason: 'leave_room' });
      press(game.roomCode, 'user2', 1);
      const afterAdd = press(game.roomCode, 'user2', 2);

      expect(afterAdd.roundNumber).toBe(2);
      expect(afterAdd.currentTurnUserId).toBe('user1');
      expect(afterAdd.scores.user2).toBe(2);
    });

    it('should remove games and clear scheduled room cleanup by normalized room code', () => {
      jest.useFakeTimers();
      const game = startGame({ roomCode: 'MIXED_CASE_ROOM' });

      expect(gameService.getGame('mixed_case_room')).not.toBeNull();
      gameService.scheduleRoomTimeout('MIXED_CASE_ROOM', () => gameService.removeGame('MIXED_CASE_ROOM'), 1000);
      gameService.clearRoomTimeout('MIXED_CASE_ROOM');
      jest.advanceTimersByTime(1000);

      expect(gameService.getGame(game.roomCode)).not.toBeNull();
      gameService.removeGame('mixed_case_room');
      expect(gameService.getGame('MIXED_CASE_ROOM')).toBeNull();
    });
  });
});
