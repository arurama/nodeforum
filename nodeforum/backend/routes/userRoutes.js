/**
 * User Routes
 * Handles routing for user authentication and profile management
 */
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/permissions');
const upload = require('../middlewares/upload');

/**
 * @route   POST /api/users/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', userController.register);

/**
 * @route   POST /api/users/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', userController.login);

/**
 * @route   POST /api/users/logout
 * @desc    Logout user (client-side only)
 * @access  Private
 */
router.post('/logout', auth, userController.logout);

/**
 * @route   GET /api/users/me
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/me', auth, userController.getCurrentUser);

/**
 * @route   GET /api/users/:identifier
 * @desc    Get user profile by username or ID
 * @access  Public
 */
router.get('/:identifier', userController.getUserProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', auth, userController.updateProfile);

/**
 * @route   POST /api/users/avatar
 * @desc    Upload avatar
 * @access  Private
 */
router.post('/avatar', auth, upload.single('avatar'), userController.uploadAvatar);

/**
 * @route   PUT /api/users/password
 * @desc    Change password
 * @access  Private
 */
router.put('/password', auth, userController.changePassword);

/**
 * @route   POST /api/users/password-reset
 * @desc    Request password reset
 * @access  Public
 */
router.post('/password-reset', userController.requestPasswordReset);

/**
 * @route   PUT /api/users/password-reset/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.put('/password-reset/:token', userController.resetPassword);

/**
 * @route   GET /api/users/verify/:token
 * @desc    Verify email address
 * @access  Public
 */
router.get('/verify/:token', userController.verifyEmail);

/**
 * Admin routes
 */

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Admin/Moderator
 */
router.get('/', auth, checkPermission('viewUsers'), userController.getAllUsers);

/**
 * @route   PUT /api/users/:id/ban
 * @desc    Ban a user
 * @access  Admin/Moderator
 */
router.put('/:id/ban', auth, checkPermission('banUsers'), userController.banUser);

/**
 * @route   PUT /api/users/:id/unban
 * @desc    Unban a user
 * @access  Admin/Moderator
 */
router.put('/:id/unban', auth, checkPermission('banUsers'), userController.unbanUser);

/**
 * @route   PUT /api/users/:id/group
 * @desc    Change user group
 * @access  Admin
 */
router.put('/:id/group', auth, checkPermission('manageUserGroups'), userController.changeUserGroup);

module.exports = router;