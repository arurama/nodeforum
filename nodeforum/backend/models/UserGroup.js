/**
 * UserGroup Model
 * Defines user groups and their permissions
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserGroup = sequelize.define('UserGroup', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: /^#[0-9A-F]{6}$/i
      }
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'user_groups',
    timestamps: true
  });

  // Instance methods
  
  /**
   * Check if this group has a specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} Whether the group has the permission
   */
  UserGroup.prototype.hasPermission = function(permission) {
    // Extract permission categories
    const categories = permission.split('.');
    
    if (categories.length === 1) {
      // Direct permission check
      return !!this.permissions[permission];
    }
    
    // Navigate nested permissions
    let currentLevel = this.permissions;
    for (const category of categories) {
      if (!currentLevel[category]) {
        return false;
      }
      currentLevel = currentLevel[category];
    }
    
    return true;
  };
  
  /**
   * Get all permissions as a flat array
   */
  UserGroup.prototype.getAllPermissions = function() {
    const result = [];
    
    // Recursive function to flatten nested permissions
    const flattenPermissions = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const permissionKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null) {
          flattenPermissions(value, permissionKey);
        } else if (value === true) {
          result.push(permissionKey);
        }
      }
    };
    
    flattenPermissions(this.permissions);
    return result;
  };
  
  // Class methods
  
  /**
   * Create default user groups when initializing the application
   */
  UserGroup.createDefaultGroups = async function() {
    const defaultGroups = [
      {
        name: 'guest',
        displayName: 'Guest',
        description: 'Unregistered users',
        isDefault: false,
        permissions: {
          forum: {
            viewForums: true,
            viewThreads: true
          }
        }
      },
      {
        name: 'member',
        displayName: 'Member',
        description: 'Regular registered users',
        color: '#3498db',
        isDefault: true,
        permissions: {
          forum: {
            viewForums: true,
            viewThreads: true,
            createThread: true,
            createPost: true
          },
          user: {
            editOwnProfile: true,
            reportContent: true
          }
        }
      },
      {
        name: 'moderator',
        displayName: 'Moderator',
        description: 'Users who can moderate forums',
        color: '#2ecc71',
        isDefault: false,
        permissions: {
          forum: {
            viewForums: true,
            viewThreads: true,
            createThread: true,
            createPost: true,
            editAnyThread: true,
            editAnyPost: true,
            deleteAnyPost: true,
            moderateThreads: true,
            pinThreads: true,
            moveThreads: true
          },
          user: {
            editOwnProfile: true,
            reportContent: true,
            viewUsers: true,
            warnUsers: true
          }
        }
      },
      {
        name: 'administrator',
        displayName: 'Administrator',
        description: 'Users with full administrative privileges',
        color: '#e74c3c',
        isDefault: false,
        permissions: {
          forum: {
            viewForums: true,
            viewThreads: true,
            createThread: true,
            createPost: true,
            editAnyThread: true,
            editAnyPost: true,
            deleteAnyPost: true,
            deleteAnyThread: true,
            moderateThreads: true,
            pinThreads: true,
            moveThreads: true,
            createForum: true,
            updateForum: true,
            deleteForum: true,
            createCategory: true,
            updateCategory: true,
            deleteCategory: true,
            postInLockedThreads: true
          },
          user: {
            editOwnProfile: true,
            editAnyProfile: true,
            reportContent: true,
            viewUsers: true,
            warnUsers: true,
            banUsers: true,
            manageUserGroups: true
          },
          admin: {
            accessAdminPanel: true,
            manageSettings: true,
            viewLogs: true,
            managePlugins: true,
            manageThemes: true
          }
        }
      }
    ];
    
    // Create all default groups if they don't exist
    for (const group of defaultGroups) {
      await UserGroup.findOrCreate({
        where: { name: group.name },
        defaults: group
      });
    }
  };
  
  // Model associations defined in index.js
  
  return UserGroup;
};