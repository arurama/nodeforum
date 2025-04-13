/**
 * Thread Controller
 * Handles all thread-related operations
 */
const { Thread, Post, User, Forum, Tag, sequelize } = require('../models');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const { sanitizeHtml } = require('../utils/helpers');
const { validateThreadData } = require('../utils/validators');

/**
 * Create a new thread
 */
exports.createThread = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { forumId } = req.params;
    const { title, content, tags = [] } = req.body;
    
    // Validate thread data
    const validationErrors = validateThreadData(req.body);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }
    
    // Check if forum exists
    const forum = await Forum.findByPk(forumId);
    
    if (!forum) {
      throw new NotFoundError('Forum not found');
    }
    
    // Check if user has permission to create threads in this forum
    if (!req.user.can('createThread', forum)) {
      throw new AuthorizationError('You do not have permission to create threads in this forum');
    }
    
    // Sanitize HTML content if needed
    const sanitizedContent = sanitizeHtml(content);
    
    // Create the thread
    const thread = await Thread.create({
      title,
      forumId,
      authorId: req.user.id,
      isLocked: false,
      isPinned: false,
      viewCount: 0,
      replyCount: 0
    }, { transaction });
    
    // Create the first post
    const post = await Post.create({
      threadId: thread.id,
      authorId: req.user.id,
      content: sanitizedContent
    }, { transaction });
    
    // Update thread with first post info
    thread.firstPostId = post.id;
    thread.lastPostId = post.id;
    thread.lastPostAt = new Date();
    await thread.save({ transaction });
    
    // Add tags if provided
    if (tags.length > 0) {
      // Find or create tags
      const tagPromises = tags.map(async (tagName) => {
        const [tag] = await Tag.findOrCreate({
          where: { name: tagName.trim().toLowerCase() },
          defaults: { name: tagName.trim() },
          transaction
        });
        return tag;
      });
      
      const createdTags = await Promise.all(tagPromises);
      await thread.setTags(createdTags, { transaction });
    }
    
    // Update forum post count and last thread info
    await forum.increment('threadCount', { transaction });
    forum.lastThreadId = thread.id;
    forum.lastPostAt = new Date();
    await forum.save({ transaction });
    
    // Increment user's post count
    await req.user.increment('postCount', { transaction });
    
    await transaction.commit();
    
    // Get the complete thread with related data
    const createdThread = await Thread.findByPk(thread.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: Forum,
          as: 'forum',
          attributes: ['id', 'name', 'description']
        },
        {
          model: Post,
          as: 'firstPost',
          include: [{
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'avatar', 'signature']
          }]
        },
        {
          model: Tag,
          as: 'tags',
          attributes: ['id', 'name'],
          through: { attributes: [] }
        }
      ]
    });
    
    res.status(201).json(createdThread);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Get a single thread with its first post
 */
exports.getThread = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const thread = await Thread.findByPk(id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: Forum,
          as: 'forum',
          attributes: ['id', 'name', 'description', 'categoryId']
        },
        {
          model: Post,
          as: 'firstPost',
          include: [{
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'avatar', 'signature', 'postCount', 'createdAt']
          }]
        },
        {
          model: Tag,
          as: 'tags',
          attributes: ['id', 'name'],
          through: { attributes: [] }
        }
      ]
    });
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Increment view count
    thread.viewCount += 1;
    await thread.save();
    
    res.json(thread);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a thread
 */
exports.updateThread = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { title, tags } = req.body;
    
    // Find the thread
    const thread = await Thread.findByPk(id, {
      include: [
        {
          model: User,
          as: 'author'
        },
        {
          model: Forum,
          as: 'forum'
        }
      ]
    });
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Check if user has permission to update this thread
    const canUpdate = 
      thread.authorId === req.user.id || 
      req.user.can('updateAnyThread');
    
    if (!canUpdate) {
      throw new AuthorizationError('You do not have permission to update this thread');
    }
    
    // Update thread
    if (title) {
      thread.title = title;
    }
    
    await thread.save({ transaction });
    
    // Update tags if provided
    if (tags !== undefined) {
      // Find or create tags
      const tagPromises = tags.map(async (tagName) => {
        const [tag] = await Tag.findOrCreate({
          where: { name: tagName.trim().toLowerCase() },
          defaults: { name: tagName.trim() },
          transaction
        });
        return tag;
      });
      
      const newTags = await Promise.all(tagPromises);
      await thread.setTags(newTags, { transaction });
    }
    
    await transaction.commit();
    
    // Get the updated thread with related data
    const updatedThread = await Thread.findByPk(thread.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: Forum,
          as: 'forum',
          attributes: ['id', 'name', 'description']
        },
        {
          model: Tag,
          as: 'tags',
          attributes: ['id', 'name'],
          through: { attributes: [] }
        }
      ]
    });
    
    res.json(updatedThread);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Lock/unlock a thread
 */
exports.toggleThreadLock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body;
    
    if (isLocked === undefined) {
      throw new ValidationError('isLocked field is required');
    }
    
    // Check if user has permission to lock/unlock threads
    if (!req.user.can('moderateThreads')) {
      throw new AuthorizationError('You do not have permission to lock or unlock threads');
    }
    
    const thread = await Thread.findByPk(id);
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    thread.isLocked = isLocked;
    await thread.save();
    
    res.json(thread);
  } catch (error) {
    next(error);
  }
};

/**
 * Pin/unpin a thread
 */
exports.toggleThreadPin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isPinned } = req.body;
    
    if (isPinned === undefined) {
      throw new ValidationError('isPinned field is required');
    }
    
    // Check if user has permission to pin/unpin threads
    if (!req.user.can('pinThreads')) {
      throw new AuthorizationError('You do not have permission to pin or unpin threads');
    }
    
    const thread = await Thread.findByPk(id);
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    thread.isPinned = isPinned;
    await thread.save();
    
    res.json(thread);
  } catch (error) {
    next(error);
  }
};

/**
 * Move a thread to another forum
 */
exports.moveThread = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetForumId } = req.body;
    
    if (!targetForumId) {
      throw new ValidationError('Target forum ID is required');
    }
    
    // Check if user has permission to move threads
    if (!req.user.can('moveThreads')) {
      throw new AuthorizationError('You do not have permission to move threads');
    }
    
    // Check if thread exists
    const thread = await Thread.findByPk(id, {
      include: [{ model: Forum, as: 'forum' }]
    });
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Check if target forum exists
    const targetForum = await Forum.findByPk(targetForumId);
    
    if (!targetForum) {
      throw new NotFoundError('Target forum not found');
    }
    
    // Update thread's forum
    const oldForumId = thread.forumId;
    thread.forumId = targetForumId;
    await thread.save();
    
    // Update thread counts for both forums
    await Forum.decrement('threadCount', { where: { id: oldForumId } });
    await Forum.increment('threadCount', { where: { id: targetForumId } });
    
    // Update last thread information for old forum if needed
    if (thread.forum.lastThreadId === thread.id) {
      const lastThread = await Thread.findOne({
        where: { forumId: oldForumId },
        order: [['updatedAt', 'DESC']]
      });
      
      if (lastThread) {
        await Forum.update(
          { 
            lastThreadId: lastThread.id,
            lastPostAt: lastThread.updatedAt
          },
          { where: { id: oldForumId } }
        );
      } else {
        await Forum.update(
          { lastThreadId: null, lastPostAt: null },
          { where: { id: oldForumId } }
        );
      }
    }
    
    // Update last thread information for new forum if needed
    const lastThreadInTargetForum = await Thread.findOne({
      where: { forumId: targetForumId },
      order: [['updatedAt', 'DESC']]
    });
    
    if (!targetForum.lastThreadId || 
        (lastThreadInTargetForum && 
         new Date(lastThreadInTargetForum.updatedAt) > new Date(targetForum.lastPostAt || 0))) {
      await Forum.update(
        { 
          lastThreadId: lastThreadInTargetForum.id,
          lastPostAt: lastThreadInTargetForum.updatedAt
        },
        { where: { id: targetForumId } }
      );
    }
    
    res.json({
      ...thread.toJSON(),
      forum: targetForum
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a thread
 */
exports.deleteThread = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // Find the thread
    const thread = await Thread.findByPk(id, {
      include: [{ model: Forum, as: 'forum' }]
    });
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Check if user has permission to delete this thread
    const canDelete = 
      thread.authorId === req.user.id || 
      req.user.can('deleteAnyThread');
    
    if (!canDelete) {
      throw new AuthorizationError('You do not have permission to delete this thread');
    }
    
    // Delete all posts in the thread
    await Post.destroy({
      where: { threadId: id },
      transaction
    });
    
    // Remove tag associations
    await thread.setTags([], { transaction });
    
    // Delete the thread
    await thread.destroy({ transaction });
    
    // Update forum thread count
    await thread.forum.decrement('threadCount', { transaction });
    
    // Update last thread in forum if needed
    if (thread.forum.lastThreadId === thread.id) {
      const lastThread = await Thread.findOne({
        where: { forumId: thread.forum.id },
        order: [['updatedAt', 'DESC']]
      });
      
      if (lastThread) {
        thread.forum.lastThreadId = lastThread.id;
        thread.forum.lastPostAt = lastThread.updatedAt;
      } else {
        thread.forum.lastThreadId = null;
        thread.forum.lastPostAt = null;
      }
      
      await thread.forum.save({ transaction });
    }
    
    await transaction.commit();
    
    res.status(200).json({ message: 'Thread deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Search threads
 */
exports.searchThreads = async (req, res, next) => {
  try {
    const { query, forumId, tagId, authorId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Build search conditions
    const where = {};
    const include = [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'avatar']
      },
      {
        model: Forum,
        as: 'forum',
        attributes: ['id', 'name', 'description']
      },
      {
        model: Post,
        as: 'firstPost'
      }
    ];
    
    if (query) {
      where[sequelize.Op.or] = [
        { title: { [sequelize.Op.iLike]: `%${query}%` } },
        { '$firstPost.content$': { [sequelize.Op.iLike]: `%${query}%` } }
      ];
    }
    
    if (forumId) {
      where.forumId = forumId;
    }
    
    if (authorId) {
      where.authorId = authorId;
    }
    
    if (tagId) {
      include.push({
        model: Tag,
        as: 'tags',
        attributes: ['id', 'name'],
        through: { attributes: [] },
        where: { id: tagId }
      });
    } else {
      include.push({
        model: Tag,
        as: 'tags',
        attributes: ['id', 'name'],
        through: { attributes: [] },
        required: false
      });
    }
    
    // Execute search with pagination
    const { count, rows: threads } = await Thread.findAndCountAll({
      where,
      include,
      distinct: true,
      order: [['isPinned', 'DESC'], ['updatedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
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
 * Get recent threads
 */
exports.getRecentThreads = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    
    const threads = await Thread.findAll({
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: Forum,
          as: 'forum',
          attributes: ['id', 'name']
        },
        {
          model: Post,
          as: 'lastPost',
          include: [{
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'avatar']
          }]
        }
      ],
      order: [['lastPostAt', 'DESC']],
      limit: parseInt(limit)
    });
    
    res.json(threads);
  } catch (error) {
    next(error);
  }
};

/**
 * Get popular threads
 */
exports.getPopularThreads = async (req, res, next) => {
  try {
    const { period = 'week', limit = 10 } = req.query;
    
    let dateFilter = new Date();
    
    switch (period) {
      case 'day':
        dateFilter.setDate(dateFilter.getDate() - 1);
        break;
      case 'week':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case 'month':
        dateFilter.setMonth(dateFilter.getMonth() - 1);
        break;
      case 'year':
        dateFilter.setFullYear(dateFilter.getFullYear() - 1);
        break;
      default:
        dateFilter.setDate(dateFilter.getDate() - 7);
    }
    
    const threads = await Thread.findAll({
      where: {
        createdAt: { [sequelize.Op.gte]: dateFilter }
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: Forum,
          as: 'forum',
          attributes: ['id', 'name']
        }
      ],
      order: [
        [sequelize.literal('("viewCount" + "replyCount" * 5)'), 'DESC']
      ],
      limit: parseInt(limit)
    });
    
    res.json(threads);
  } catch (error) {
    next(error);
  }
};