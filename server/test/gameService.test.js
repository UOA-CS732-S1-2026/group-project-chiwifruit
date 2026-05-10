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
    mode: overrides.mode || 'kiwi',
    difficulty: overrides.difficulty || 'easy',
    participants: overrides.participants || [participant('user1', 'Host'), participant('user2', 'Player Two')],
  };
}

function startPlayingGame(roomCode = 'PLAYING_ROOM', participants = [participant('user1', 'Host'), participant('user2', 'Player Two')]) {
  const start = gameService.startGame({ room: room({ roomCode, participants }), requestedByUserId: 'user1' });
  expect(start.ok).toBe(true);

  let ready = gameService.markFamiliarReady({ roomCode, userId: 'user1' });
  expect(ready.ok).toBe(true);
  expect(ready.game.status).toBe('familiarizing');

  for (const gameParticipant of participants.slice(1)) {
    const userId = String(gameParticipant.user._id);
    ready = gameService.markFamiliarReady({ roomCode, userId });
    expect(ready.ok).toBe(true);
  }

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
        mode: 'kiwi',
        difficulty: 'hard',
        padCount: 10,
        participantsOrder: ['user1', 'user2'],
      });
      expect(result.game.scores).toEqual({ user1: 0, user2: 0 });
      expect(result.game.players).toEqual([
        expect.objectContaining({ userId: 'user1', username: 'Host', score: 0, isEliminated: false, leftDuringGame: false }),
        expect.objectContaining({ userId: 'user2', username: 'Player Two', score: 0, isEliminated: false, leftDuringGame: false }),
      ]);
    });

    it('should snapshot room participants into game.players without mutating room participants', () => {
      const roomCode = 'START_SNAPSHOT_ROOM';
      const activeRoom = room({ roomCode, participants: [participant('user1', 'Host'), participant('user2', 'Player Two')] });
      const originalParticipants = JSON.parse(JSON.stringify(activeRoom.participants));

      const result = gameService.startGame({ room: activeRoom, requestedByUserId: 'user1' });

      expect(result.ok).toBe(true);
      expect(activeRoom.participants).toEqual(originalParticipants);
      expect(result.game.players).toHaveLength(2);
      expect(result.game.players[0].userId).toBe('user1');
      expect(result.game.players[1].userId).toBe('user2');
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

    it('should finish when a familiarizing forfeit leaves only one player alive', () => {
      const roomCode = 'FAMILIAR_FORFEIT_FINISH';
      gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });

      const result = gameService.forfeitPlayer({ roomCode, userId: 'user2', reason: 'disconnect' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('finished');
      expect(result.game.turnEndsAt).toBeNull();
      expect(result.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
    });

    it('should stay familiarizing when a familiarizing forfeit still leaves multiple players alive', () => {
      const roomCode = 'FAMILIAR_FORFEIT_STAYS_OPEN';
      gameService.startGame({
        room: room({
          roomCode,
          participants: [
            participant('user1', 'Host'),
            participant('user2', 'Player Two'),
            participant('user3', 'Player Three'),
          ],
        }),
        requestedByUserId: 'user1',
      });

      const result = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('familiarizing');
      expect(result.game.eliminatedUserIds).toContain('user3');
      expect(result.game.players.find((p) => p.userId === 'user3')).toMatchObject({
        isEliminated: true,
        leftDuringGame: true,
        eliminationReason: 'disconnect',
      });
      expect(result.game.lastEvent).toMatchObject({ type: 'player_eliminated', userId: 'user3', reason: 'disconnect' });
    });

    it('should not mutate room participants when a player forfeits during familiarization', () => {
      const roomCode = 'FAMILIAR_FORFEIT_ROOM_INTACT';
      const activeRoom = room({
        roomCode,
        participants: [
          participant('user1', 'Host'),
          participant('user2', 'Player Two'),
          participant('user3', 'Player Three'),
        ],
      });
      const originalParticipants = JSON.parse(JSON.stringify(activeRoom.participants));

      gameService.startGame({ room: activeRoom, requestedByUserId: 'user1' });
      const result = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });

      expect(result.ok).toBe(true);
      expect(activeRoom.participants).toEqual(originalParticipants);
    });

    it('should not force-start into playing when only one player is alive', () => {
      const roomCode = 'FORCE_START_ONE_ALIVE';
      gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });
      gameService.forfeitPlayer({ roomCode, userId: 'user2', reason: 'disconnect' });

      const result = gameService.forceStartPlaying({ roomCode, reason: 'test_timeout' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('finished');
      expect(result.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
    });

    it('should start playing when all remaining alive players are familiar-ready', () => {
      const roomCode = 'FAMILIAR_READY_IGNORES_ELIMINATED';
      gameService.startGame({
        room: room({
          roomCode,
          participants: [
            participant('user1', 'Host'),
            participant('user2', 'Player Two'),
            participant('user3', 'Player Three'),
          ],
        }),
        requestedByUserId: 'user1',
      });

      const forfeit = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });
      expect(forfeit.game.status).toBe('familiarizing');

      let ready = gameService.markFamiliarReady({ roomCode, userId: 'user1' });
      expect(ready.ok).toBe(true);
      expect(ready.game.status).toBe('familiarizing');

      ready = gameService.markFamiliarReady({ roomCode, userId: 'user2' });
      expect(ready.ok).toBe(true);
      expect(ready.game.status).toBe('playing');
      expect(ready.game.currentTurnUserId).toBe('user1');
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

    it('should award one replication point for each correct existing note replay', () => {
      const roomCode = 'CORRECT_REPLAY';
      startPlayingGame(roomCode);
      gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 3 });

      const result = gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 3 });

      expect(result.ok).toBe(true);
      expect(result.game.scores.user2).toBe(1);
      expect(result.game.inputIndex).toBe(1);
      expect(result.game.lastEvent).toMatchObject({ type: 'note_ok', userId: 'user2', padIndex: 3 });
    });

    it('should not award an extra point for the newly added note in the same turn', () => {
      const roomCode = 'NO_POINT_FOR_ADDED_NOTE';
      startPlayingGame(roomCode);

      // Round 1, player 1 starts the chain with a new note. This note is not validated,
      // so player 1 should still have 0 replication points.
      const firstTurn = gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 3 });
      expect(firstTurn.game.scores.user1).toBe(0);

      // Player 2 correctly reproduces existing note (+1), then adds a new note.
      const replay = gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 3 });
      expect(replay.game.scores.user2).toBe(1);
      const addNote = gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 4 });

      // The newly added note itself must not grant an additional replication point.
      // (Round survival bonus may apply separately at round completion.)
      expect(addNote.game.scores.user2).toBeGreaterThanOrEqual(1);
      expect(addNote.game.scores.user2 % 5).toBe(1);
      expect(addNote.game.scores.user1).toBe(0);
      expect(addNote.game.sequence).toEqual([3, 4]);
      expect(addNote.game.lastEvent).toMatchObject({ type: 'note_added', userId: 'user2', padIndex: 4 });
    });

    it('should eliminate player on wrong replay input and finish when one player remains', () => {
      const roomCode = 'WRONG_REPLAY';
      startPlayingGame(roomCode);
      gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 3 });

      const result = gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 4 });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('finished');
      expect(result.game.eliminatedUserIds).toContain('user2');
      expect(result.game.players.find((player) => player.userId === 'user2')).toMatchObject({
        isEliminated: true,
        eliminationReason: 'wrong_note',
        leftDuringGame: false,
      });
      expect(result.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
    });

    it('should grant survival bonus to the remaining alive player when elimination happens on the round-closing turn', () => {
      const roomCode = 'NO_SURVIVAL_ON_INCOMPLETE_FINAL_ROUND';
      startPlayingGame(roomCode);

      // Round 1: P1 adds first note (0 point), P2 replays 1 (+1) then adds.
      gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 1 });
      gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 1 });
      gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 2 });

      // Round 2 (in progress): P1 replays 2 (+2) then adds.
      gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 1 });
      gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 2 });
      gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 3 });

      // P2 replays only first 2 of 3, then fails on 3rd.
      gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 1 });
      gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 2 });
      const result = gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 4 });

      expect(result.game.status).toBe('finished');
      expect(result.game.scores.user1).toBe(12);
      expect(result.game.scores.user2).toBe(8);
    });
  });

  describe('timeout and forfeit', () => {
    it('should eliminate current player on turn timeout', () => {
      const roomCode = 'TURN_TIMEOUT';
      startPlayingGame(roomCode);

      const result = gameService.registerTurnTimeout(roomCode);

      expect(result.eliminatedUserIds).toContain('user1');
      expect(result.players.find((player) => player.userId === 'user1')).toMatchObject({
        isEliminated: true,
        eliminationReason: 'timeout',
        leftDuringGame: false,
      });
      expect(result.status).toBe('finished');
      expect(result.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user2' });
    });

    it('should finish when a non-turn player forfeits and only one player remains', () => {
      const roomCode = 'FORFEIT_NON_TURN_PLAYER';
      startPlayingGame(roomCode);

      const result = gameService.forfeitPlayer({ roomCode, userId: 'user2', reason: 'leave_room' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('finished');
      expect(result.game.eliminatedUserIds).toContain('user2');
      expect(result.game.turnEndsAt).toBeNull();
      expect(result.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
    });

    it('should not stall round completion after off-turn elimination in 3-player game', () => {
      const roomCode = 'OFF_TURN_ELIMINATION_ROUND_PROGRESS';
      const participants = [
        participant('user1', 'Host'),
        participant('user2', 'Player Two'),
        participant('user3', 'Player Three'),
      ];
      startPlayingGame(roomCode, participants);

      // P1 starts sequence.
      gameService.registerPadPress({ roomCode, userId: 'user1', padIndex: 1 });

      // Off-turn elimination: P3 leaves before taking turn this round.
      const forfeit = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'leave_room' });
      expect(forfeit.ok).toBe(true);

      // P2 completes their turn, which should now close the round (P1 and P2 only).
      gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 1 });
      const add = gameService.registerPadPress({ roomCode, userId: 'user2', padIndex: 2 });

      expect(add.ok).toBe(true);
      expect(add.game.roundNumber).toBe(2);
      expect(add.game.scores.user2).toBe(6); // +1 replay +5 survival
      expect(add.game.currentTurnUserId).toBe('user1');
    });

    it('should finish when the current player forfeits and only one player remains', () => {
      const roomCode = 'FORFEIT_CURRENT_PLAYER';
      startPlayingGame(roomCode);

      const result = gameService.forfeitPlayer({ roomCode, userId: 'user1', reason: 'disconnect' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('finished');
      expect(result.game.eliminatedUserIds).toContain('user1');
      expect(result.game.turnEndsAt).toBeNull();
      expect(result.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user2' });
    });

    it('should advance turn when the current player forfeits in a three-player game', () => {
      const roomCode = 'FORFEIT_CURRENT_THREE_PLAYERS';
      startPlayingGame(roomCode, [
        participant('user1', 'Host'),
        participant('user2', 'Player Two'),
        participant('user3', 'Player Three'),
      ]);

      const result = gameService.forfeitPlayer({ roomCode, userId: 'user1', reason: 'disconnect' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('playing');
      expect(result.game.currentTurnUserId).toBe('user2');
      expect(result.game.eliminatedUserIds).toContain('user1');
    });

    it('should not advance turn when a non-current player forfeits in a three-player game', () => {
      const roomCode = 'FORFEIT_NON_CURRENT_THREE_PLAYERS';
      startPlayingGame(roomCode, [
        participant('user1', 'Host'),
        participant('user2', 'Player Two'),
        participant('user3', 'Player Three'),
      ]);

      const result = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('playing');
      expect(result.game.currentTurnUserId).toBe('user1');
      expect(result.game.eliminatedUserIds).toContain('user3');
      expect(result.game.lastEvent).toMatchObject({ type: 'player_eliminated', userId: 'user3', reason: 'disconnect' });
    });

    it('should not advance turn when a non-current player forfeits in a four-player game', () => {
      const roomCode = 'FORFEIT_NON_CURRENT_FOUR_PLAYERS';
      startPlayingGame(roomCode, [
        participant('user1', 'Host'),
        participant('user2', 'Player Two'),
        participant('user3', 'Player Three'),
        participant('user4', 'Player Four'),
      ]);

      const result = gameService.forfeitPlayer({ roomCode, userId: 'user4', reason: 'disconnect' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('playing');
      expect(result.game.currentTurnUserId).toBe('user1');
      expect(result.game.eliminatedUserIds).toContain('user4');
    });

    it('should not advance turn when a non-current player forfeits in a five-player game', () => {
      const roomCode = 'FORFEIT_NON_CURRENT_FIVE_PLAYERS';
      startPlayingGame(roomCode, [
        participant('user1', 'Host'),
        participant('user2', 'Player Two'),
        participant('user3', 'Player Three'),
        participant('user4', 'Player Four'),
        participant('user5', 'Player Five'),
      ]);

      const result = gameService.forfeitPlayer({ roomCode, userId: 'user5', reason: 'disconnect' });

      expect(result.ok).toBe(true);
      expect(result.game.status).toBe('playing');
      expect(result.game.currentTurnUserId).toBe('user1');
      expect(result.game.eliminatedUserIds).toContain('user5');
    });

    it('should keep the same current turn when two non-current players forfeit consecutively and multiple players remain', () => {
      const roomCode = 'FORFEIT_TWO_NON_CURRENT_PLAYERS_REMAIN';
      startPlayingGame(roomCode, [
        participant('user1', 'Host'),
        participant('user2', 'Player Two'),
        participant('user3', 'Player Three'),
        participant('user4', 'Player Four'),
      ]);

      const firstResult = gameService.forfeitPlayer({ roomCode, userId: 'user4', reason: 'disconnect' });
      expect(firstResult.game.status).toBe('playing');
      expect(firstResult.game.currentTurnUserId).toBe('user1');

      const secondResult = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });
      expect(secondResult.ok).toBe(true);
      expect(secondResult.game.status).toBe('playing');
      expect(secondResult.game.currentTurnUserId).toBe('user1');
      expect(secondResult.game.eliminatedUserIds).toEqual(expect.arrayContaining(['user3', 'user4']));
    });

    it('should finish when consecutive forfeits leave only one player alive', () => {
      const roomCode = 'FORFEIT_CONSECUTIVE_FINISH';
      startPlayingGame(roomCode, [
        participant('user1', 'Host'),
        participant('user2', 'Player Two'),
        participant('user3', 'Player Three'),
      ]);

      const firstResult = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });
      expect(firstResult.game.status).toBe('playing');
      expect(firstResult.game.currentTurnUserId).toBe('user1');

      const secondResult = gameService.forfeitPlayer({ roomCode, userId: 'user2', reason: 'leave_room' });
      expect(secondResult.ok).toBe(true);
      expect(secondResult.game.status).toBe('finished');
      expect(secondResult.game.turnEndsAt).toBeNull();
      expect(secondResult.game.eliminatedUserIds).toEqual(expect.arrayContaining(['user2', 'user3']));
      expect(secondResult.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
    });

    it('should reject forfeit from non-participants', () => {
      const roomCode = 'FORFEIT_OUTSIDER';
      startPlayingGame(roomCode);

      const result = gameService.forfeitPlayer({ roomCode, userId: 'outsider', reason: 'leave_room' });

      expect(result).toMatchObject({ ok: false, error: 'Not a game participant.' });
    });

    it('should finish after consecutive familiarizing forfeits leave one player alive', () => {
      const roomCode = 'FAMILIAR_CONSECUTIVE_FORFEITS_FINISH';
      gameService.startGame({
        room: room({
          roomCode,
          participants: [
            participant('user1', 'Host'),
            participant('user2', 'Player Two'),
            participant('user3', 'Player Three'),
          ],
        }),
        requestedByUserId: 'user1',
      });

      const first = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });
      expect(first.game.status).toBe('familiarizing');

      const second = gameService.forfeitPlayer({ roomCode, userId: 'user2', reason: 'leave_room' });
      expect(second.ok).toBe(true);
      expect(second.game.status).toBe('finished');
      expect(second.game.turnEndsAt).toBeNull();
      expect(second.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
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
