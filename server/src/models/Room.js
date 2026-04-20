const mongoose = require('mongoose');

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
    }
  },
  { _id: false }
);

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
      enum: ['animals', 'music'],
      default: null
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    participants: [participantSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
