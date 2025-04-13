/**
 * Message Controller
 * Handles all private messaging functionality
 */
const { Message, User, MessageFolder, sequelize } = require('../models');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const config = require('../config/config');

/**
 * Get all messages for the current user
 */
exports.getMessages = async (req, res, next) => {
  try {
    const { folder = 'inbox', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let where = {};
    
    // Filter messages based on the folder
    if (folder === 'inbox') {
      where = { recipientId: req.user.id, recipientDeleted: false };
    } else if (folder === 'sent') {
      where = { senderId: req.user.id, senderDeleted: false };
    } else {
      // Custom folder - get folder ID first
      const messageFolder = await MessageFolder.findOne({
        where: { userId: req.user.id, name: folder }
      });
      
      if (!messageFolder) {
        throw new NotFoundError('Folder not found');
      }
      
      where = { 
        recipientId: req.user.id, 
        recipientDeleted: false,
        folderId: messageFolder.id
      };
    }
    
    // Get messages with pagination
    const { count, rows: messages } = await Message.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'username', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // Get user's folders for the sidebar
    const folders = await MessageFolder.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'name']
    });
    
    // Count unread messages
    const unreadCount = await Message.count({
      where: { 
        recipientId: req.user.id, 
        isRead: false, 
        recipientDeleted: false 
      }
    });
    
    res.json({
      messages,
      folders: [
        { id: 'inbox', name: 'Inbox' },
        { id: 'sent', name: 'Sent' },
        ...folders
      ],
      unreadCount,
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
 * Get a single message
 */
exports.getMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const message = await Message.findByPk(id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'username', 'avatar']
        }
      ]
    });
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }
    
    // Check if user has permission to view this message
    if (message.senderId !== req.user.id && message.recipientId !== req.user.id) {
      throw new AuthorizationError('You do not have permission to view this message');
    }
    
    // If user is the recipient and message is unread, mark as read
    if (message.recipientId === req.user.id && !message.isRead) {
      message.isRead = true;
      await message.save();
    }
    
    res.json(message);
  } catch (error) {
    next(error);
  }
};

/**
 * Send a new message
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { recipientUsername, subject, content } = req.body;
    
    if (!recipientUsername || !subject || !content) {
      throw new ValidationError('Recipient, subject, and content are required');
    }
    
    // Find the recipient
    const recipient = await User.findOne({
      where: { username: recipientUsername }
    });
    
    if (!recipient) {
      throw new NotFoundError('Recipient not found');
    }
    
    // Check if recipient has blocked the sender
    const isBlocked = await recipient.hasBlockedUser(req.user.id);
    if (isBlocked) {
      throw new AuthorizationError('You cannot send messages to this user');
    }
    
    // Check if recipient has reached their message limit
    const messageCount = await Message.count({
      where: { recipientId: recipient.id, recipientDeleted: false }
    });
    
    if (messageCount >= config.forum.maxPMsPerUser) {
      throw new ValidationError('Recipient\'s inbox is full');
    }
    
    // Create the message
    const message = await Message.create({
      senderId: req.user.id,
      recipientId: recipient.id,
      subject,
      content,
      isRead: false,
      senderDeleted: false,
      recipientDeleted: false
    });
    
    // Load sender and recipient details
    const fullMessage = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'avatar']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'username', 'avatar']
        }
      ]
    });
    
    res.status(201).json(fullMessage);
  } catch (error) {
    next(error);
  }
};

/**
 * Move message to a folder
 */
exports.moveMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;
    
    if (!folderId) {
      throw new ValidationError('Folder ID is required');
    }
    
    const message = await Message.findByPk(id);
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }
    
    // Check if user has permission to move this message
    if (message.recipientId !== req.user.id) {
      throw new AuthorizationError('You do not have permission to move this message');
    }
    
    // If folder is not 'inbox' or 'sent', verify folder exists and belongs to user
    if (folderId !== 'inbox' && folderId !== 'sent') {
      const folder = await MessageFolder.findByPk(folderId);
      
      if (!folder) {
        throw new NotFoundError('Folder not found');
      }
      
      if (folder.userId !== req.user.id) {
        throw new AuthorizationError('You do not have permission to use this folder');
      }
      
      // Update the message's folder
      message.folderId = folder.id;
    } else {
      // Reset to default folder (null)
      message.folderId = null;
    }
    
    await message.save();
    
    res.json(message);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new message folder
 */
exports.createFolder = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      throw new ValidationError('Folder name is required');
    }
    
    // Check if folder with this name already exists
    const existingFolder = await MessageFolder.findOne({
      where: { userId: req.user.id, name }
    });
    
    if (existingFolder) {
      throw new ValidationError('A folder with this name already exists');
    }
    
    const folder = await MessageFolder.create({
      userId: req.user.id,
      name
    });
    
    res.status(201).json(folder);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a message folder
 */
exports.deleteFolder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    const folder = await MessageFolder.findByPk(id);
    
    if (!folder) {
      throw new NotFoundError('Folder not found');
    }
    
    if (folder.userId !== req.user.id) {
      throw new AuthorizationError('You do not have permission to delete this folder');
    }
    
    // Move all messages in this folder back to inbox
    await Message.update(
      { folderId: null },
      { 
        where: { folderId: id },
        transaction
      }
    );
    
    // Delete the folder
    await folder.destroy({ transaction });
    
    await transaction.commit();
    
    res.status(200).json({ message: 'Folder deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Delete a message
 */
exports.deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const message = await Message.findByPk(id);
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }
    
    // Mark as deleted for the appropriate user
    if (message.senderId === req.user.id) {
      message.senderDeleted = true;
    } else if (message.recipientId === req.user.id) {
      message.recipientDeleted = true;
    } else {
      throw new AuthorizationError('You do not have permission to delete this message');
    }
    
    // If both sender and recipient have deleted, actually delete from database
    if (message.senderDeleted && message.recipientDeleted) {
      await message.destroy();
    } else {
      await message.save();
    }
    
    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark message as read/unread
 */
exports.toggleRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;
    
    if (isRead === undefined) {
      throw new ValidationError('isRead field is required');
    }
    
    const message = await Message.findByPk(id);
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }
    
    // Check if user has permission to mark this message
    if (message.recipientId !== req.user.id) {
      throw new AuthorizationError('You do not have permission to mark this message');
    }
    
    message.isRead = isRead;
    await message.save();
    
    res.json(message);
  } catch (error) {
    next(error);
  }
};