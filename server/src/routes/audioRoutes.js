const express = require('express');
const { getAudioByIndex } = require('../controllers/audioController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/:num', authMiddleware, getAudioByIndex);

module.exports = router;
