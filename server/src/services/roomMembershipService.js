const Room = require('../models/Room');
const { buildAvatarUrl } = require('../controllers/authController');
const { emitRoomUpdate } = require('../socket');

const MAX_ROOM_PARTICIPANTS = 6;
const MIN_PARTICIPANTS_TO_START = 2;

function getIdentityId(identity) {
  return identity?.sub ? String(identity.sub) : null;
}

function getParticipantId(participant) {
  if (!participant) return null;
  if (participant.user?._id) return String(participant.user._id);
  if (participant.user) return String(participant.user);
  if (participant.guestId) return String(participant.guestId);
  return null;
}

function isIdentityParticipant(participant, identity) {
  const identityId = getIdentityId(identity);
  if (!identityId) return false;
  return getParticipantId(participant) === identityId;
}

function buildParticipant(identity) {
  if (identity?.isGuest) {
    return {
      guestId: identity.sub,
      guestName: identity.username,
      isReady: false,
      correctCount: 0,
    };
  }

  return {
    user: identity.sub,
    isReady: false,
    correctCount: 0,
  };
}

function transferHostIfNeeded(room, leavingId) {
  if (!leavingId || String(room.host) !== String(leavingId)) return;
  const next = room.participants[0];
  const nextHostId = getParticipantId(next);
  if (nextHostId) room.host = nextHostId;
}

async function buildRoomState(roomCode) {
  const room = await Room.findOne({ roomCode: String(roomCode).toUpperCase() }).populate('participants.user', 'username');
  if (!room) return null;

  const hostId = room.host != null ? String(room.host) : null;
  const nonHostParticipants = room.participants.filter((participant) => {
    const participantId = getParticipantId(participant);
    if (!participantId) return true;
    if (!hostId) return true;
    return participantId !== hostId;
  });
  const everyoneReady = nonHostParticipants.length > 0 && nonHostParticipants.every((p) => p.isReady);
  const canStartGame = room.participants.length >= MIN_PARTICIPANTS_TO_START && everyoneReady;

  return {
    roomCode: room.roomCode,
    hostId,
    mode: room.mode,
    difficulty: room.difficulty,
    participantCount: room.participants.length,
    maxParticipantCount: MAX_ROOM_PARTICIPANTS,
    minParticipantsToStart: MIN_PARTICIPANTS_TO_START,
    everyoneReady,
    canStartGame,
    participants: room.participants.map((participant) => {
      const participantId = getParticipantId(participant);
      const username = participant.user?.username || participant.guestName;
      return {
        userId: participantId,
        username,
        isGuest: Boolean(participant.guestId),
        correctCount: participant.correctCount || 0,
        isReady: participant.isReady,
        avatarUrl: buildAvatarUrl(participantId),
      };
    }),
  };
}

async function emitUpdatedRoom(io, roomCode) {
  const roomState = await buildRoomState(roomCode);
  if (roomState) emitRoomUpdate(io, roomCode, roomState);
  return roomState;
}

async function removeIdentityFromRoom({ identity, roomCode, io }) {
  const identityId = getIdentityId(identity);
  const code = String(roomCode ?? '').toUpperCase();
  if (!identityId || !code) return { removed: false };

  const room = await Room.findOne({ roomCode: code });
  if (!room) return { removed: false, deleted: true };

  const index = room.participants.findIndex((participant) => isIdentityParticipant(participant, identity));
  if (index === -1) return { removed: false };

  const [leaving] = room.participants.splice(index, 1);
  const leavingId = getParticipantId(leaving);
  transferHostIfNeeded(room, leavingId);

  if (room.participants.length === 0) {
    await Room.deleteOne({ _id: room._id });
    return { removed: true, deleted: true };
  }

  await room.save();
  const roomState = await emitUpdatedRoom(io, room.roomCode);
  return { removed: true, deleted: false, roomState };
}

async function removeIdentityFromOtherRooms({ identity, keepRoomCode, io }) {
  const identityId = getIdentityId(identity);
  if (!identityId) return [];

  const keep = keepRoomCode ? String(keepRoomCode).toUpperCase() : null;
  const rooms = await Room.find({
    ...(keep ? { roomCode: { $ne: keep } } : {}),
    $or: [{ 'participants.user': identityId }, { 'participants.guestId': identityId }],
  });

  const results = [];
  for (const room of rooms) {
    const result = await removeIdentityFromRoom({ identity, roomCode: room.roomCode, io });
    results.push({ roomCode: room.roomCode, ...result });
  }
  return results;
}

module.exports = {
  MAX_ROOM_PARTICIPANTS,
  MIN_PARTICIPANTS_TO_START,
  buildParticipant,
  buildRoomState,
  emitUpdatedRoom,
  getParticipantId,
  isIdentityParticipant,
  removeIdentityFromOtherRooms,
  removeIdentityFromRoom,
};
