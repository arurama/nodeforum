/**
 * Message Routes
 * Handles routing for private messaging
 */
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middlewares/auth');

/**
 * @route   GET /api/messages
 * @desc    Get all messages for the current user
 * @access  Private
 */
router.get('/', auth, messageController.getMessages);

/**
 * @route   GET /api/messages/:id
 * @desc    Get a single message
 * @access  Private
 */
router.get('/:id', auth, messageController.getMessage);

/**
 * @route   POST /api/messages
 * @desc    Send a new message
 * @access  Private
 */
router.post('/', auth, messageController.sendMessage);

/**
 * @route   PUT /api/messages/:id/move
 * @desc    Move message to a folder
 * @access  Private
 */
router.put('/:id/move', auth, messageController.moveMessage);

/**
 * @route   PUT /api/messages/:id/read
 * @desc    Mark message as read/unread
 * @access  Private
 */
router.put('/:id/read', auth, messageController.toggleRead);

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete a message
 * @access  Private
 */
router.delete('/:id', auth, messageController.deleteMessage);

/**
 * @route   POST /api/messages/folders
 * @desc    Create a new message folder
 * @access  Private
 */
router.post('/folders', auth, messageController.createFolder);

/**
 * @route   DELETE /api/messages/folders/:id
 * @desc    Delete a message folder
 * @access  Private
 */
router.delete('/folders/:id', auth, messageController.deleteFolder);

module.exports = router;