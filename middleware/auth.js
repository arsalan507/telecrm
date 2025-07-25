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
    console.log('🔍 Auth middleware - Starting authentication');
    
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    console.log('🔍 Auth middleware - Header exists:', !!authHeader);
    
    if (!authHeader) {
      console.log('❌ Auth middleware - No authorization header');
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
      console.log('❌ Auth middleware - No token after extraction');
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    console.log('🔍 Auth middleware - Token extracted successfully');
    console.log('🔍 Auth middleware - JWT_SECRET exists:', !!process.env.JWT_SECRET);

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 Auth middleware - Token decoded:', decoded);
    
    // Handle both possible ID field names (userId or id)
    const userId = decoded.userId || decoded.id;
    console.log('🔍 Auth middleware - User ID for lookup:', userId);
    
    if (!userId) {
      console.log('❌ Auth middleware - No user ID in token');
      return res.status(401).json({
        success: false,
        message: 'Invalid token. No user ID found.'
      });
    }
    
    // Get user from database (without password)
    const user = await User.findById(userId)
      .populate('organizationId', 'name subscriptionPlan subscriptionStatus userLimit callLimit')
      .select('-password -emailVerificationToken -passwordResetToken');
    
    console.log('🔍 Auth middleware - User found:', !!user);
    console.log('🔍 Auth middleware - User role:', user?.role);
    
    if (!user) {
      console.log('❌ Auth middleware - User not found in database');
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

    // Add full user object to request (for accessing methods)
    req.user = user;
    
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
    console.error('❌ Auth middleware error:', error);
    console.error('❌ Auth middleware error name:', error.name);
    console.error('❌ Auth middleware error message:', error.message);
    console.error('❌ Auth middleware error stack:', error.stack);
    
    // Additional debugging information
    console.error('❌ Auth middleware - JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.error('❌ Auth middleware - Request headers:', req.headers);
    
    if (error.name === 'JsonWebTokenError') {
      console.log('❌ Auth middleware - Invalid JWT token');
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
        debug: process.env.NODE_ENV === 'development' ? {
          error: error.message,
          jwtSecretExists: !!process.env.JWT_SECRET
        } : undefined
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      console.log('❌ Auth middleware - Token expired');
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
        debug: process.env.NODE_ENV === 'development' ? {
          error: error.message,
          expiredAt: error.expiredAt
        } : undefined
      });
    }
    
    // Database connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
      console.log('❌ Auth middleware - Database connection error');
      return res.status(500).json({
        success: false,
        message: 'Database connection error.',
        debug: process.env.NODE_ENV === 'development' ? {
          error: error.message,
          errorName: error.name
        } : undefined
      });
    }
    
    console.log('❌ Auth middleware - Unexpected server error');
    res.status(500).json({
      success: false,
      message: 'Server error in authentication.',
      debug: process.env.NODE_ENV === 'development' ? {
        error: error.message,
        errorName: error.name,
        stack: error.stack,
        jwtSecretExists: !!process.env.JWT_SECRET
      } : undefined
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

    // Use the user's hasPermission method for more comprehensive checking
    if (!req.user.hasPermission(requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${requiredPermission}`
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user has any of the required permissions
 * @param {Array} requiredPermissions - Array of permissions (user needs at least one)
 * @returns {Function} Express middleware function
 */
const checkAnyPermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!req.user.hasAnyPermission(requiredPermissions)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permissions: ${requiredPermissions.join(' or ')}`
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user has all required permissions
 * @param {Array} requiredPermissions - Array of permissions (user needs all)
 * @returns {Function} Express middleware function
 */
const checkAllPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!req.user.hasAllPermissions(requiredPermissions)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permissions: ${requiredPermissions.join(' and ')}`
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user can access organization data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const checkOrganizationAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  const requestedOrgId = req.params.organizationId || req.body.organizationId || req.query.organizationId;
  
  if (requestedOrgId && !req.user.canAccessOrganization(requestedOrgId)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Cannot access this organization.'
    });
  }
  
  next();
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
    const user = await User.findById(req.user._id).select('callLimit callsUsed');
    
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
  checkAnyPermission,
  checkAllPermissions,
  checkOrganizationAccess,
  checkRole,
  requireAdmin,
  requireManager,
  checkCallLimit,
  optionalAuth
};