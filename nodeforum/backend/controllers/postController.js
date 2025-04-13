/**
 * Post Controller
 * Handles all post-related operations
 */
const { Post, Thread, User, Forum, sequelize } = require('../models');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const { sanitizeHtml } = require('../utils/helpers');
const { validatePostData } = require('../utils/validators');

/**
 * Create a new post in a thread
 */
exports.createPost = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { content } = req.body;
    
    // Validate post data
    const validationErrors = validatePostData(req.body);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }
    
    // Check if thread exists
    const thread = await Thread.findByPk(threadId, {
      include: [{ model: Forum, as: 'forum' }]
    });
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Check if thread is locked
    if (thread.isLocked && !req.user.can('postInLockedThreads')) {
      throw new AuthorizationError('This thread is locked');
    }
    
    // Check if user has permission to post in this forum
    if (!req.user.can('createPost', thread.forum)) {
      throw new AuthorizationError('You do not have permission to post in this forum');
    }
    
    // Sanitize HTML content if needed
    const sanitizedContent = sanitizeHtml(content);
    
    // Create the post
    const post = await Post.create({
      threadId,
      authorId: req.user.id,
      content: sanitizedContent
    });
    
    // Update thread's last post info and increment reply count
    thread.lastPostId = post.id;
    thread.lastPostAt = new Date();
    thread.replyCount += 1;
    await thread.save();
    
    // Update forum's last post info
    thread.forum.lastPostAt = new Date();
    thread.forum.lastThreadId = thread.id;
    await thread.forum.save();
    
    // Get the post with author information
    const createdPost = await Post.findByPk(post.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'avatar', 'signature', 'createdAt', 'postCount']
      }]
    });
    
    res.status(201).json(createdPost);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a post
 */
exports.updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Validate post data
    const validationErrors = validatePostData(req.body);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }
    
    // Find the post
    const post = await Post.findByPk(id, {
      include: [
        { 
          model: Thread, 
          as: 'thread',
          include: [{ model: Forum, as: 'forum' }]
        },
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'avatar', 'signature']
        }
      ]
    });
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    
    // Check if user has permission to edit this post
    const canEdit = 
      post.authorId === req.user.id || 
      req.user.can('editAnyPost');
    
    if (!canEdit) {
      throw new AuthorizationError('You do not have permission to edit this post');
    }
    
    // Check edit time limit for regular users
    const editTimeLimit = 30 * 60 * 1000; // 30 minutes in milliseconds
    const isWithinTimeLimit = 
      (Date.now() - new Date(post.createdAt).getTime()) < editTimeLimit;
    
    if (post.authorId === req.user.id && !isWithinTimeLimit && !req.user.can('editAnyPost')) {
      throw new AuthorizationError('Edit time limit exceeded');
    }
    
    // Sanitize HTML content if needed
    const sanitizedContent = sanitizeHtml(content);
    
    // Update the post
    post.content = sanitizedContent;
    post.isEdited = true;
    post.editedAt = new Date();
    post.editedBy = req.user.id;
    
    await post.save();
    
    res.json(post);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a post
 */
exports.deletePost = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // Find the post
    const post = await Post.findByPk(id, {
      include: [{ 
        model: Thread, 
        as: 'thread',
        include: [{ model: Forum, as: 'forum' }]
      }]
    });
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    
    // Check if user has permission to delete this post
    const canDelete = 
      post.authorId === req.user.id || 
      req.user.can('deleteAnyPost');
    
    if (!canDelete) {
      throw new AuthorizationError('You do not have permission to delete this post');
    }
    
    // Check if this is the first post (thread starter)
    const isFirstPost = await Post.findOne({
      where: { threadId: post.threadId },
      order: [['createdAt', 'ASC']]
    }).then(firstPost => firstPost.id === post.id);
    
    // If it's the first post, delete the entire thread
    if (isFirstPost) {
      if (!req.user.can('deleteThread')) {
        throw new AuthorizationError('You do not have permission to delete threads');
      }
      
      // Delete all posts in the thread
      await Post.destroy({
        where: { threadId: post.threadId },
        transaction
      });
      
      // Delete the thread
      await post.thread.destroy({ transaction });
      
      // Update forum post count
      const forum = post.thread.forum;
      await forum.decrement('threadCount', { transaction });
      
      // Update last thread in forum if needed
      if (forum.lastThreadId === post.threadId) {
        const lastThread = await Thread.findOne({
          where: { forumId: forum.id },
          order: [['updatedAt', 'DESC']]
        });
        
        if (lastThread) {
          forum.lastThreadId = lastThread.id;
          forum.lastPostAt = lastThread.updatedAt;
        } else {
          forum.lastThreadId = null;
          forum.lastPostAt = null;
        }
        
        await forum.save({ transaction });
      }
    } else {
      // Just delete the post
      await post.destroy({ transaction });
      
      // Update thread post count
      await post.thread.decrement('replyCount', { transaction });
      
      // Update last post in thread if needed
      if (post.thread.lastPostId === post.id) {
        const lastPost = await Post.findOne({
          where: { threadId: post.threadId },
          order: [['createdAt', 'DESC']]
        });
        
        if (lastPost) {
          post.thread.lastPostId = lastPost.id;
          post.thread.lastPostAt = lastPost.createdAt;
          await post.thread.save({ transaction });
        }
      }
    }
    
    await transaction.commit();
    
    res.status(200).json({ 
      message: isFirstPost ? 'Thread deleted successfully' : 'Post deleted successfully',
      isThreadDeleted: isFirstPost
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Report a post
 */
exports.reportPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      throw new ValidationError('Reason is required');
    }
    
    const post = await Post.findByPk(id);
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    
    // Create report in database
    await post.createReport({
      reporterId: req.user.id,
      reason,
      status: 'pending'
    });
    
    res.status(201).json({ message: 'Post reported successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Like/unlike a post
 */
exports.toggleLike = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const post = await Post.findByPk(id);
    
    if (!post) {
      throw new NotFoundError('Post not found');
    }
    
    // Check if user has already liked this post
    const hasLiked = await post.hasLiker(req.user.id);
    
    if (hasLiked) {
      // Unlike
      await post.removeLiker(req.user.id);
      await post.decrement('likeCount');
    } else {
      // Like
      await post.addLiker(req.user.id);
      await post.increment('likeCount');
    }
    
    // Refresh post data
    await post.reload();
    
    res.json({
      id: post.id,
      likeCount: post.likeCount,
      hasLiked: !hasLiked
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get posts with pagination for a thread
 */
exports.getPostsByThread = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Check if thread exists
    const thread = await Thread.findByPk(threadId, {
      include: [{
        model: Forum,
        as: 'forum'
      }, {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'avatar']
      }]
    });
    
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }
    
    // Get posts with pagination
    const { count, rows: posts } = await Post.findAndCountAll({
      where: { threadId },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'avatar', 'signature', 'createdAt', 'postCount', 'groupId']
      }],
      order: [['createdAt', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // For each post, check if the current user has liked it
    if (req.user) {
      for (const post of posts) {
        post.dataValues.hasLiked = await post.hasLiker(req.user.id);
      }
    }
    
    // Increment view count
    thread.viewCount += 1;
    await thread.save();
    
    res.json({
      thread,
      posts,
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