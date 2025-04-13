/**
 * Helper Utilities
 * Common utility functions used throughout the application
 */
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const config = require('../config/config');

/**
 * Sanitize HTML content
 * @param {string} content - HTML content to sanitize
 * @returns {string} Sanitized HTML content
 */
exports.sanitizeHtml = (content) => {
  if (!content) return '';
  
  // Only allow sanitization if forum settings permit HTML
  if (!config.forum.allowHTML) {
    return sanitizeHtml(content, {
      allowedTags: [],
      allowedAttributes: {}
    });
  }
  
  // Allow limited HTML tags for rich content
  return sanitizeHtml(content, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
      'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
      'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'span',
      'img'
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['style', 'class'],
      div: ['style', 'class'],
      p: ['style', 'class'],
      table: ['style', 'class'],
      blockquote: ['style', 'class']
    },
    allowedStyles: {
      '*': {
        'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
        'text-align': [/^left$/, /^right$/, /^center$/],
        'font-size': [/^\d+(?:px|em|%)$/]
      }
    },
    // Transform relative URLs to absolute URLs
    transformTags: {
      'a': (tagName, attribs) => {
        const href = attribs.href || '';
        if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
          attribs.href = `${config.app.baseUrl}/${href.replace(/^\//, '')}`;
        }
        // Add nofollow to external links
        if (href && href.startsWith('http') && !href.startsWith(config.app.baseUrl)) {
          attribs.rel = 'nofollow noopener';
          attribs.target = '_blank';
        }
        return { tagName, attribs };
      },
      'img': (tagName, attribs) => {
        const src = attribs.src || '';
        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
          attribs.src = `${config.app.baseUrl}/${src.replace(/^\//, '')}`;
        }
        return { tagName, attribs };
      }
    }
  });
};

/**
 * Generate a random alphanumeric token
 * @param {number} length - Length of the token (default: 32)
 * @returns {string} Random token
 */
exports.generateVerificationToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} Formatted date string
 */
exports.formatDate = (date, includeTime = true) => {
  if (!date) return 'N/A';
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return new Date(date).toLocaleDateString('en-US', options);
};

/**
 * Generate a slug from a string
 * @param {string} text - Text to convert to slug
 * @returns {string} URL-friendly slug
 */
exports.generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')         // Replace spaces with -
    .replace(/[^\w\-]+/g, '')     // Remove all non-word chars
    .replace(/\-\-+/g, '-')       // Replace multiple - with single -
    .replace(/^-+/, '')           // Trim - from start of text
    .replace(/-+$/, '');          // Trim - from end of text
};

/**
 * Calculate human-readable time elapsed
 * @param {Date} date - Date to calculate from
 * @returns {string} Human-readable time elapsed (e.g., "2 hours ago")
 */
exports.timeAgo = (date) => {
  if (!date) return 'N/A';