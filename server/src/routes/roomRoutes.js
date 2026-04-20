const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  createRoom,
  setCandidateReady,
  checkIfCandidateIsReady,
  selectMode,
  submitRoundResult,
  getRanking
} = require('../controllers/roomController');

const router = express.Router();

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a new room or join an existing one
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               joinRoomCode:
 *                 type: string
 *                 description: Room code to join (optional)
 *     responses:
 *       201:
 *         description: Room created
 *       200:
 *         description: Joined existing room
 *       403:
 *         description: Forbidden (guest trying to create room)
 *       404:
 *         description: Room not found
 */
router.post('/', authMiddleware, createRoom);

/**
 * @swagger
 * /api/rooms/{roomCode}/ready:
 *   patch:
 *     summary: Set participant readiness
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isReady:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Readiness updated
 *       403:
 *         description: Not joined the room
 *       404:
 *         description: Room not found
 */
router.patch('/:roomCode/ready', authMiddleware, setCandidateReady);

/**
 * @swagger
 * /api/rooms/{roomCode}/ready:
 *   get:
 *     summary: Check room readiness status
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room state
 *       404:
 *         description: Room not found
 */
router.get('/:roomCode/ready', authMiddleware, checkIfCandidateIsReady);

/**
 * @swagger
 * /api/rooms/{roomCode}/mode:
 *   patch:
 *     summary: Select game mode (host only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mode
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [animals, music]
 *     responses:
 *       200:
 *         description: Mode selected
 *       403:
 *         description: Only host can select mode
 *       404:
 *         description: Room not found
 */
router.patch('/:roomCode/mode', authMiddleware, selectMode);

/**
 * @swagger
 * /api/rooms/{roomCode}/ranking:
 *   patch:
 *     summary: Submit round result
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roundCorrectCount
 *             properties:
 *               roundCorrectCount:
 *                 type: integer
 *                 minimum: 0
 *                 description: Number of correct items in this round
 *     responses:
 *       200:
 *         description: Round result submitted
 *       403:
 *         description: Not joined the room
 *       404:
 *         description: Room not found
 */
router.patch('/:roomCode/ranking', authMiddleware, submitRoundResult);

/**
 * @swagger
 * /api/rooms/{roomCode}/ranking:
 *   get:
 *     summary: Get current ranking
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current ranking
 *       404:
 *         description: Room not found
 */
router.get('/:roomCode/ranking', authMiddleware, getRanking);

module.exports = router;
