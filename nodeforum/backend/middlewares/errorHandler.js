/**
 * Error handling middleware
 * This middleware handles all errors thrown in the application
 */
const { 
  ValidationError, 
  NotFoundError, 
  AuthorizationError, 
  AuthenticationError 
} = require('../utils/errors');

/**
 * Global error handler
 */
module.exports = (err, req, res, next) => {
  // Log the error for debugging
  console.error(err);
  
  // Check if this is a known error type
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }
  
  if (err instanceof AuthenticationError) {
    return res.status(401).json({
      error: 'Authentication Error',
      message: err.message
    });
  }
  
  if (err instanceof AuthorizationError) {
    return res.status(403).json({
      error: 'Authorization Error',
      message: err.message
    });
  }
  
  if (err instanceof NotFoundError) {
    return res.status(404).json({
      error: 'Not Found',
      message: err.message
    });
  }
  
  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Validation failed',
      details: err.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }
  
  // Handle JWT authentication errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Token expired'
    });
  }
  
  // For multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File Error',
      message: 'File size exceeds the limit'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'File Error',
      message: 'Unexpected file field'
    });
  }
  
  // Handle other known error types
  if (err.name === 'SyntaxError' && err.status === 400) {
    return res.status(400).json({
      error: 'Syntax Error',
      message: 'Invalid JSON'
    });
  }
  
  // Default to 500 server error
  res.status(500).json({
    error: 'Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message || 'Unknown error'
  });
};