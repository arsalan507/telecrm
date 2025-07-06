// middleware/auth.js - Authentication Middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database (without password)
    const user = await User.findById(decoded.userId)
      .populate('organizationId', 'name subscriptionPlan subscriptionStatus userLimit callLimit')
      .select('-password -emailVerificationToken -passwordResetToken');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact your administrator.'
      });
    }

    // Check if organization is active (if user has organization)
    if (user.organizationId && !user.organizationId.subscriptionStatus) {
      return res.status(403).json({
        success: false,
        message: 'Organization subscription is inactive.'
      });
    }

    // Add user info to request object
    req.user = {
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions || [],
      organizationId: user.organizationId ? user.organizationId._id : null,
      subscriptionPlan: user.subscriptionPlan,
      callLimit: user.callLimit,
      callsUsed: user.callsUsed
    };
    
    // Add organization info if available
    if (user.organizationId) {
      req.organization = {
        id: user.organizationId._id,
        name: user.organizationId.name,
        subscriptionPlan: user.organizationId.subscriptionPlan,
        subscriptionStatus: user.organizationId.subscriptionStatus,
        userLimit: user.organizationId.userLimit,
        callLimit: user.organizationId.callLimit
      };
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error in authentication.'
    });
  }
};

/**
 * Middleware to check if user has required permission
 * @param {string} requiredPermission - Permission required to access route
 * @returns {Function} Express middleware function
 */
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${requiredPermission}`
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user has required role
 * @param {string|Array} allowedRoles - Role(s) allowed to access route
 * @returns {Function} Express middleware function
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user is admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  
  next();
};

/**
 * Middleware to check if user is manager or admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Manager or Admin privileges required.'
    });
  }
  
  next();
};

/**
 * Middleware to check call limits
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const checkCallLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Get latest user data to check current usage
    const user = await User.findById(req.user.userId).select('callLimit callsUsed');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (user.callsUsed >= user.callLimit) {
      return res.status(403).json({
        success: false,
        message: 'Call limit exceeded. Please upgrade your plan.',
        data: {
          callsUsed: user.callsUsed,
          callLimit: user.callLimit,
          upgradeRequired: true
        }
      });
    }
    
    // Update req.user with latest call data
    req.user.callsUsed = user.callsUsed;
    req.user.callLimit = user.callLimit;
    
    next();
  } catch (error) {
    console.error('Call limit check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking call limits.'
    });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return next(); // No token, continue without auth
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return next(); // Invalid format, continue without auth
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user && user.isActive) {
      req.user = {
        userId: user._id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        organizationId: user.organizationId
      };
    }
    
    next();
  } catch (error) {
    // Silently continue without authentication on error
    next();
  }
};

module.exports = {
  auth,
  checkPermission,
  checkRole,
  requireAdmin,
  requireManager,
  checkCallLimit,
  optionalAuth
};