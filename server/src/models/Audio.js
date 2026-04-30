const mongoose = require('mongoose');

const audioSchema = new mongoose.Schema(
  {
    index: {
      type: Number,
      required: true,
      min: 1
    },
    mode: {
      type: String,
      enum: ['bird', 'piano'],
      required: true
    },
    s3Key: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

audioSchema.index({ index: 1, mode: 1 }, { unique: true });

module.exports = mongoose.model('Audio', audioSchema);
