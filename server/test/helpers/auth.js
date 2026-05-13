jest.unmock('jsonwebtoken')

const jwt = require('jsonwebtoken')
const env = require('../../src/config/env')

function createAuthHeader(identity) {
  const token = jwt.sign(identity, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
  return `Bearer ${token}`
}

function userIdentity(id = 'user-1', username = 'User One') {
  return {
    sub: id,
    username,
    isGuest: false,
  }
}

function guestIdentity(id = 'guest-1', username = 'Guest One') {
  return {
    sub: id,
    username,
    isGuest: true,
  }
}

module.exports = {
  createAuthHeader,
  userIdentity,
  guestIdentity,
}
