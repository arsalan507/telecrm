// middleware/superAdmin.js - Super Admin Access Control Middleware
const { auth } = require('./auth');

/**
 * Middleware to ensure only super admin can access super admin routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireSuperAdmin = (req, res, next) => {
  console.log('🔍 Super admin middleware - Checking permissions');
  console.log('🔍 Super admin middleware - User exists:', !!req.user);
  console.log('🔍 Super admin middleware - User role:', req.user?.role);
  
  if (!req.user) {
    console.log('❌ Super admin middleware - No user in request');
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'super_admin') {
    console.log('❌ Super admin middleware - Insufficient permissions:', req.user.role);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super admin privileges required.'
    });
  }

  console.log('✅ Super admin middleware - Access granted');
  next();
};

/**
 * Combined middleware: auth + super admin check
 * Use this for all super admin routes
 */
const superAdminAuth = [auth, requireSuperAdmin];

module.exports = {
  requireSuperAdmin,
  superAdminAuth
};