const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// NOTE (2026-05-14): User model for registered accounts.
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3
    },
    passwordHash: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

// Method: compare a plain password against the stored bcrypt hash.
userSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Static helper: hash a plain password before persistence.
userSchema.statics.hashPassword = function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
};

module.exports = mongoose.model('User', userSchema);
