// routes/supabaseSuperAdmin.js - Super Admin Routes using Supabase
const express = require('express');
const router = express.Router();

// Supabase Models
const SupabaseUser = require('../models/SupabaseUser');
const SupabaseOrganization = require('../models/SupabaseOrganization');
const { supabase } = require('../config/supabase');

// Explicit CORS middleware for super admin routes
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

// Enhanced Super Admin Authentication Middleware
const supabaseSuperAdminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify JWT token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from Supabase
    const user = await SupabaseUser.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Check if user is super admin
    if (user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin privileges required.'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Super admin authentication error:', error);
    
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
      message: 'Server error in authentication.'
    });
  }
};

// @route   GET /api/super-admin/organizations
// @desc    Get all organizations with pagination and filtering
// @access  Super Admin Only
router.get('/organizations', supabaseSuperAdminAuth, async (req, res) => {
  try {
    console.log('🔍 GET /organizations endpoint called');
    console.log('🔍 User authenticated:', !!req.user);
    console.log('🔍 User role:', req.user?.role);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    console.log('🔍 Query params:', { page, limit, search });

    // Build query for Supabase
    let query = supabase
      .from('organizations')
      .select('*', { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: organizations, error, count } = await query;

    if (error) {
      console.error('❌ Supabase query error:', error);
      throw error;
    }

    console.log('🔍 Organizations found:', organizations?.length || 0);

    // Get user counts for each organization
    const orgIds = organizations.map(org => org.id);
    const { data: userCounts } = await supabase
      .from('users')
      .select('organization_id')
      .in('organization_id', orgIds)
      .eq('is_active', true);

    // Create user count mapping
    const userCountMap = {};
    userCounts?.forEach(user => {
      userCountMap[user.organization_id] = (userCountMap[user.organization_id] || 0) + 1;
    });

    // Format response data
    const formattedOrganizations = organizations.map(org => ({
      _id: org.id,
      id: org.id,
      name: org.name,
      description: org.description,
      owner: org.owner_id,
      ownerEmail: org.owner_email,
      domain: org.domain || `${org.name.toLowerCase().replace(/\s+/g, '')}.calltracker.pro`,
      subscriptionPlan: org.subscription_plan,
      subscriptionStatus: org.subscription_status,
      userLimit: org.user_limit,
      userCount: userCountMap[org.id] || 0,
      callLimit: org.call_limit,
      contactLimit: org.contact_limit,
      teamLimit: org.team_limit,
      isActive: org.is_active,
      createdAt: org.created_at,
      updatedAt: org.updated_at,
      settings: org.settings,
      features: org.features
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: formattedOrganizations,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      message: `Found ${formattedOrganizations.length} organizations`
    });

  } catch (error) {
    console.error('❌ Error fetching organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizations',
      error: error.message
    });
  }
});

// @route   GET /api/super-admin/users
// @desc    Get all users across all organizations with pagination and filtering
// @access  Super Admin Only
router.get('/users', supabaseSuperAdminAuth, async (req, res) => {
  try {
    console.log('🔍 GET /users endpoint called');
    console.log('🔍 Query params:', req.query);
    console.log('🔍 User authenticated:', !!req.user);
    console.log('🔍 User role:', req.user?.role);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const organizationId = req.query.organizationId || '';

    console.log('🔍 Pagination params:', { page, limit });

    // Build query for Supabase with organization join
    let query = supabase
      .from('users')
      .select(`
        *,
        organizations (
          id,
          name,
          subscription_plan
        )
      `, { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    
    if (role && role !== 'all') {
      query = query.eq('role', role);
    }
    
    if (organizationId && organizationId !== 'all') {
      query = query.eq('organization_id', organizationId);
    }

    // Apply pagination and sorting
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: users, error, count } = await query;

    if (error) {
      console.error('❌ Supabase query error:', error);
      throw error;
    }
      
    console.log('🔍 Users query completed, found:', users?.length || 0);

    // Format response data to match frontend expectations
    const formattedUsers = users.map(user => ({
      _id: user.id,
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      organizationName: user.organizations?.name || user.organization_name || 'No Organization',
      phone: user.phone,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
      loginCount: user.login_count || 0,
      loginHistory: user.login_history || [],
      subscriptionPlan: user.organizations?.subscription_plan || user.subscription_plan
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      message: `Found ${formattedUsers.length} users`
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// @route   POST /api/super-admin/organizations
// @desc    Create new organization with admin user
// @access  Super Admin Only
router.post('/organizations', supabaseSuperAdminAuth, async (req, res) => {
  try {
    console.log('🏢 Creating new organization:', req.body);
    
    const { name, description, domain, plan, adminUser } = req.body;

    // Validation
    if (!name || !adminUser) {
      return res.status(400).json({
        success: false,
        message: 'Organization name and admin user are required'
      });
    }

    const { firstName, lastName, email, password } = adminUser;

    // Check if organization already exists
    const existingOrg = await SupabaseOrganization.findByName(name);
    if (existingOrg) {
      return res.status(409).json({
        success: false,
        message: 'Organization with this name already exists'
      });
    }

    // Check if admin email already exists
    const existingUser = await SupabaseUser.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create organization
    const organization = await SupabaseOrganization.create({
      name,
      description: description || `${name} - CallTracker Pro Organization`,
      domain: domain || `${name.toLowerCase().replace(/\s+/g, '')}.calltracker.pro`,
      subscriptionPlan: plan || 'free',
      subscriptionStatus: 'active',
      userLimit: plan === 'enterprise' ? -1 : plan === 'business' ? 100 : plan === 'pro' ? 25 : 5,
      callLimit: plan === 'enterprise' ? -1 : plan === 'business' ? 10000 : plan === 'pro' ? 1000 : 50,
      contactLimit: plan === 'enterprise' ? -1 : plan === 'business' ? 10000 : plan === 'pro' ? 1000 : 100,
      teamLimit: plan === 'enterprise' ? -1 : plan === 'business' ? 20 : plan === 'pro' ? 5 : 1
    });

    // Create admin user
    const user = await SupabaseUser.create({
      firstName,
      lastName,
      email,
      password,
      organizationId: organization.id,
      organizationName: organization.name,
      role: 'org_admin',
      subscriptionPlan: organization.subscription_plan,
      callLimit: organization.call_limit
    });

    // Update organization owner
    organization.owner_id = user.id;
    organization.owner_email = user.email;
    await organization.save();

    res.status(201).json({
      success: true,
      message: 'Organization and admin user created successfully',
      data: {
        organization: organization.toJSON(),
        adminUser: user.toJSON()
      }
    });

  } catch (error) {
    console.error('❌ Error creating organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create organization',
      error: error.message
    });
  }
});

// @route   DELETE /api/super-admin/organizations/:id
// @desc    Delete organization and all its users
// @access  Super Admin Only
router.delete('/organizations/:id', supabaseSuperAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting organization:', id);

    // Get organization
    const organization = await SupabaseOrganization.findById(id);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Delete all users in the organization
    const { error: usersError } = await supabase
      .from('users')
      .delete()
      .eq('organization_id', id);

    if (usersError) {
      console.error('Error deleting users:', usersError);
      throw usersError;
    }

    // Delete organization
    const { error: orgError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (orgError) {
      console.error('Error deleting organization:', orgError);
      throw orgError;
    }

    res.json({
      success: true,
      message: 'Organization and all associated users deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete organization',
      error: error.message
    });
  }
});

// @route   POST /api/super-admin/users
// @desc    Create new user
// @access  Super Admin Only
router.post('/users', supabaseSuperAdminAuth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      organizationName,
      phone
    } = req.body;

    console.log('👤 Creating new user:', email);

    // Validation
    if (!firstName || !lastName || !email || !password || !role || !organizationName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: firstName, lastName, email, password, role, organizationName'
      });
    }

    // Check if user already exists
    const existingUser = await SupabaseUser.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Get organization
    const organization = await SupabaseOrganization.findByName(organizationName);
    if (!organization) {
      return res.status(400).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Create user
    const newUser = await SupabaseUser.create({
      firstName: firstName,
      lastName: lastName,
      email: email.toLowerCase(),
      password,
      role,
      organizationId: organization.id,
      organizationName: organizationName,
      phone,
      subscriptionPlan: 'free',
      callLimit: 50,
      callsUsed: 0,
      signupSource: 'api'
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: newUser.id,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email,
        role: newUser.role,
        organizationName: newUser.organization_name,
        phone: newUser.phone,
        isActive: newUser.is_active,
        createdAt: newUser.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});

// @route   DELETE /api/super-admin/users/:id
// @desc    Delete user
// @access  Super Admin Only
router.delete('/users/:id', supabaseSuperAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting user:', id);

    // Check if user exists
    const user = await SupabaseUser.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting user:', error);
      throw error;
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// @route   GET /api/super-admin/stats
// @desc    Get system statistics
// @access  Super Admin Only
router.get('/stats', supabaseSuperAdminAuth, async (req, res) => {
  try {
    console.log('📊 Getting system stats');

    // Get counts from Supabase
    const [orgResult, userResult] = await Promise.all([
      supabase.from('organizations').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true })
    ]);

    const stats = {
      totalOrganizations: orgResult.count || 0,
      totalUsers: userResult.count || 0,
      activeOrganizations: 0, // Will be calculated if needed
      activeUsers: 0 // Will be calculated if needed
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: error.message
    });
  }
});

// @route   GET /api/super-admin/test
// @desc    Test super admin routes
// @access  Super Admin Only
router.get('/test', supabaseSuperAdminAuth, async (req, res) => {
  res.json({
    success: true,
    message: 'Super Admin API with Supabase is working!',
    user: req.user.toSafeProfile(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;