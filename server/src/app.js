const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const audioRoutes = require('./routes/audioRoutes');
const roomRoutes = require('./routes/roomRoutes');
const env = require('./config/env');

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/audios', audioRoutes);
app.use('/api/rooms', roomRoutes);

app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ message: 'Internal server error', details: error.message });
});

module.exports = app;
