const Room = require('../models/Room');
const { buildAvatarUrl } = require('../controllers/authController');

const MAX_ROOM_PARTICIPANTS = 6;
const MIN_PARTICIPANTS_TO_START = 2;

function getHostId(room) {
  return room.host != null ? String(room.host) : null;
}

function getNextHostId(participant) {
  return participant?.user?._id || participant?.user || participant?.guestId || null;
}

function normalizeRoomParticipants(room) {
  const participants = Array.isArray(room?.participants) ? room.participants : [];
  const seenParticipantIds = new Set();
  const normalizedParticipants = [];

  for (const participant of participants) {
    const participantId = getStoredParticipantId(participant);
    if (participantId && seenParticipantIds.has(participantId)) {
      continue;
    }

    if (participantId) {
      seenParticipantIds.add(participantId);
    }

    normalizedParticipants.push(participant);
  }

  let changed = normalizedParticipants.length !== participants.length;
  if (changed) {
    room.participants = normalizedParticipants;
  }

  const hostId = getHostId(room);
  if (hostId && !room.participants.some((participant) => getStoredParticipantId(participant) === hostId)) {
    room.host = getNextHostId(room.participants[0]) || null;
    changed = true;
  }

  return changed;
}

function removeParticipantFromRoomDocument(room, identity) {
  const participantSelector = getParticipantSelector(identity);
  const leavingParticipants = room.participants.filter(participantSelector);
  if (leavingParticipants.length === 0) {
    return { removed: false, deleted: false };
  }

  room.participants = room.participants.filter((participant) => !participantSelector(participant));
  const [leavingParticipant] = leavingParticipants;
  const leavingId = getStoredParticipantId(leavingParticipant);
  if (leavingId && getHostId(room) === leavingId) {
    room.host = getNextHostId(room.participants[0]);
  }

  return {
    removed: true,
    deleted: room.participants.length === 0,
  };
}

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

  normalizeRoomParticipants(room);

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

async function normalizePersistedRoomParticipants(roomCode, fallbackRoom = null) {
  const normalizedRoomCode = String(roomCode).toUpperCase();
  const fetchedRoom = await Room.findOne({ roomCode: normalizedRoomCode });
  const room = Array.isArray(fetchedRoom?.participants) ? fetchedRoom : fallbackRoom;
  if (!room) {
    return null;
  }

  if (normalizeRoomParticipants(room)) {
    try {
      await room.save();
    } catch (error) {
      // A concurrent leave/delete can invalidate this stale room version while a refresh re-joins.
      // In that case, skip this best-effort cleanup instead of crashing the server.
      if (error?.name !== 'VersionError') {
        throw error;
      }
    }
  }

  return room;
}

async function removeParticipantFromRoom({ roomCode, identity }) {
  const normalizedRoomCode = String(roomCode).toUpperCase();
  const room = await Room.findOne({ roomCode: normalizedRoomCode });
  if (!room) {
    return { ok: false, status: 404, error: 'Room not found' };
  }

  normalizeRoomParticipants(room);

  const removal = removeParticipantFromRoomDocument(room, identity);
  if (!removal.removed) {
    return { ok: false, status: 403, error: 'Join the room first before leaving' };
  }

  if (removal.deleted) {
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

async function ensureSingleRoomMembership({ identity, targetRoomCode = null }) {
  const normalizedTargetRoomCode = targetRoomCode ? String(targetRoomCode).toUpperCase() : null;
  const rooms = await Room.find({}) || [];
  const cleanedRooms = [];

  for (const room of rooms) {
    const normalizedRoomCode = String(room.roomCode).toUpperCase();
    if (normalizedTargetRoomCode && normalizedRoomCode === normalizedTargetRoomCode) {
      continue;
    }

    const roomNormalized = normalizeRoomParticipants(room);

    const removal = removeParticipantFromRoomDocument(room, identity);
    if (!removal.removed) {
      if (roomNormalized) {
        await room.save();
      }
      continue;
    }

    if (removal.deleted) {
      await Room.deleteOne({ _id: room._id });

      cleanedRooms.push({
        roomCode: normalizedRoomCode,
        roomState: null,
        deleted: true,
      });
      continue;
    }

    await room.save();
    const roomState = await getRoomState(room.roomCode);

    cleanedRooms.push({
      roomCode: normalizedRoomCode,
      roomState,
      deleted: false,
    });
  }

  return { cleanedRooms };
}

module.exports = {
  MAX_ROOM_PARTICIPANTS,
  MIN_PARTICIPANTS_TO_START,
  getStoredParticipantId,
  getParticipantSelector,
  getRoomState,
  normalizeRoomParticipants,
  normalizePersistedRoomParticipants,
  ensureSingleRoomMembership,
  removeParticipantFromRoomDocument,
  removeParticipantFromRoom,
};