const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const slugify = require('slugify');

const Thread = sequelize.define('Thread', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false
  },
  forumId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Forums',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  isSticky: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isLocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  postCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastPostId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  lastPostDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastPostUserId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  hooks: {
    beforeCreate: (thread) => {
      thread.slug = slugify(thread.title, {
        lower: true,
        strict: true
      });
    },
    beforeUpdate: (thread) => {
      if (thread.changed('title')) {
        thread.slug = slugify(thread.title, {
          lower: true,
          strict: true
        });
      }
    }
  }
});

// Define associations in index.js

module.exports = Thread;