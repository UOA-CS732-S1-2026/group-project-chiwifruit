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
    roomCode: overrides.roomCode,
    host: overrides.host || 'user1',
    mode: overrides.mode || 'bird',
    difficulty: overrides.difficulty || 'easy',
    participants: overrides.participants || [participant('user1', 'Host'), participant('user2', 'Player Two')],
  };
}

describe('gameService familiarization forfeit lifecycle', () => {
  it('should finish when a non-host forfeits during two-player familiarization', () => {
    const roomCode = 'FAMILIAR_FORFEIT_NON_HOST';
    const start = gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });
    expect(start.ok).toBe(true);
    expect(start.game.status).toBe('familiarizing');

    const result = gameService.forfeitPlayer({ roomCode, userId: 'user2', reason: 'disconnect' });

    expect(result.ok).toBe(true);
    expect(result.game.status).toBe('finished');
    expect(result.game.turnEndsAt).toBeNull();
    expect(result.game.eliminatedUserIds).toContain('user2');
    expect(result.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
  });

  it('should finish when the host forfeits during two-player familiarization', () => {
    const roomCode = 'FAMILIAR_FORFEIT_HOST';
    const start = gameService.startGame({ room: room({ roomCode }), requestedByUserId: 'user1' });
    expect(start.ok).toBe(true);
    expect(start.game.status).toBe('familiarizing');

    const result = gameService.forfeitPlayer({ roomCode, userId: 'user1', reason: 'disconnect' });

    expect(result.ok).toBe(true);
    expect(result.game.status).toBe('finished');
    expect(result.game.turnEndsAt).toBeNull();
    expect(result.game.eliminatedUserIds).toContain('user1');
    expect(result.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user2' });
  });

  it('should remain familiarizing when one player forfeits but multiple players remain', () => {
    const roomCode = 'FAMILIAR_FORFEIT_THREE_PLAYERS';
    const start = gameService.startGame({
      room: room({
        roomCode,
        participants: [participant('user1', 'Host'), participant('user2', 'Player Two'), participant('user3', 'Player Three')],
      }),
      requestedByUserId: 'user1',
    });
    expect(start.ok).toBe(true);
    expect(start.game.status).toBe('familiarizing');

    const result = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });

    expect(result.ok).toBe(true);
    expect(result.game.status).toBe('familiarizing');
    expect(result.game.eliminatedUserIds).toContain('user3');
    expect(result.game.lastEvent).toMatchObject({ type: 'player_eliminated', userId: 'user3', reason: 'disconnect' });
  });

  it('should start playing only with alive familiar-ready players after a familiarization forfeit', () => {
    const roomCode = 'FAMILIAR_FORFEIT_THEN_READY';
    const start = gameService.startGame({
      room: room({
        roomCode,
        participants: [participant('user1', 'Host'), participant('user2', 'Player Two'), participant('user3', 'Player Three')],
      }),
      requestedByUserId: 'user1',
    });
    expect(start.ok).toBe(true);

    const forfeit = gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });
    expect(forfeit.game.status).toBe('familiarizing');

    let ready = gameService.markFamiliarReady({ roomCode, userId: 'user1' });
    expect(ready.ok).toBe(true);
    expect(ready.game.status).toBe('familiarizing');

    ready = gameService.markFamiliarReady({ roomCode, userId: 'user2' });
    expect(ready.ok).toBe(true);
    expect(ready.game.status).toBe('playing');
    expect(ready.game.currentTurnUserId).toBe('user1');
    expect(ready.game.eliminatedUserIds).toContain('user3');
  });

  it('should reject familiarization interactions from an eliminated player', () => {
    const roomCode = 'FAMILIAR_ELIMINATED_INTERACTION';
    const start = gameService.startGame({
      room: room({
        roomCode,
        participants: [participant('user1', 'Host'), participant('user2', 'Player Two'), participant('user3', 'Player Three')],
      }),
      requestedByUserId: 'user1',
    });
    expect(start.ok).toBe(true);

    gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });

    expect(gameService.markFamiliarReady({ roomCode, userId: 'user3' })).toMatchObject({
      ok: false,
      error: 'Player has been eliminated.',
    });
    expect(gameService.registerFamiliarPadPress({ roomCode, userId: 'user3', padIndex: 0 })).toMatchObject({
      ok: false,
      error: 'Player has been eliminated.',
    });
  });

  it('should not force-start a one-player game after familiarization forfeits', () => {
    const roomCode = 'FAMILIAR_FORCE_START_ONE_ALIVE';
    const start = gameService.startGame({
      room: room({
        roomCode,
        participants: [participant('user1', 'Host'), participant('user2', 'Player Two'), participant('user3', 'Player Three')],
      }),
      requestedByUserId: 'user1',
    });
    expect(start.ok).toBe(true);

    gameService.forfeitPlayer({ roomCode, userId: 'user3', reason: 'disconnect' });
    const secondForfeit = gameService.forfeitPlayer({ roomCode, userId: 'user2', reason: 'disconnect' });
    expect(secondForfeit.game.status).toBe('finished');

    const forced = gameService.forceStartPlaying({ roomCode, reason: 'familiar_timeout' });

    expect(forced.ok).toBe(true);
    expect(forced.game.status).toBe('finished');
    expect(forced.game.turnEndsAt).toBeNull();
    expect(forced.game.lastEvent).toMatchObject({ type: 'game_finished', winnerUserId: 'user1' });
  });
});
