const Room = require('../models/Room');
const { generateRoomCode } = require('../utils/roomCode');
const { emitRoomUpdate } = require('../socket');
const { getGame } = require('../services/gameService');
const { buildAvatarUrl } = require('./authController');
const {
  removeParticipantFromRoom,
  getRoomState,
  getParticipantSelector,
  normalizeRoomParticipants,
  normalizePersistedRoomParticipants,
  ensureSingleRoomMembership,
  MAX_ROOM_PARTICIPANTS
} = require('../services/roomStateService');

function createParticipant(identity) {
  if (identity.isGuest) {
    return {
      guestId: identity.sub,
      guestName: identity.username,
      isReady: false,
      correctCount: 0
    };
  }

  return {
    user: identity.sub,
    isReady: false,
    correctCount: 0
  };
}

function emitCleanedRoomUpdates(io, cleanedRooms = []) {
  cleanedRooms.forEach(({ roomCode, roomState }) => {
    emitRoomUpdate(io, roomCode, roomState ?? null);
  });
}

function buildRanking(room, gamePlayers = null) {
  if (gamePlayers) {
    const sortedByScore = [...gamePlayers]
      .map((player) => ({
        userId: player.userId,
        username: player.username,
        isGuest: player.isGuest,
        avatarUrl: player.avatarUrl,
        totalScore: Number(player.score || 0),
        initialOrder: Number(player.initialOrder || 0),
      }))
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.initialOrder !== a.initialOrder) return b.initialOrder - a.initialOrder;
        return String(a.userId || '').localeCompare(String(b.userId || ''));
      });

    return sortedByScore.map(({ initialOrder, ...entry }, index) => ({
      ...entry,
      correctCount: entry.totalScore,
      rank: index + 1,
    }));
  }

  // Fallback to room participants
  return room.participants
    .map((participant) => ({
      userId: participant.user?._id || participant.guestId,
      username: participant.user?.username || participant.guestName,
      isGuest: Boolean(participant.guestId),
      correctCount: participant.correctCount || 0,
      avatarUrl: participant.user ? buildAvatarUrl(participant.user._id.toString()) : buildAvatarUrl(participant.guestId)
    }))
    .sort((a, b) => {
      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }

      return String(a.username || '').localeCompare(String(b.username || ''));
    })
    .map((entry, index) => ({
      rank: index + 1,
      ...entry
    }));
}

async function generateUniqueRoomCode() {
  for (let i = 0; i < 5; i += 1) {
    const code = generateRoomCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Room.exists({ roomCode: code });
    if (!exists) {
      return code;
    }
  }

  throw new Error('Unable to generate unique room code. Try again.');
}

async function createRoom(req, res) {
  const identity = req.user;
  const { joinRoomCode } = req.body;
  const io = req.app.get('io');

  if (joinRoomCode) {
    const room = await Room.findOne({ roomCode: joinRoomCode.toUpperCase() });
    let didPersistJoin = false;

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const roomNormalized = normalizeRoomParticipants(room);

    const participantSelector = getParticipantSelector(identity);
    const matchingParticipants = room.participants.filter(participantSelector);
    const alreadyJoined = matchingParticipants.length > 0;
    const normalizedParticipants = room.participants.filter((participant) => !participantSelector(participant));
    const currentUserNeedsNormalization = matchingParticipants.length !== 1;

    if (!alreadyJoined) {
      if (normalizedParticipants.length >= MAX_ROOM_PARTICIPANTS) {
        return res.status(409).json({
          message: `Room is full. Maximum ${MAX_ROOM_PARTICIPANTS} participants are allowed`
        });
      }

      const { cleanedRooms } = await ensureSingleRoomMembership({ identity, targetRoomCode: room.roomCode });
      room.participants = normalizedParticipants;
      room.participants.push(createParticipant(identity));
      await room.save();
      didPersistJoin = true;

      emitCleanedRoomUpdates(io, cleanedRooms);
    } else if (currentUserNeedsNormalization) {
      const freshParticipant = createParticipant(identity);
      const participantToKeep = matchingParticipants.find((participant) => participant.isReady) || matchingParticipants[0];

      room.participants = normalizedParticipants;
      room.participants.push({
        ...freshParticipant,
        isReady: participantToKeep?.isReady ?? freshParticipant.isReady,
        correctCount: participantToKeep?.correctCount ?? freshParticipant.correctCount,
      });
      await room.save();
      didPersistJoin = true;
    } else if (roomNormalized) {
      await room.save();
      didPersistJoin = true;
    }

    if (didPersistJoin) {
      await normalizePersistedRoomParticipants(room.roomCode, room);
    }

    const roomState = await getRoomState(room.roomCode);
    if (roomState) {
      emitRoomUpdate(io, room.roomCode, roomState);
    }

    return res.json({ message: 'Joined room', roomCode: room.roomCode, roomId: room._id });
  }

  const roomCode = await generateUniqueRoomCode();
  const { cleanedRooms } = await ensureSingleRoomMembership({ identity });
  const room = await Room.create({
    roomCode,
    host: identity.sub,
    participants: [createParticipant(identity)]
  });

  emitCleanedRoomUpdates(io, cleanedRooms);

  const roomState = await getRoomState(room.roomCode);
  if (roomState) {
    emitRoomUpdate(io, room.roomCode, roomState);
  }

  return res.status(201).json({ message: 'Room created', roomCode: roomCode, roomId: room._id });
}

async function setCandidateReady(req, res) {
  const { roomCode } = req.params;
  const { isReady = true } = req.body;
  const identity = req.user;

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  const participant = room.participants.find(getParticipantSelector(identity));

  if (!participant) {
    return res.status(403).json({ message: 'Join the room first before setting readiness' });
  }

  participant.isReady = Boolean(isReady);
  await room.save();

  const roomState = await getRoomState(room.roomCode);
  if (roomState) {
    emitRoomUpdate(req.app.get('io'), room.roomCode, roomState);
  }

  return res.json({ message: 'Readiness updated', roomCode: room.roomCode, isReady: participant.isReady });
}

async function checkIfCandidateIsReady(req, res) {
  const { roomCode } = req.params;

  const room = await Room.exists({ roomCode: roomCode.toUpperCase() });
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  const roomState = await getRoomState(roomCode);
  if (!roomState) {
    return res.status(404).json({ message: 'Room not found' });
  }

  return res.json(roomState);
}

async function selectMode(req, res) {
  const { roomCode } = req.params;
  const { mode: rawMode } = req.body;
  const userId = req.user.sub;

  const normalizedMode = rawMode === 'bird' ? 'kiwi' : rawMode;
  if (!['kiwi', 'piano'].includes(normalizedMode)) {
    return res.status(400).json({ message: 'mode must be kiwi or piano' });
  }

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  if (String(room.host) !== String(userId)) {
    return res.status(403).json({ message: 'Only the host can select a mode' });
  }

  room.mode = normalizedMode;
  // Reset all participants' ready status when mode changes
  room.participants.forEach(participant => {
    participant.isReady = false;
  });
  await room.save();

  const roomState = await getRoomState(room.roomCode);
  if (roomState) {
    emitRoomUpdate(req.app.get('io'), room.roomCode, roomState);
  }

  return res.json({ message: 'Mode selected', roomCode: room.roomCode, mode: room.mode });
}

async function selectDifficulty(req, res) {
  const { roomCode } = req.params;
  const { difficulty } = req.body;
  const userId = req.user.sub;

  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return res.status(400).json({ message: 'difficulty must be easy, medium, or hard' });
  }

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  if (String(room.host) !== String(userId)) {
    return res.status(403).json({ message: 'Only the host can select difficulty' });
  }

  room.difficulty = difficulty;
  // Reset all participants' ready status when difficulty changes
  room.participants.forEach(participant => {
    participant.isReady = false;
  });
  await room.save();

  const roomState = await getRoomState(room.roomCode);
  if (roomState) {
    emitRoomUpdate(req.app.get('io'), room.roomCode, roomState);
  }

  return res.json({
    message: 'Difficulty selected',
    roomCode: room.roomCode,
    difficulty: room.difficulty
  });
}

async function leaveRoom(req, res) {
  // NOTE (2026-04-29): 房间离开必须走 REST（DELETE /api/rooms/:roomCode）。
  // 目的：从 Mongo 的 participants 列表里移除该玩家，并广播 room_update；
  // socket 的 leave_room 在本项目中被定义为“离开比赛=判负”，语义不同。
  const { roomCode } = req.params;
  const identity = req.user;
  const result = await removeParticipantFromRoom({ roomCode, identity });
  if (!result.ok) {
    return res.status(result.status).json({ message: result.error });
  }

  if (result.roomState) {
    emitRoomUpdate(req.app.get('io'), result.roomCode, result.roomState);
  }

  if (result.deleted) {
    return res.json({ message: 'Left room', roomCode: result.roomCode, deleted: true });
  }

  return res.json({ message: 'Left room', roomCode: result.roomCode, hostId: result.hostId });
}

async function submitRoundResult(req, res) {
  const { roomCode } = req.params;
  const { roundCorrectCount } = req.body;
  const identity = req.user;

  if (!Number.isInteger(roundCorrectCount) || roundCorrectCount < 0) {
    return res.status(400).json({ message: 'roundCorrectCount must be a non-negative integer' });
  }

  const participantSelector = identity.isGuest ? { 'participants.guestId': identity.sub } : { 'participants.user': identity.sub };

  const updateResult = await Room.updateOne(
    { roomCode: roomCode.toUpperCase(), ...participantSelector },
    { $inc: { 'participants.$.correctCount': roundCorrectCount } }
  );

  if (updateResult.matchedCount === 0) {
    return res.status(403).json({ message: 'Join the room first before submitting round results' });
  }

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  const participant = room.participants.find(getParticipantSelector(identity));
  // participant should exist now

  const roomState = await getRoomState(room.roomCode);
  if (roomState) {
    emitRoomUpdate(req.app.get('io'), room.roomCode, roomState);
  }

  await room.populate('participants.user', 'username');
  const ranking = buildRanking(room);

  return res.json({
    message: 'Round result submitted',
    roomCode: room.roomCode,
    totalCorrectCount: participant.correctCount,
    ranking
  });
}

async function getRanking(req, res) {
  const { roomCode } = req.params;

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() }).populate('participants.user', 'username');
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  // Check for active game for fair ranking
  const game = getGame(roomCode.toUpperCase());
  const gamePlayers = game?.players;

  // Sync game scores to room participants if game exists
  if (gamePlayers) {
    gamePlayers.forEach(gamePlayer => {
      const participant = room.participants.find(p => 
        (p.user && String(p.user._id) === gamePlayer.userId) || 
        (p.guestId === gamePlayer.userId)
      );
      if (participant) {
        participant.correctCount = gamePlayer.score;
      }
    });
    await room.save();
  }

  return res.json({
    roomCode: room.roomCode,
    ranking: buildRanking(room, gamePlayers)
  });
}

module.exports = {
  createRoom,
  setCandidateReady,
  checkIfCandidateIsReady,
  leaveRoom,
  selectMode,
  selectDifficulty,
  submitRoundResult,
  getRanking,
};
