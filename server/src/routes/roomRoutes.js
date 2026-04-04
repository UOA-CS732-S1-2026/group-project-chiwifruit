const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  createRoom,
  setCandidateReady,
  checkIfCandidateIsReady,
  selectMode
} = require('../controllers/roomController');

const router = express.Router();

router.post('/', authMiddleware, createRoom);
router.patch('/:roomCode/ready', authMiddleware, setCandidateReady);
router.get('/:roomCode/ready', authMiddleware, checkIfCandidateIsReady);
router.patch('/:roomCode/mode', authMiddleware, selectMode);

module.exports = router;
