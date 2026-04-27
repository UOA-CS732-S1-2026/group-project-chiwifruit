const crypto = require('crypto');
const User = require('../models/User');
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

function buildAvatarUrl(seed, style = 'lorelei') {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

async function register(req, res) {
  let { username, password } = req.body;

  username = username.trim();

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'username and password are required' });
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(409).json({ message: 'Username already exists' });
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ username, passwordHash });

  const token = createToken(user);

  return res.status(201).json({
    message: 'Register success',
    token,
    user: {
      id: user._id,
      username: user.username,
      isGuest: false,
      avatarUrl: buildAvatarUrl(user._id.toString()),
    },
  });
}

async function login(req, res) {
  let { username, password } = req.body;

  username = username.trim();

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'username and password are required' });
  }

  const user = await User.findOne({ username });

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = createToken(user);

  return res.json({
    message: 'Login success',
    token,
    user: {
      id: user._id,
      username: user.username,
      isGuest: false,
      avatarUrl: buildAvatarUrl(user._id.toString()),
    },
  });
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

module.exports = { login, register, continueAsGuest, buildAvatarUrl };
