/**
 * Post Routes
 * Handles routing for individual posts
 */
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/permissions');

/**
 * @route   POST /api/threads/:threadId/posts
 * @desc    Create a new post in a thread
 * @access  Private
 */
router.post('/threads/:threadId/posts', auth, postController.createPost);

/**
 * @route   GET /api/threads/:threadId/posts
 * @desc    Get posts for a thread with pagination
 * @access  Public
 */
router.get('/threads/:threadId/posts', postController.getPostsByThread);

/**
 * @route   PUT /api/posts/:id
 * @desc    Update a post
 * @access  Post author or Admin/Moderator
 */
router.put('/posts/:id', auth, postController.updatePost);

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete a post
 * @access  Post author or Admin/Moderator
 */
router.delete('/posts/:id', auth, postController.deletePost);

/**
 * @route   POST /api/posts/:id/report
 * @desc    Report a post
 * @access  Private
 */
router.post('/posts/:id/report', auth, checkPermission('reportContent'), postController.reportPost);

/**
 * @route   POST /api/posts/:id/like
 * @desc    Like/unlike a post
 * @access  Private
 */
router.post('/posts/:id/like', auth, postController.toggleLike);

module.exports = router;