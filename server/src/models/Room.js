const mongoose = require('mongoose');

// NOTE (2026-05-14): Room model storing waiting-room membership and configuration.

// Helper: Embedded participant shape stored inside a room document.
const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    guestId: {
      type: String,
      default: null
    },
    guestName: {
      type: String,
      default: null,
      trim: true
    },
    isReady: {
      type: Boolean,
      default: false
    },
    correctCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: false }
);

// Helper: Room document storing waiting-room configuration and participant membership.
const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      length: 6
    },
    mode: {
      type: String,
      enum: ['bird', 'piano', 'maori', 'animal', 'aussie'],
      default: 'bird'
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy'
    },
    host: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    participants: [participantSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
