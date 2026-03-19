/**
 * Centralized error handling middleware for Whale Marketplace.
 *
 * Handles CSRF errors, validation errors, 404s, and generic server errors
 * with proper logging and safe client-facing messages.
 */

const logger = require('../lib/logger');

const isProd = process.env.NODE_ENV === 'production';

/**
 * 404 handler — must be registered after all routes.
 */
function notFoundHandler(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  return res.status(404).render('404', { title: 'Page Not Found' });
}

/**
 * Global error handler — must be registered last.
 */
function globalErrorHandler(err, req, res, _next) {
  // CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn('CSRF token validation failed', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    return res.status(403).render('error', {
      title: 'CSRF Error',
      message: 'جلسة غير صالحة، الرجاء تحديث الصفحة والمحاولة مجددا | Invalid session token, refresh and retry'
    });
  }

  // Multer file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    logger.warn('File upload too large', { path: req.path, ip: req.ip });
    if (req.path.startsWith('/api/')) {
      return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(413).render('error', {
      title: 'Upload Error',
      message: 'الملف كبير جداً. الحد الأقصى 5 ميجابايت | File too large. Max 5MB.'
    });
  }

  // Multer file type errors
  if (err.message && err.message.includes('Only image uploads')) {
    if (req.path.startsWith('/api/')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).render('error', {
      title: 'Upload Error',
      message: 'نوع الملف غير مدعوم | ' + err.message
    });
  }

  // Log full error server-side
  logger.error('Unhandled server error', {
    error: err.message,
    stack: isProd ? undefined : err.stack,
    path: req.path,
    method: req.method,
    userId: req.session?.userId
  });

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(500).render('error', {
    title: 'Server Error',
    message: isProd ? 'Something went wrong' : err.message
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
