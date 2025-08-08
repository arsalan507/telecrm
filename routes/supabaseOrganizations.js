// routes/supabaseOrganizations.js - Organization Management with Supabase
const express = require('express');
const router = express.Router();
const SupabaseUser = require('../models/SupabaseUser');
const SupabaseOrganization = require('../models/SupabaseOrganization');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

// Test endpoint to verify Supabase routes are being used (before middleware)
router.get('/test-supabase-routes', (req, res) => {
  res.json({
    success: true,
    message: 'Supabase organization routes are active',
    timestamp: new Date().toISOString(),
    routeFile: 'supabaseOrganizations.js'
  });
});

// Explicit CORS middleware for organization routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-organization-id, Accept, Origin, X-Requested-With, Cache-Control');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '0');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Hybrid authentication middleware (works with both MongoDB and Supabase users)
const authenticate = async (req, res, next) => {
  try {
    console.log('🔐 Authenticating organization request...');
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔐 Token decoded:', { userId: decoded.userId, email: decoded.email, role: decoded.role });
    
    let user = null;
    
    // Try Supabase first for org_admin users
    try {
      user = await SupabaseUser.findById(decoded.userId);
      if (user) {
        console.log('✅ Found user in Supabase:', user.email);
        // Convert Supabase user to consistent format
        user.organizationId = user.organization_id;
        user.isActive = user.is_active;
      }
    } catch (supabaseError) {
      console.log('ℹ️ User not found in Supabase:', supabaseError.message);
      console.log('ℹ️ Trying MongoDB...');
    }
    
    // If not found in Supabase, try MongoDB as fallback
    if (!user) {
      try {
        const User = require('../models/User');
        user = await User.findById(decoded.userId).select('-password');
        if (user) {
          console.log('✅ Found user in MongoDB:', user.email, 'role:', user.role);
          // Convert MongoDB user to consistent format - MongoDB already has correct field names
          user.organizationId = user.organizationId;
          user.isActive = user.isActive;
        }
      } catch (mongoError) {
        console.log('ℹ️ User not found in MongoDB either:', mongoError.message);
      }
    }
    
    if (!user) {
      console.log('❌ User not found in any database:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ User is inactive:', user.email);
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated.'
      });
    }

    console.log('✅ User authenticated:', { 
      id: user.id || user._id, 
      email: user.email, 
      role: user.role,
      organizationId: user.organizationId
    });

    // Add user context to request
    req.user = user;
    req.organizationId = user.organizationId;
    req.userRole = user.role;
    
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

// Organization access validation
const validateOrganizationAccess = (req, res, next) => {
  const requestedOrgId = req.params.organizationId;
  
  console.log('🔍 Validating organization access:', {
    requestedOrgId,
    userOrgId: req.organizationId,
    userRole: req.userRole,
    userEmail: req.user?.email
  });
  
  // Super admin can access any organization
  if (req.userRole === 'super_admin') {
    console.log('✅ Super admin access granted');
    req.targetOrganizationId = requestedOrgId;
    return next();
  }
  
  // Regular users can only access their own organization
  if (req.organizationId !== requestedOrgId) {
    console.log('❌ Organization access denied - user org:', req.organizationId, 'requested:', requestedOrgId);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Cannot access different organization.'
    });
  }
  
  console.log('✅ Organization access granted for org_admin');
  req.targetOrganizationId = requestedOrgId;
  next();
};

// @route   GET /api/organizations/:organizationId
// @desc    Get organization details
// @access  Org Admin, Super Admin
router.get('/:organizationId', 
  authenticate,
  validateOrganizationAccess,
  async (req, res) => {
    try {
      console.log('📋 Getting organization details for:', req.targetOrganizationId);
      
      const organization = await SupabaseOrganization.findById(req.targetOrganizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      console.log('✅ Organization found:', organization.name);

      res.json({
        success: true,
        data: organization.toJSON()
      });
    } catch (error) {
      console.error('❌ Get organization error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving organization details'
      });
    }
  }
);

// @route   GET /api/organizations/:organizationId/users
// @desc    Get organization users
// @access  Org Admin, Manager, Super Admin
router.get('/:organizationId/users',
  authenticate,
  validateOrganizationAccess,
  async (req, res) => {
    try {
      console.log('👥 Getting users for organization:', req.targetOrganizationId);
      
      const { role, status = 'active', page = 1, limit = 20 } = req.query;
      
      // Build query
      let query = supabase
        .from('users')
        .select('*')
        .eq('organization_id', req.targetOrganizationId);
      
      if (role) {
        query = query.eq('role', role);
      }
      
      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      }
      
      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
      
      const { data: users, error, count } = await query;

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Found users:', users.length);

      // Get user statistics
      const { data: stats } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('organization_id', req.targetOrganizationId);

      const roleStats = stats?.reduce((acc, user) => {
        if (!acc[user.role]) {
          acc[user.role] = { total: 0, active: 0 };
        }
        acc[user.role].total++;
        if (user.is_active) {
          acc[user.role].active++;
        }
        return acc;
      }, {}) || {};

      res.json({
        success: true,
        data: {
          users: users.map(user => ({
            ...user,
            password: undefined // Remove password from response
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil((count || 0) / limit),
            totalUsers: count || 0,
            limit: parseInt(limit)
          },
          stats: roleStats
        }
      });
    } catch (error) {
      console.error('❌ Get organization users error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving users'
      });
    }
  }
);

// @route   PUT /api/organizations/:organizationId
// @desc    Update organization details  
// @access  Org Admin, Super Admin
router.put('/:organizationId',
  authenticate,
  validateOrganizationAccess,
  async (req, res) => {
    try {
      console.log('📝 Updating organization:', req.targetOrganizationId);
      
      // Only allow org_admin and super_admin to update
      if (!['org_admin', 'super_admin'].includes(req.userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }
      
      const { name, description, settings, branding } = req.body;
      
      const { data: organization, error } = await supabase
        .from('organizations')
        .update({
          name,
          description,
          settings: settings ? JSON.stringify(settings) : undefined,
          branding: branding ? JSON.stringify(branding) : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.targetOrganizationId)
        .select()
        .single();

      if (error) {
        console.error('❌ Update error:', error);
        throw error;
      }

      console.log('✅ Organization updated successfully');

      res.json({
        success: true,
        message: 'Organization updated successfully',
        data: organization
      });
    } catch (error) {
      console.error('❌ Update organization error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating organization'
      });
    }
  }
);

// @route   GET /api/organizations/:organizationId/analytics
// @desc    Get organization analytics (simplified)
// @access  Org Admin, Manager, Super Admin  
router.get('/:organizationId/analytics',
  authenticate,
  validateOrganizationAccess,
  async (req, res) => {
    try {
      console.log('📊 Getting analytics for organization:', req.targetOrganizationId);
      
      // Get basic user count
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('organization_id', req.targetOrganizationId);

      if (userError) {
        console.error('❌ User analytics error:', userError);
      }

      const userStats = users?.reduce((acc, user) => {
        acc.totalUsers++;
        if (user.is_active) acc.activeUsers++;
        
        if (!acc.usersByRole[user.role]) {
          acc.usersByRole[user.role] = { total: 0, active: 0 };
        }
        acc.usersByRole[user.role].total++;
        if (user.is_active) {
          acc.usersByRole[user.role].active++;
        }
        
        return acc;
      }, { 
        totalUsers: 0, 
        activeUsers: 0, 
        usersByRole: {} 
      }) || { totalUsers: 0, activeUsers: 0, usersByRole: {} };

      const analytics = {
        timeRange: '30d',
        users: userStats,
        calls: { totalCalls: 0, totalDuration: 0, avgDuration: 0 },
        contacts: { totalContacts: 0, conversions: 0 },
        teams: { totalTeams: 0, totalMembers: 0 }
      };

      console.log('✅ Analytics compiled:', analytics);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('❌ Get analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving analytics'
      });
    }
  }
);

// @route   GET /api/organizations/:organizationId/subscription
// @desc    Get organization subscription details
// @access  Org Admin, Super Admin
router.get('/:organizationId/subscription',
  authenticate,
  validateOrganizationAccess,
  async (req, res) => {
    try {
      console.log('💳 Getting subscription for organization:', req.targetOrganizationId);
      
      const organization = await SupabaseOrganization.findById(req.targetOrganizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Get current usage counts
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('organization_id', req.targetOrganizationId);

      const userCount = users?.length || 0;

      const subscriptionData = {
        plan: organization.subscription_plan,
        status: organization.subscription_status,
        limits: {
          users: { current: userCount, limit: organization.user_limit },
          calls: { current: 0, limit: organization.call_limit },
          contacts: { current: 0, limit: organization.contact_limit },
          teams: { current: 0, limit: organization.team_limit }
        },
        features: organization.features
      };

      console.log('✅ Subscription data retrieved');

      res.json({
        success: true,
        data: subscriptionData
      });
    } catch (error) {
      console.error('❌ Get subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving subscription details'
      });
    }
  }
);

// Duplicate test endpoint removed - using the one before middleware

// Debug endpoint to test authentication without organization validation
router.get('/debug/auth-test', authenticate, async (req, res) => {
  try {
    console.log('🔍 Debug endpoint hit - user:', req.user?.email);
    res.json({
      success: true,
      message: 'Authentication working',
      user: {
        id: req.user?.id || req.user?._id,
        email: req.user?.email,
        role: req.user?.role,
        organizationId: req.organizationId
      }
    });
  } catch (error) {
    console.error('❌ Debug auth test error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug test failed',
      error: error.message
    });
  }
});

module.exports = router;