const jwt = require('jsonwebtoken');
const env = require('../config/env');

function createToken(identity) {
  return jwt.sign(
    {
      sub: identity.sub || identity._id,
      username: identity.username,
      isGuest: Boolean(identity.isGuest)
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn
    }
  );
}

module.exports = { createToken };
