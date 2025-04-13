const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const slugify = require('slugify');

const Forum = sequelize.define('Forum', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Forums',
      key: 'id'
    }
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isCategory: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  threadCount: {
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
  },
  lastThreadId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  lastThreadTitle: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  hooks: {
    beforeCreate: (forum) => {
      forum.slug = slugify(forum.name, {
        lower: true,
        strict: true
      });
    },
    beforeUpdate: (forum) => {
      if (forum.changed('name')) {
        forum.slug = slugify(forum.name, {
          lower: true,
          strict: true
        });
      }
    }
  }
});

// Define associations in index.js

module.exports = Forum;