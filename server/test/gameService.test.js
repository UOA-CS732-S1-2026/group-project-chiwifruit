const gameService = require('../src/services/gameService');

function participant(id, username = id) {
  return {
    user: { _id: id, username },
    isReady: true,
    correctCount: 0,
  };
}

function room(overrides = {}) {
  return {
    roomCode: overrides.roomCode || `ROOM_${Math.random().toString(36).slice(2, 8)}`,
    host: overrides.host || 'user1',
    mode: overrides.mode || 'bird',
    difficulty: overrides.difficulty || 'easy',
    participants: overrides.participants || [participant('user1', 'Host'), participant('user2', 'Player Two')],
  };
}

function startPlayingGame(roomCode = 'PLAYING_ROOM') {
  const start = gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });
  expect(start.ok).toBe(true);

  let ready = gameService.markFamiliarReady({ roomCode, userId: 'user1' });
  expect(ready.ok).toBe(true);
  expect(ready.game.status).toBe('familiarizing');

  ready = gameService.markFamiliarReady({ roomCode, userId: 'user2' });
  expect(ready.ok).toBe(true);
  expect(ready.game.status).toBe('playing');

  return ready.game;
}

describe('gameService state machine', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('startGame', () => {
    it('should reject non-host start requests', () => {
      const result = gameService.startGame({ room: room({ roomCode: 'START_NON_HOST' }), requestedByUserId: 'user2' });

      expect(result).toMatchObject({ ok: false, error: 'Only the host can start the game.' });
    });

    it('should reject games with fewer than two participants', () => {
      const result = gameService.startGame({
        room: room({ roomCode: 'START_ONE_PLAYER', participants: [participant('user1', 'Host')] }),
        requestedByUserId: 'user1',
      });

      expect(result).toMatchObject({ ok: false, error: 'Need at least 2 participants to start.' });
    });

    it('should start a familiarizing game for the host', () => {
      const result = gameService.startGame({ room: room({ roomCode: 'START_OK', difficulty: 'hard' }), requestedByUserId: 'user1' });

      expect(result.ok).toBe(true);
      expect(result.game).toMatchObject({
        roomCode: 'START_OK',
        status: 'familiarizing',
        mode: 'bird',
        difficulty: 'hard',
        padCount: 10,
        participantsOrder: ['user1', 'user2'],
      });
      expect(result.game.scores).toEqual({ user1: 0, user2: 0 });
    });
  });

  describe('familiarization phase', () => {
    it('should keep game familiarizing until all players are ready', () => {
      const roomCode = 'FAMILIAR_ONE_READY';
      gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });

      const result = gameService.markFamiliarReady({ roomCode, userId: 'user1' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('familiarizing');
      expect(result.game.familiarReadyUserIds).toEqual(['user1']);
      expect(result.game.lastEvent).toMatchObject({ type: 'player_ready', userId: 'user1' });
    });

    it('should transition to playing when all players are familiar-ready', () => {
      const game = startPlayingGame('FAMILIAR_ALL_READY');

      expect(game.status).toBe('playing');
      expect(game.currentTurnUserId).toBe('user1');
      expect(game.inputIndex).toBe(0);
      expect(game.turnEndsAt).toBeGreaterThan(Date.now());
    });

    it('should reject familiar ready from non-participants', () => {
      const roomCode = 'FAMILIAR_NON_PARTICIPANT';
      gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });

      const result = gameService.markFamiliarReady({ roomCode, userId: 'outsider' });

      expect(result).toMatchObject({ ok: false, error: 'Not a game participant.' });
    });

    it('should allow familiar pad press before a player is ready', () => {
      const roomCode = 'FAMILIAR_PAD_PRESS';
      gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });

      const result = gameService.registerFamiliarPadPress({ roomCode, userId: 'user1', padIndex: 2 });

      expect(result.ok).toBe(true);
      expect(result.game.lastEvent).toMatchObject({ type: 'familiar_pad_pressed', userId: 'user1', padIndex: 2 });
    });

    it('should reject familiar pad press after the player is waiting ready', () => {
      const roomCode = 'FAMILIAR_READY_PAD_PRESS';
      gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });
      gameService.markFamiliarReady({ roomCode, userId: 'user1' });

      const result = gameService.registerFamiliarPadPress({ roomCode, userId: 'user1', padIndex: 2 });

      expect(result).toMatchObject({ ok: false, error: 'Player is waiting for the game to start.' });
    });

    it('should reject invalid familiar pad index', () => {
      const roomCode = 'FAMILIAR_INVALID_PAD';
      gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });

      const result = gameService.registerFamiliarPadPress({ roomCode, userId: 'user1', padIndex: 99 });

      expect(result).toMatchObject({ ok: false, error: 'Invalid pad index.' });
    });

    it('should force-start playing from familiarizing state', () => {
      const roomCode = 'FORCE_START';
      gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });

      const result = gameService.forceStartPlaying({ roomCode, reason: 'test_timeout' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('playing');
      expect(result.game.lastEvent).toMatchObject({ type: 'game_started', reason: 'test_timeout' });
    });
  });

  describe('playing phase pad input', () => {
    it('should reject pad press when there is no active game', () => {
      const result = gameService.registerPadPress({ roomCode: 'NO_GAME', userId: 'user1', padIndex: 0 });

      expect(result).toMatchObject({ ok: false, error: 'No active game.' });
    });

    it('should reject pad press before game is playing', () => {
      const roomCode = 'PAD_BEFORE_PLAYING';
      gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });

      const result = gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 0 });

      expect(result).toMatchObject({ ok: false, error: 'Game is not active.' });
    });

    it('should reject a pad press from a player who does not have the turn', () => {
      startPlayingGame('NOT_YOUR_TURN');

      const result = gameService.registerPadPress({ roomCode: 'NOT_YOUR_TURN', userId: 'user2', padIndex: 0 });

      expect(result).toMatchObject({ ok: false, error: 'Not your turn.' });
    });

    it('should reject invalid pad index during active play', () => {
      startPlayingGame('PLAY_INVALID_PAD');

      const result = gameService.registerPadPress({ roomCode: 'PLAY_INVALID_PAD', userId: 'user1', padIndex: 99 });

      expect(result).toMatchObject({ ok: false, error: 'Invalid pad index.' });
    });

    it('should add a new note and advance the turn', () => {
      const roomCode = 'ADD_NOTE';
      startPlayingGame(roomCode);

      const result = gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 3 });

      expect(result.ok).toBe(true);
      expect(result.game.sequence).toEqual([3]);
      expect(result.game.currentTurnUserId).toBe('user2');
      expect(result.game.lastEvent).toMatchObject({ type: 'note_added', userId: 'user1', padIndex: 3 });
    });

    it('should accept correct replay input and increment score', () => {
      const roomCode = 'CORRECT_REPLAY';
      startPlayingGame(roomCode);
      gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 3 });

      const result = gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 3 });

      expect(result.ok).toBe(true);
      expect(result.game.scores.user2).toBe(1);
      expect(result.game.inputIndex).toBe(1);
      expect(result.game.lastEvent).toMatchObject({ type: 'note_ok', userId: 'user2', padIndex: 3 });
    });

    it('should eliminate player on wrong replay input and finish when one player remains', () => {
      const roomCode = 'WRONG_REPLAY';
      startPlayingGame(roomCode);
      gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 3 });

      const result = gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 4 });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('finished');
      expect(result.game.eliminatedUserIds).toContain('user2');
      expect(result.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
    });
  });

  describe('timeout and forfeit', () => {
    it('should eliminate current player on turn timeout', () => {
      const roomCode = 'TURN_TIMEOUT';
      startPlayingGame(roomCode);

      const result = gameService.registerTurnTimeout(roomCode);

      expect(result.eliminatedUserIds).toContain('user1');
      expect(result.status).toBe('finished');
      expect(result.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user2' });
    });

    it('should forfeit a player and finish when only one player remains', () => {
      const roomCode = 'FORFEIT_PLAYER';
      startPlayingGame(roomCode);

      const result = gameService.forfeitPlayer({ roomCode, userId: 'user2', reason: 'leave_room' });

      expect(result.ok).toBe(true);
      expect(result.game.eliminatedUserIds).toContain('user2');
      expect(result.game.lastEvent).toMatchObject({ type: 'player_eliminated', userId: 'user2', reason: 'leave_room' });
    });

    it('should reject forfeit from non-participants', () => {
      const roomCode = 'FORFEIT_OUTSIDER';
      startPlayingGame(roomCode);

      const result = gameService.forfeitPlayer({ roomCode, userId: 'outsider', reason: 'leave_room' });

      expect(result).toMatchObject({ ok: false, error: 'Not a game participant.' });
    });
  });

  describe('timers', () => {
    it('should schedule and clear room timeout callbacks', () => {
      jest.useFakeTimers();
      const callback = jest.fn();

      gameService.scheduleRoomTimeout('TIMER_ROOM', callback, 1000);
      jest.advanceTimersByTime(999);
      expect(callback).not.toHaveBeenCalled();

      gameService.clearRoomTimeout('TIMER_ROOM');
      jest.advanceTimersByTime(1);
      expect(callback).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});