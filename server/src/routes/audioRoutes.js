const express = require('express');
const { getAudioByIndex } = require('../controllers/audioController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/audios/{num}:
 *   get:
 *     summary: Get audio by index
 *     tags: [Audio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: num
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Audio data
 *       404:
 *         description: Audio not found
 */
router.get('/:num', authMiddleware, getAudioByIndex);

module.exports = router;
