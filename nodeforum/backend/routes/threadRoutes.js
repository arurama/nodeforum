/**
 * Thread Routes
 * Handles routing for threads
 */
const express = require('express');
const router = express.Router();
const threadController = require('../controllers/threadController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/permissions');

/**
 * @route   POST /api/forums/:forumId/threads
 * @desc    Create a new thread in a forum
 * @access  Private
 */
router.post('/forums/:forumId/threads', auth, threadController.createThread);

/**
 * @route   GET /api/threads/:id
 * @desc    Get a single thread with its first post
 * @access  Public
 */
router.get('/threads/:id', threadController.getThread);

/**
 * @route   PUT /api/threads/:id
 * @desc    Update a thread
 * @access  Thread author or Admin/Moderator
 */
router.put('/threads/:id', auth, threadController.updateThread);

/**
 * @route   DELETE /api/threads/:id
 * @desc    Delete a thread
 * @access  Thread author or Admin/Moderator
 */
router.delete('/threads/:id', auth, threadController.deleteThread);

/**
 * @route   PUT /api/threads/:id/lock
 * @desc    Lock/unlock a thread
 * @access  Admin/Moderator
 */
router.put('/threads/:id/lock', auth, checkPermission('moderateThreads'), threadController.toggleThreadLock);

/**
 * @route   PUT /api/threads/:id/pin
 * @desc    Pin/unpin a thread
 * @access  Admin/Moderator
 */
router.put('/threads/:id/pin', auth, checkPermission('pinThreads'), threadController.toggleThreadPin);

/**
 * @route   PUT /api/threads/:id/move
 * @desc    Move a thread to another forum
 * @access  Admin/Moderator
 */
router.put('/threads/:id/move', auth, checkPermission('moveThreads'), threadController.moveThread);

/**
 * @route   GET /api/threads/search
 * @desc    Search threads
 * @access  Public
 */
router.get('/threads/search', threadController.searchThreads);

/**
 * @route   GET /api/threads/recent
 * @desc    Get recent threads
 * @access  Public
 */
router.get('/threads/recent', threadController.getRecentThreads);

/**
 * @route   GET /api/threads/popular
 * @desc    Get popular threads
 * @access  Public
 */
router.get('/threads/popular', threadController.getPopularThreads);

module.exports = router;