const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { check } = require('express-validator');

// Registration route with validation
router.post(
  '/register',
  [
    check('username', 'Username is required and must be between 3 and 30 characters')
      .not()
      .isEmpty()
      .isLength({ min: 3, max: 30 }),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
  ],
  register
);

// Login route with validation
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  login
);

// Get current user route
router.get('/me', protect, getMe);

module.exports = router;