const User = require('../models/User');
const { createToken } = require('../services/tokenService');

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'username and password are required' });
  }

  let user = await User.findOne({ username });

  if (!user) {
    const passwordHash = await User.hashPassword(password);
    user = await User.create({ username, passwordHash });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = createToken(user);

  return res.json({
    message: 'Login success',
    token,
    user: { id: user._id, username: user.username }
  });
}

module.exports = { login };
