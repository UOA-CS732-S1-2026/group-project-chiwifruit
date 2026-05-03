const Room = require('../models/Room');
const { generateRoomCode } = require('../utils/roomCode');
const { buildAvatarUrl } = require('./authController');
const {
  MAX_ROOM_PARTICIPANTS,
  buildParticipant,
  buildRoomState,
  emitUpdatedRoom,
  isGuestIdentity,
  isIdentityParticipant,
  removeIdentityFromOtherRooms,
  removeIdentityFromRoom,
  resolveMaybePopulate,
} = require('../services/roomMembershipService');

function buildRanking(room) {
  return room.participants
    .map((participant) => {
      const userId = participant.user?._id || participant.guestId;
      return {
        userId,
        username: participant.user?.username || participant.guestName,
        isGuest: Boolean(participant.guestId),
        correctCount: participant.correctCount || 0,
        avatarUrl: buildAvatarUrl(String(userId)),
      };
    })
    .sort((a, b) => {
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return String(a.username || '').localeCompare(String(b.username || ''));
    })
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

async function generateUniqueRoomCode() {
  for (let i = 0; i < 5; i += 1) {
    const code = generateRoomCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Room.exists({ roomCode: code });
    if (!exists) return code;
  }
  throw new Error('Unable to generate unique room code. Try again.');
}

async function createRoom(req, res) {
  const identity = req.user;
  const io = req.app.get('io');
  const joinRoomCode = req.body?.joinRoomCode ? String(req.body.joinRoomCode).toUpperCase() : '';

  if (joinRoomCode) {
    const room = await Room.findOne({ roomCode: joinRoomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const alreadyJoined = room.participants.some((participant) => isIdentityParticipant(participant, identity));
    if (!alreadyJoined && room.participants.length >= MAX_ROOM_PARTICIPANTS) {
      return res.status(409).json({ message: `Room is full. Maximum ${MAX_ROOM_PARTICIPANTS} participants are allowed` });
    }

    // One browser/session should only be in one room roster at a time. Clean up
    // old rooms only after the target room is known to be joinable.
    await removeIdentityFromOtherRooms({ identity, keepRoomCode: joinRoomCode, io });

    if (!alreadyJoined) {
      room.participants.push(buildParticipant(identity));
      await room.save();
    }

    await emitUpdatedRoom(io, room.roomCode);
    return res.json({ message: 'Joined room', roomCode: room.roomCode, roomId: room._id });
  }

  await removeIdentityFromOtherRooms({ identity, keepRoomCode: null, io });

  const roomCode = await generateUniqueRoomCode();
  const room = await Room.create({
    roomCode,
    host: identity.sub,
    participants: [buildParticipant(identity)],
  });

  await emitUpdatedRoom(io, room.roomCode);
  return res.status(201).json({ message: 'Room created', roomCode, roomId: room._id });
}

async function setCandidateReady(req, res) {
  const { roomCode } = req.params;
  const { isReady = true } = req.body;
  const identity = req.user;

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
  if (!room) return res.status(404).json({ message: 'Room not found' });

  const participant = room.participants.find((p) => isIdentityParticipant(p, identity));
  if (!participant) return res.status(403).json({ message: 'Join the room first before setting readiness' });

  participant.isReady = Boolean(isReady);
  await room.save();
  await emitUpdatedRoom(req.app.get('io'), room.roomCode);

  return res.json({ message: 'Readiness updated', roomCode: room.roomCode, isReady: participant.isReady });
}

async function getRoomState(roomCode) {
  return buildRoomState(roomCode);
}

async function checkIfCandidateIsReady(req, res) {
  const roomState = await getRoomState(req.params.roomCode);
  if (!roomState) return res.status(404).json({ message: 'Room not found' });
  return res.json(roomState);
}

async function selectMode(req, res) {
  const { roomCode } = req.params;
  const { mode } = req.body;
  const userId = req.user.sub;

  if (!['bird', 'piano'].includes(mode)) return res.status(400).json({ message: 'mode must be bird or piano' });

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
  if (!room) return res.status(404).json({ message: 'Room not found' });
  if (String(room.host) !== String(userId)) return res.status(403).json({ message: 'Only the host can select a mode' });

  room.mode = mode;
  room.participants.forEach((participant) => { participant.isReady = false; });
  await room.save();
  await emitUpdatedRoom(req.app.get('io'), room.roomCode);

  return res.json({ message: 'Mode selected', roomCode: room.roomCode, mode: room.mode });
}

async function selectDifficulty(req, res) {
  const { roomCode } = req.params;
  const { difficulty } = req.body;
  const userId = req.user.sub;

  if (!['easy', 'medium', 'hard'].includes(difficulty)) return res.status(400).json({ message: 'difficulty must be easy, medium, or hard' });

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
  if (!room) return res.status(404).json({ message: 'Room not found' });
  if (String(room.host) !== String(userId)) return res.status(403).json({ message: 'Only the host can select difficulty' });

  room.difficulty = difficulty;
  room.participants.forEach((participant) => { participant.isReady = false; });
  await room.save();
  await emitUpdatedRoom(req.app.get('io'), room.roomCode);

  return res.json({ message: 'Difficulty selected', roomCode: room.roomCode, difficulty: room.difficulty });
}

async function leaveRoom(req, res) {
  const { roomCode } = req.params;
  const result = await removeIdentityFromRoom({ identity: req.user, roomCode, io: req.app.get('io') });

  if (!result.removed && result.deleted) return res.status(404).json({ message: 'Room not found' });
  if (!result.removed) return res.status(403).json({ message: 'Join the room first before leaving' });

  return res.json({
    message: 'Left room',
    roomCode: String(roomCode).toUpperCase(),
    deleted: Boolean(result.deleted),
    hostId: result.roomState?.hostId ?? null,
  });
}

async function submitRoundResult(req, res) {
  const { roomCode } = req.params;
  const { roundCorrectCount } = req.body;
  const identity = req.user;

  if (!Number.isInteger(roundCorrectCount) || roundCorrectCount < 0) {
    return res.status(400).json({ message: 'roundCorrectCount must be a non-negative integer' });
  }

  const selector = isGuestIdentity(identity) ? { 'participants.guestId': identity.sub } : { 'participants.user': identity.sub };
  const updateResult = await Room.updateOne({ roomCode: roomCode.toUpperCase(), ...selector }, { $inc: { 'participants.$.correctCount': roundCorrectCount } });
  if (updateResult.matchedCount === 0) return res.status(403).json({ message: 'Join the room first before submitting round results' });

  const room = await resolveMaybePopulate(
    Room.findOne({ roomCode: roomCode.toUpperCase() }),
    'participants.user',
    'username'
  );
  if (!room) return res.status(404).json({ message: 'Room not found' });

  const participant = room.participants.find((p) => isIdentityParticipant(p, identity));
  await emitUpdatedRoom(req.app.get('io'), room.roomCode);

  return res.json({
    message: 'Round result submitted',
    roomCode: room.roomCode,
    totalCorrectCount: participant?.correctCount ?? 0,
    ranking: buildRanking(room),
  });
}

async function getRanking(req, res) {
  const { roomCode } = req.params;
  const room = await resolveMaybePopulate(
    Room.findOne({ roomCode: roomCode.toUpperCase() }),
    'participants.user',
    'username'
  );
  if (!room) return res.status(404).json({ message: 'Room not found' });
  return res.json({ roomCode: room.roomCode, ranking: buildRanking(room) });
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
  getRoomState,
};
