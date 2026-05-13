const express = require('express');
const { continueAsGuest } = require('../controllers/authController');

const router = express.Router();

/**
 * @swagger
 * /api/auth/guest:
 *   post:
 *     summary: Continue as guest
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *     responses:
 *       201:
 *         description: Guest session created
 */
router.post('/guest', continueAsGuest);

module.exports = router;
