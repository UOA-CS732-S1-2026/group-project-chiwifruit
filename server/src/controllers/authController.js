const crypto = require('crypto');
const { createToken } = require('../services/tokenService');

const GUEST_PREFIXES = ['Swift', 'Sunny', 'Echo', 'Brave', 'Lucky', 'Bright'];
const GUEST_NOUNS = ['Falcon', 'Otter', 'Fox', 'Koala', 'Dolphin', 'Robin'];

function generateGuestName() {
  const prefix =
    GUEST_PREFIXES[Math.floor(Math.random() * GUEST_PREFIXES.length)];
  const noun = GUEST_NOUNS[Math.floor(Math.random() * GUEST_NOUNS.length)];
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${noun}${suffix}`;
}

function buildAvatarUrl(seed, style = 'bottts') {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

async function continueAsGuest(_req, res) {
  const guestName = generateGuestName();
  const guestId = `guest_${crypto.randomUUID()}`;

  const token = createToken({
    sub: guestId,
    username: guestName,
    isGuest: true,
  });

  return res.status(201).json({
    message: 'Guest session created',
    token,
    user: {
      id: guestId,
      username: guestName,
      isGuest: true,
      avatarUrl: buildAvatarUrl(guestId),
    },
  });
}

module.exports = { continueAsGuest, buildAvatarUrl };
