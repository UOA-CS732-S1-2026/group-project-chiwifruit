const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  createRoom,
  setCandidateReady,
  checkIfCandidateIsReady,
  leaveRoom,
  selectMode,
  selectDifficulty,
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
 *                 enum: [kiwi, piano, maori, animal, aussie]
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
 * /api/rooms/{roomCode}/difficulty:
 *   patch:
 *     summary: Select game difficulty (host only)
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
 *               - difficulty
 *             properties:
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *     responses:
 *       200:
 *         description: Difficulty selected
 *       400:
 *         description: difficulty must be easy, medium, or hard
 *       403:
 *         description: Only host can select difficulty
 *       404:
 *         description: Room not found
 */
router.patch('/:roomCode/difficulty', authMiddleware, selectDifficulty);

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

/**
 * @swagger
 * /api/rooms/{roomCode}:
 *   delete:
 *     summary: Leave a room
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
 *         description: Left room
 *       403:
 *         description: Not joined the room
 *       404:
 *         description: Room not found
 */
router.delete('/:roomCode', authMiddleware, leaveRoom);

// NOTE (2026-04-29): 该 DELETE 接口用于“离开房间名单”（例如 results 回首页），
// 不等同于 socket 的 leave_room（离开比赛=判负）。

module.exports = router;
