/**
 * User Controller
 * Handles user-related operations including authentication, profile management, and admin functions
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { User, UserGroup, Post, Thread, sequelize } = require('../models');
const { ValidationError, NotFoundError, AuthorizationError, AuthenticationError } = require('../utils/errors');
const { validateUserData, validatePasswordChange } = require('../utils/validators');
const { sanitizeHtml, generateVerificationToken } = require('../utils/helpers');
const config = require('../config/config');

/**
 * Register a new user
 */
exports.register = async (req, res, next) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    
    // Validate user data
    const validationErrors = validateUserData(req.body);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }
    
    // Check if password and confirm password match
    if (password !== confirmPassword) {
      throw new ValidationError('Passwords do not match');
    }
    
    // Check if username already exists
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      throw new ValidationError('Username is already taken');
    }
    
    // Check if email already exists
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      throw new ValidationError('Email is already registered');
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Get default user group
    const defaultGroup = await UserGroup.findOne({
      where: { name: config.forum.defaultUserGroup }
    });
    
    if (!defaultGroup) {
      throw new Error('Default user group not found');
    }
    
    // Create verification token if email verification is required
    let verificationToken = null;
    if (config.forum.requireEmailVerification) {
      verificationToken = generateVerificationToken();
    }
    
    // Create the user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      groupId: defaultGroup.id,
      isActive: !config.forum.requireEmailVerification,
      verificationToken,
      postCount: 0,
      signature: '',
      avatar: null
    });
    
    // Remove password from response
    const userData = user.toJSON();
    delete userData.password;
    delete userData.verificationToken;
    
    // If email verification is required, send verification email
    if (config.forum.requireEmailVerification) {
      // TODO: Implement email sending functionality
      // This would typically use a library like nodemailer
      console.log(`Verification link: ${config.app.frontendUrl}/verify-email/${verificationToken}`);
    }
    
    // Generate JWT token if user doesn't need email verification
    let token = null;
    if (!config.forum.requireEmailVerification) {
      token = jwt.sign(
        { id: user.id, username: user.username, groupId: user.groupId },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );
    }
    
    res.status(201).json({
      user: userData,
      token,
      requiresVerification: config.forum.requireEmailVerification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * User login
 */
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Check if username and password are provided
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }
    
    // Find user by username
    const user = await User.findOne({ 
      where: { username },
      include: [{ model: UserGroup, as: 'group' }]
    });
    
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Check if account is active
    if (!user.isActive) {
      throw new AuthenticationError('Account is not active. Please verify your email.');
    }
    
    // Check if account is banned
    if (user.isBanned) {
      throw new AuthenticationError('This account has been banned. Reason: ' + (user.banReason || 'No reason provided'));
    }
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        groupId: user.groupId,
        permissions: user.group.permissions
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    // Update last login time
    user.lastLoginAt = new Date();
    await user.save();
    
    // Remove sensitive information from response
    const userData = user.toJSON();
    delete userData.password;
    delete userData.verificationToken;
    
    res.json({
      user: userData,
      token
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email address
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      throw new ValidationError('Verification token is required');
    }
    
    // Find user with this verification token
    const user = await User.findOne({
      where: { verificationToken: token }
    });
    
    if (!user) {
      throw new ValidationError('Invalid verification token');
    }
    
    // Activate the account
    user.isActive = true;
    user.verificationToken = null;
    await user.save();
    
    // Generate JWT token
    const authToken = jwt.sign(
      { id: user.id, username: user.username, groupId: user.groupId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    res.json({
      message: 'Email verified successfully',
      token: authToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's profile
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: UserGroup, as: 'group' }],
      attributes: { exclude: ['password', 'verificationToken'] }
    });
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * Get user profile by username or ID
 */
exports.getUserProfile = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    
    let user;
    
    // Check if identifier is numeric (ID) or string (username)
    if (/^\d+$/.test(identifier)) {
      user = await User.findByPk(identifier, {
        include: [{ model: UserGroup, as: 'group' }],
        attributes: { exclude: ['password', 'email', 'verificationToken'] }
      });
    } else {
      user = await User.findOne({
        where: { username: identifier },
        include: [{ model: UserGroup, as: 'group' }],
        attributes: { exclude: ['password', 'email', 'verificationToken'] }
      });
    }
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Get user's latest threads
    const recentThreads = await Thread.findAll({
      where: { authorId: user.id },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'avatar']
      }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    // Get user's latest posts
    const recentPosts = await Post.findAll({
      where: { authorId: user.id },
      include: [{
        model: Thread,
        as: 'thread',
        attributes: ['id', 'title']
      }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    res.json({
      user,
      recentThreads,
      recentPosts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { signature, about } = req.body;
    
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Update signature if provided
    if (signature !== undefined) {
      // Sanitize HTML content
      const sanitizedSignature = sanitizeHtml(signature);
      
      // Check if signature is within length limit
      if (sanitizedSignature.length > config.forum.signatureMaxLength) {
        throw new ValidationError(`Signature cannot exceed ${config.forum.signatureMaxLength} characters`);
      }
      
      user.signature = sanitizedSignature;
    }
    
    // Update about section if provided
    if (about !== undefined) {
      user.about = sanitizeHtml(about);
    }
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        username: user.username,
        signature: user.signature,
        about: user.about
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload avatar
 */
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }
    
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Check file size
    if (req.file.size > config.forum.avatarMaxSize) {
      // Remove the uploaded file
      fs.unlinkSync(req.file.path);
      throw new ValidationError(`Avatar cannot exceed ${config.forum.avatarMaxSize / (1024 * 1024)}MB`);
    }
    
    // Check file type (should be image)
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validMimeTypes.includes(req.file.mimetype)) {
      // Remove the uploaded file
      fs.unlinkSync(req.file.path);
      throw new ValidationError('Only JPEG, PNG, and GIF images are allowed');
    }
    
    // Delete previous avatar if it exists
    if (user.avatar && !user.avatar.startsWith('http')) {
      const oldAvatarPath = path.join(config.app.uploadDir, user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }
    
    // Set the new avatar path
    const avatarPath = req.file.filename;
    user.avatar = avatarPath;
    await user.save();
    
    res.json({
      message: 'Avatar uploaded successfully',
      avatar: `${config.app.baseUrl}/uploads/${avatarPath}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Validate password change data
    const validationErrors = validatePasswordChange(req.body);
    if (validationErrors.length > 0) {
      throw new ValidationError('Validation failed', validationErrors);
    }
    
    // Check if new password matches confirmation
    if (newPassword !== confirmPassword) {
      throw new ValidationError('New passwords do not match');
    }
    
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new ValidationError('Current password is incorrect');
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    user.password = hashedPassword;
    await user.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * User logout (client-side only)
 */
exports.logout = (req, res) => {
  res.json({ message: 'Logout successful' });
};

/**
 * Ban a user (admin only)
 */
exports.banUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, duration } = req.body;
    
    // Check if user has permission to ban users
    if (!req.user.can('banUsers')) {
      throw new AuthorizationError('You do not have permission to ban users');
    }
    
    const user = await User.findByPk(id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Cannot ban administrators
    const adminGroup = await UserGroup.findOne({ where: { name: 'administrator' } });
    if (user.groupId === adminGroup.id) {
      throw new AuthorizationError('Cannot ban an administrator');
    }
    
    // Set ban details
    user.isBanned = true;
    user.banReason = reason || 'No reason provided';
    
    if (duration) {
      const banEnd = new Date();
      banEnd.setDate(banEnd.getDate() + parseInt(duration));
      user.banExpiresAt = banEnd;
    } else {
      user.banExpiresAt = null; // Permanent ban
    }
    
    await user.save();
    
    res.json({
      message: 'User banned successfully',
      user: {
        id: user.id,
        username: user.username,
        isBanned: user.isBanned,
        banReason: user.banReason,
        banExpiresAt: user.banExpiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unban a user (admin only)
 */
exports.unbanUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user has permission to unban users
    if (!req.user.can('banUsers')) {
      throw new AuthorizationError('You do not have permission to unban users');
    }
    
    const user = await User.findByPk(id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Remove ban
    user.isBanned = false;
    user.banReason = null;
    user.banExpiresAt = null;
    
    await user.save();
    
    res.json({
      message: 'User unbanned successfully',
      user: {
        id: user.id,
        username: user.username,
        isBanned: user.isBanned
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change user group (admin only)
 */
exports.changeUserGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { groupId } = req.body;
    
    // Check if user has permission to manage user groups
    if (!req.user.can('manageUserGroups')) {
      throw new AuthorizationError('You do not have permission to change user groups');
    }
    
    if (!groupId) {
      throw new ValidationError('Group ID is required');
    }
    
    const user = await User.findByPk(id);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Check if the group exists
    const group = await UserGroup.findByPk(groupId);
    
    if (!group) {
      throw new NotFoundError('User group not found');
    }
    
    // Cannot demote oneself
    if (user.id === req.user.id && group.name !== 'administrator') {
      throw new AuthorizationError('You cannot demote yourself from administrator');
    }
    
    // Update user's group
    user.groupId = groupId;
    await user.save();
    
    res.json({
      message: 'User group changed successfully',
      user: {
        id: user.id,
        username: user.username,
        groupId: user.groupId
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users (admin/moderator only)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    
    // Check if user has permission to view all users
    if (!req.user.can('viewUsers')) {
      throw new AuthorizationError('You do not have permission to view all users');
    }
    
    // Build query based on search parameter
    let where = {};
    if (search) {
      where = {
        [sequelize.Op.or]: [
          { username: { [sequelize.Op.iLike]: `%${search}%` } },
          { email: { [sequelize.Op.iLike]: `%${search}%` } }
        ]
      };
    }
    
    // Get users with pagination
    const { count, rows: users } = await User.findAndCountAll({
      where,
      include: [{ model: UserGroup, as: 'group' }],
      attributes: { exclude: ['password', 'verificationToken'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      users,
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
 * Request password reset
 */
exports.requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      throw new ValidationError('Email is required');
    }
    
    // Find user by email
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      // Don't reveal that the email doesn't exist for security reasons
      return res.json({ message: 'If your email is registered, you will receive a password reset link' });
    }
    
    // Generate reset token
    const resetToken = generateVerificationToken();
    
    // Set token and expiration
    user.resetToken = resetToken;
    user.resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();
    
    // TODO: Send email with reset link
    // This would typically use a library like nodemailer
    console.log(`Password reset link: ${config.app.frontendUrl}/reset-password/${resetToken}`);
    
    res.json({ message: 'If your email is registered, you will receive a password reset link' });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    
    if (!token) {
      throw new ValidationError('Reset token is required');
    }
    
    if (!password || !confirmPassword) {
      throw new ValidationError('Password and confirm password are required');
    }
    
    if (password !== confirmPassword) {
      throw new ValidationError('Passwords do not match');
    }
    
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }
    
    // Find user with this reset token
    const user = await User.findOne({
      where: { 
        resetToken: token,
        resetTokenExpiresAt: { [sequelize.Op.gt]: new Date() }
      }
    });
    
    if (!user) {
      throw new ValidationError('Invalid or expired reset token');
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiresAt = null;
    await user.save();
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};