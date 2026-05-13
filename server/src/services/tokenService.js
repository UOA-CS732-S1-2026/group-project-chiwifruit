const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Service: create signed JWTs for both registered users and guest identities.
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
