const Room = require('../models/Room');
const { buildAvatarUrl } = require('../controllers/authController');

const MAX_ROOM_PARTICIPANTS = 6;
const MIN_PARTICIPANTS_TO_START = 2;

function getStoredParticipantId(participant) {
  if (participant.user?._id) {
    return String(participant.user._id);
  }

  if (participant.user) {
    return String(participant.user);
  }

  if (participant.guestId) {
    return String(participant.guestId);
  }

  return null;
}

function getParticipantSelector(identity) {
  if (identity.isGuest) {
    return (participant) => participant.guestId === identity.sub;
  }

  return (participant) => getStoredParticipantId(participant) === String(identity.sub);
}

async function getRoomState(roomCode) {
  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() }).populate(
    'participants.user',
    'username'
  );
  if (!room) {
    return null;
  }

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
    participants: room.participants.map((participant) => ({
      userId: participant.user?._id || participant.guestId,
      username: participant.user?.username || participant.guestName,
      isGuest: Boolean(participant.guestId),
      correctCount: participant.correctCount || 0,
      isReady: participant.isReady,
      avatarUrl: participant.user
        ? buildAvatarUrl(participant.user._id.toString())
        : buildAvatarUrl(participant.guestId)
    }))
  };
}

async function removeParticipantFromRoom({ roomCode, identity }) {
  const normalizedRoomCode = String(roomCode).toUpperCase();
  const room = await Room.findOne({ roomCode: normalizedRoomCode });
  if (!room) {
    return { ok: false, status: 404, error: 'Room not found' };
  }

  const participantIndex = room.participants.findIndex(getParticipantSelector(identity));
  if (participantIndex === -1) {
    return { ok: false, status: 403, error: 'Join the room first before leaving' };
  }

  const leavingParticipant = room.participants[participantIndex];
  room.participants.splice(participantIndex, 1);

  const leavingId = leavingParticipant?.user
    ? String(leavingParticipant.user)
    : leavingParticipant?.guestId
      ? String(leavingParticipant.guestId)
      : null;
  if (leavingId && String(room.host) === leavingId) {
    const next = room.participants[0];
    const nextHostId = next?.user?._id || next?.user || next?.guestId || null;
    if (nextHostId) {
      room.host = nextHostId;
    }
  }

  if (room.participants.length === 0) {
    await Room.deleteOne({ _id: room._id });
    return { ok: true, roomCode: normalizedRoomCode, deleted: true, hostId: null, roomState: null };
  }

  await room.save();
  const roomState = await getRoomState(room.roomCode);

  return {
    ok: true,
    roomCode: room.roomCode,
    deleted: false,
    hostId: roomState?.hostId ?? null,
    roomState,
  };
}

module.exports = {
  MAX_ROOM_PARTICIPANTS,
  MIN_PARTICIPANTS_TO_START,
  getStoredParticipantId,
  getParticipantSelector,
  getRoomState,
  removeParticipantFromRoom,
};