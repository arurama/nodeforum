const sequelize = require('../config/database');
const User = require('./User');
const Forum = require('./Forum');
const Thread = require('./Thread');
const Post = require('./Post');
const Message = require('./Message');
const UserGroup = require('./UserGroup');

// Define associations

// User associations
User.hasMany(Thread, { foreignKey: 'userId' });
User.hasMany(Post, { foreignKey: 'userId' });
User.hasMany(Message, { foreignKey: 'senderId', as: 'SentMessages' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'ReceivedMessages' });
User.belongsToMany(UserGroup, { through: 'UserGroupMemberships', foreignKey: 'userId' });

// Forum associations
Forum.belongsTo(Forum, { as: 'Parent', foreignKey: 'parentId' });
Forum.hasMany(Forum, { as: 'Subforums', foreignKey: 'parentId' });
Forum.hasMany(Thread, { foreignKey: 'forumId' });

// Thread associations
Thread.belongsTo(User, { foreignKey: 'userId' });
Thread.belongsTo(Forum, { foreignKey: 'forumId' });
Thread.hasMany(Post, { foreignKey: 'threadId' });
Thread.belongsTo(User, { as: 'LastPoster', foreignKey: 'lastPostUserId' });

// Post associations
Post.belongsTo(User, { foreignKey: 'userId' });
Post.belongsTo(Thread, { foreignKey: 'threadId' });
Post.belongsTo(User, { as: 'Editor', foreignKey: 'editedBy' });

// Message associations
Message.belongsTo(User, { as: 'Sender', foreignKey: 'senderId' });
Message.belongsTo(User, { as: 'Receiver', foreignKey: 'receiverId' });

// UserGroup associations
UserGroup.belongsToMany(User, { through: 'UserGroupMemberships', foreignKey: 'groupId' });

module.exports = {
  sequelize,
  User,
  Forum,
  Thread,
  Post,
  Message,
  UserGroup
};