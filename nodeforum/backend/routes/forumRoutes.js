/**
 * Forum Routes
 * Handles routing for categories, forums, and subforums
 */
const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const auth = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/permissions');

/**
 * @route   GET /api/forums
 * @desc    Get all categories with forums and subforums
 * @access  Public
 */
router.get('/', forumController.getAllCategories);

/**
 * @route   GET /api/forums/:id
 * @desc    Get a single forum with its threads
 * @access  Public
 */
router.get('/:id', forumController.getForumById);

/**
 * @route   POST /api/forums/categories
 * @desc    Create a new category
 * @access  Admin only
 */
router.post('/categories', auth, checkPermission('createCategory'), forumController.createCategory);

/**
 * @route   PUT /api/forums/categories/:id
 * @desc    Update a category
 * @access  Admin only
 */
router.put('/categories/:id', auth, checkPermission('updateCategory'), forumController.updateCategory);

/**
 * @route   DELETE /api/forums/categories/:id
 * @desc    Delete a category
 * @access  Admin only
 */
router.delete('/categories/:id', auth, checkPermission('deleteCategory'), forumController.deleteCategory);

/**
 * @route   POST /api/forums
 * @desc    Create a new forum
 * @access  Admin only
 */
router.post('/', auth, checkPermission('createForum'), forumController.createForum);

/**
 * @route   PUT /api/forums/:id
 * @desc    Update a forum
 * @access  Admin only
 */
router.put('/:id', auth, checkPermission('updateForum'), forumController.updateForum);

/**
 * @route   DELETE /api/forums/:id
 * @desc    Delete a forum
 * @access  Admin only
 */
router.delete('/:id', auth, checkPermission('deleteForum'), forumController.deleteForum);

module.exports = router;