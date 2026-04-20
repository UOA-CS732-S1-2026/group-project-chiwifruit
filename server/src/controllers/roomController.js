const Room = require('../models/Room');
const { generateRoomCode } = require('../utils/roomCode');
const { emitRoomUpdate } = require('../socket');

function getParticipantSelector(identity) {
  if (identity.isGuest) {
    return (participant) => participant.guestId === identity.sub;
  }

  return (participant) => String(participant.user) === String(identity.sub);
}

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

function buildRanking(room) {
  return room.participants
    .map((participant) => ({
      userId: participant.user?._id || participant.guestId,
      username: participant.user?.username || participant.guestName,
      isGuest: Boolean(participant.guestId),
      correctCount: participant.correctCount || 0
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

  if (!joinRoomCode && identity.isGuest) {
    return res.status(403).json({ message: 'Guest users can only join existing rooms' });
  }

  if (joinRoomCode) {
    const room = await Room.findOne({ roomCode: joinRoomCode.toUpperCase() });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const alreadyJoined = room.participants.some(getParticipantSelector(identity));

    if (!alreadyJoined) {
      room.participants.push(createParticipant(identity));
      await room.save();
    }

    const roomState = await getRoomState(room.roomCode);
    if (roomState) {
      emitRoomUpdate(req.app.get('io'), room.roomCode, roomState);
    }

    return res.json({ message: 'Joined room', roomCode: room.roomCode, roomId: room._id });
  }

  const roomCode = await generateUniqueRoomCode();
  const room = await Room.create({
    roomCode,
    host: identity.sub,
    participants: [createParticipant(identity)]
  });

  const roomState = await getRoomState(room.roomCode);
  if (roomState) {
    emitRoomUpdate(req.app.get('io'), room.roomCode, roomState);
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

async function getRoomState(roomCode) {
  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() }).populate(
    'participants.user',
    'username'
  );
  if (!room) {
    return null;
  }

  const everyoneReady = room.participants.length > 0 && room.participants.every((p) => p.isReady);

  return {
    roomCode: room.roomCode,
    mode: room.mode,
    participantCount: room.participants.length,
    everyoneReady,
    participants: room.participants.map((participant) => ({
      userId: participant.user?._id || participant.guestId,
      username: participant.user?.username || participant.guestName,
      isGuest: Boolean(participant.guestId),
      correctCount: participant.correctCount || 0,
      isReady: participant.isReady
    }))
  };
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
  const { mode } = req.body;
  const userId = req.user.sub;

  if (!['animals', 'music'].includes(mode)) {
    return res.status(400).json({ message: 'mode must be animals or music' });
  }

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }

  if (String(room.host) !== String(userId)) {
    return res.status(403).json({ message: 'Only the host can select a mode' });
  }

  room.mode = mode;
  await room.save();

  const roomState = await getRoomState(room.roomCode);
  if (roomState) {
    emitRoomUpdate(req.app.get('io'), room.roomCode, roomState);
  }

  return res.json({ message: 'Mode selected', roomCode: room.roomCode, mode: room.mode });
}

async function submitRoundResult(req, res) {
  const { roomCode } = req.params;
  const { correctCount } = req.body;
  const identity = req.user;

  if (!Number.isInteger(correctCount) || correctCount < 0) {
    return res.status(400).json({ message: 'correctCount must be a non-negative integer' });
  }

  const participantSelector = identity.isGuest ? { 'participants.guestId': identity.sub } : { 'participants.user': identity.sub };

  const updateResult = await Room.updateOne(
    { roomCode: roomCode.toUpperCase(), ...participantSelector },
    { $inc: { 'participants.$.correctCount': correctCount } }
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

  const populatedRoom = await Room.findById(room._id).populate('participants.user', 'username');
  const ranking = buildRanking(populatedRoom);

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

  return res.json({
    roomCode: room.roomCode,
    ranking: buildRanking(room)
  });
}

module.exports = {
  createRoom,
  setCandidateReady,
  checkIfCandidateIsReady,
  selectMode,
  submitRoundResult,
  getRanking
};
