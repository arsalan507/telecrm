// middleware/rateLimiter.js - API rate limiting per subscription tier
const rateLimit = require('express-rate-limit');

// Shared response format consistent with the rest of the API
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please slow down and try again later.',
    retryAfter: Math.ceil(res.getHeader('Retry-After') || 60),
  });
};

// Auth routes — strict limit to block brute-force login/register attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skip: () => process.env.NODE_ENV === 'test',
});

// Demo request submissions — prevent lead form spam
const demoRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'test',
});

// Super-admin routes — elevated protection
const superAdminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'test',
});

// General API — baseline protection for all other routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { authLimiter, demoRequestLimiter, superAdminLimiter, generalLimiter };
