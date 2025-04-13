/**
 * Forum Controller
 * Handles all forum-related operations including categories, forums, and subforums
 */
const { Forum, Category, Thread, Post, User, sequelize } = require('../models');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const { validateForumData } = require('../utils/validators');

/**
 * Get all categories with forums and subforums
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      include: [{
        model: Forum,
        as: 'forums',
        where: { parentId: null },
        required: false,
        include: [{
          model: Forum,
          as: 'subforums',
          required: false,
          include: [{
            model: Thread,
            as: 'lastThread',
            include: [{
              model: User,
              as: 'author',
              attributes: ['id', 'username', 'avatar']
            }]
          }]
        }, {
          model: Thread,
          as: 'lastThread',
          include: [{
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'avatar']
          }]
        }]
      }],
      order: [
        ['displayOrder', 'ASC'],
        [{ model: Forum, as: 'forums' }, 'displayOrder', 'ASC'],
        [{ model: Forum, as: 'forums' }, { model: Forum, as: 'subforums' }, 'displayOrder', 'ASC']
      ]
    });

    res.json(categories);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single forum with its threads
 */
exports.getForumById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Find the forum
    const forum = await Forum.findByPk(id, {
      include: [{
        model: Forum,
        as: 'subforums',
        required: false
      }]
    });
    
    if (!forum) {
      throw new NotFoundError('Forum not found');
    }
    
    // Get threads for this forum with pagination
    const { count, rows: threads } = await Thread.findAndCountAll({
      where: { forumId: id },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'avatar']
      }, {
        model: Post,
        as: 'lastPost',
        include: [{
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'avatar']
        }]
      }],
      order: [['isPinned', 'DESC'], ['updatedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      forum,
      threads,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new category
 */
exports.createCategory = async (req, res, next) => {
  try {
    // Check if user has permission to create categories
    if (!req.user.can('createCategory')) {
      throw new AuthorizationError('You do not have permission to create categories');
    }
    
    const { name, description, displayOrder } = req.body;
    
    if (!name) {
      throw new ValidationError('Category name is required');
    }
    
    const category = await Category.create({
      name,
      description: description || '',
      displayOrder: displayOrder || 0
    });
    
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new forum
 */
exports.createForum = async (req, res, next) => {
  try {
    // Check if user has permission to create forums
    if (!req.user.can('createForum')) {
      throw new AuthorizationError('You do not have permission to create forums');
    }
    
    const { name, description, categoryId, parentId, displayOrder } = req.body;
    
    // Validate forum data
    const validationErrors = validateForumData(req.body);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }
    
    // Check if category exists if provided
    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }
    
    // Check if parent forum exists if provided
    if (parentId) {
      const parentForum = await Forum.findByPk(parentId);
      if (!parentForum) {
        throw new NotFoundError('Parent forum not found');
      }
    }
    
    const forum = await Forum.create({
      name,
      description: description || '',
      categoryId,
      parentId,
      displayOrder: displayOrder || 0
    });
    
    res.status(201).json(forum);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a forum
 */
exports.updateForum = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user has permission to update forums
    if (!req.user.can('updateForum')) {
      throw new AuthorizationError('You do not have permission to update forums');
    }
    
    const forum = await Forum.findByPk(id);
    if (!forum) {
      throw new NotFoundError('Forum not found');
    }
    
    const { name, description, categoryId, parentId, displayOrder } = req.body;
    
    // Validate forum data
    const validationErrors = validateForumData(req.body);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }
    
    // Update forum
    await forum.update({
      name: name || forum.name,
      description: description !== undefined ? description : forum.description,
      categoryId: categoryId || forum.categoryId,
      parentId: parentId !== undefined ? parentId : forum.parentId,
      displayOrder: displayOrder || forum.displayOrder
    });
    
    res.json(forum);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a forum
 */
exports.deleteForum = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // Check if user has permission to delete forums
    if (!req.user.can('deleteForum')) {
      throw new AuthorizationError('You do not have permission to delete forums');
    }
    
    const forum = await Forum.findByPk(id, {
      include: [{
        model: Forum,
        as: 'subforums'
      }]
    });
    
    if (!forum) {
      throw new NotFoundError('Forum not found');
    }
    
    // Check if forum has subforums
    if (forum.subforums && forum.subforums.length > 0) {
      throw new ValidationError('Cannot delete forum with subforums. Delete subforums first or move them.');
    }
    
    // Delete all threads and posts in this forum
    const threads = await Thread.findAll({
      where: { forumId: id }
    });
    
    for (const thread of threads) {
      await Post.destroy({ 
        where: { threadId: thread.id },
        transaction
      });
      
      await thread.destroy({ transaction });
    }
    
    // Delete the forum
    await forum.destroy({ transaction });
    
    await transaction.commit();
    
    res.status(200).json({ message: 'Forum deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Update category
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user has permission to update categories
    if (!req.user.can('updateCategory')) {
      throw new AuthorizationError('You do not have permission to update categories');
    }
    
    const category = await Category.findByPk(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    
    const { name, description, displayOrder } = req.body;
    
    // Update category
    await category.update({
      name: name || category.name,
      description: description !== undefined ? description : category.description,
      displayOrder: displayOrder || category.displayOrder
    });
    
    res.json(category);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete category
 */
exports.deleteCategory = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // Check if user has permission to delete categories
    if (!req.user.can('deleteCategory')) {
      throw new AuthorizationError('You do not have permission to delete categories');
    }
    
    const category = await Category.findByPk(id, {
      include: [{
        model: Forum,
        as: 'forums'
      }]
    });
    
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    
    // Check if category has forums
    if (category.forums && category.forums.length > 0) {
      throw new ValidationError('Cannot delete category with forums. Delete forums first or move them.');
    }
    
    // Delete the category
    await category.destroy({ transaction });
    
    await transaction.commit();
    
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};