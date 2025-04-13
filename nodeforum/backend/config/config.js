/**
 * Database and application configuration
 * This file contains configuration for PostgreSQL and other application settings
 */

module.exports = {
  // Database configuration
  database: {
    development: {
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'nodeforum_dev',
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: console.log,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    },
    test: {
      username: process.env.TEST_DB_USERNAME || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
      database: process.env.TEST_DB_NAME || 'nodeforum_test',
      host: process.env.TEST_DB_HOST || '127.0.0.1',
      port: process.env.TEST_DB_PORT || 5432,
      dialect: 'postgres',
      logging: false
    },
    production: {
      username: process.env.PROD_DB_USERNAME,
      password: process.env.PROD_DB_PASSWORD,
      database: process.env.PROD_DB_NAME,
      host: process.env.PROD_DB_HOST,
      port: process.env.PROD_DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'nodeforum-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // Application settings
  app: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || 'http://localhost:5000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    uploadDir: process.env.UPLOAD_DIR || 'uploads'
  },
  
  // Email configuration
  email: {
    service: process.env.EMAIL_SERVICE || 'smtp',
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASSWORD || ''
    },
    from: process.env.EMAIL_FROM || 'NodeForum '
  },
  
  // Forum settings
  forum: {
    // Default pagination settings
    defaultPageSize: 20,
    maxPageSize: 100,
    
    // Default user settings
    signatureMaxLength: 500,
    avatarMaxSize: 2 * 1024 * 1024, // 2MB
    
    // Content settings
    allowHTML: false,
    allowAttachments: true,
    maxAttachmentSize: 5 * 1024 * 1024, // 5MB
    
    // New user defaults
    defaultUserGroup: 'member',
    requireEmailVerification: true,
    
    // Private messaging
    maxPMsPerUser: 100
  }
};