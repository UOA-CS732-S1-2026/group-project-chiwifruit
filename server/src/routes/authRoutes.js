const express = require('express');
const { login, register, continueAsGuest } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/guest', continueAsGuest);

module.exports = router;
