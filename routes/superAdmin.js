// routes/superAdmin.js - Super Admin Routes for Organization Management
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Models
const Organization = require('../models/Organization');
const User = require('../models/User');
const CallLog = require('../models/CallLog');
const Contact = require('../models/Contact');
const Ticket = require('../models/Ticket');

// Middleware
const { superAdminAuth } = require('../middleware/superAdmin');
const { auth } = require('../middleware/auth');

// Validation helper
const validateOrganizationData = (data) => {
  const { name, domain, description, plan, adminUser } = data;
  const errors = [];

  if (!name || name.trim().length < 2) {
    errors.push('Organization name must be at least 2 characters');
  }

  if (!domain || !/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.?[a-zA-Z]{2,}$/.test(domain)) {
    errors.push('Valid domain is required');
  }

  if (!plan || !['basic', 'professional', 'enterprise'].includes(plan)) {
    errors.push('Valid plan is required (basic, professional, enterprise)');
  }

  if (!adminUser) {
    errors.push('Admin user information is required');
  } else {
    const { firstName, lastName, email, password } = adminUser;
    
    if (!firstName || firstName.trim().length < 2) {
      errors.push('Admin first name must be at least 2 characters');
    }
    
    if (!lastName || lastName.trim().length < 2) {
      errors.push('Admin last name must be at least 2 characters');
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Valid admin email is required');
    }
    
    if (!password || password.length < 6) {
      errors.push('Admin password must be at least 6 characters');
    }
  }

  return errors;
};

// DEBUG ENDPOINT - Remove after fixing authentication
router.post('/debug-auth', auth, async (req, res) => {
  try {
    console.log('🔍 Debug endpoint - User object:', req.user);
    console.log('🔍 Debug endpoint - JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('🔍 Debug endpoint - Headers:', req.headers);
    
    const decoded = require('jsonwebtoken').decode(req.headers.authorization?.slice(7));
    console.log('🔍 Debug endpoint - Decoded token (unsafe):', decoded);
    
    res.json({
      success: true,
      message: 'Authentication debug info',
      data: {
        user: req.user ? {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role,
          isActive: req.user.isActive
        } : null,
        jwtSecretExists: !!process.env.JWT_SECRET,
        decodedToken: decoded,
        headers: {
          authorization: req.headers.authorization ? 'Bearer [token present]' : 'No authorization header',
          userAgent: req.headers['user-agent']
        }
      }
    });
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug endpoint error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/super-admin/organizations
 * @desc    List all organizations with pagination
 * @access  Super Admin Only
 */
router.get('/organizations', superAdminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const plan = req.query.plan;
    const status = req.query.status;

    // Build filter query
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { domain: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (plan) {
      filter.subscriptionPlan = plan;
    }
    
    if (status) {
      filter.subscriptionStatus = status;
    }

    // Get organizations with owner details and user count
    const organizations = await Organization.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: '_id',
          as: 'owner',
          pipeline: [
            { $project: { firstName: 1, lastName: 1, email: 1, createdAt: 1 } }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'organizationId',
          as: 'userCount',
          pipeline: [
            { $match: { isActive: true } },
            { $count: 'count' }
          ]
        }
      },
      {
        $lookup: {
          from: 'calllogs',
          localField: '_id',
          foreignField: 'organizationId',
          as: 'lastActivity',
          pipeline: [
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { createdAt: 1 } }
          ]
        }
      },
      {
        $addFields: {
          owner: { $arrayElemAt: ['$owner', 0] },
          userCount: { 
            $ifNull: [{ $arrayElemAt: ['$userCount.count', 0] }, 0] 
          },
          lastActivityAt: { 
            $arrayElemAt: ['$lastActivity.createdAt', 0] 
          }
        }
      },
      {
        $project: {
          name: 1,
          domain: 1,
          description: 1,
          subscriptionPlan: 1,
          subscriptionStatus: 1,
          isActive: 1,
          userCount: 1,
          createdAt: 1,
          lastActivityAt: 1,
          owner: 1,
          // Map subscriptionPlan to plan for frontend compatibility
          plan: '$subscriptionPlan'
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    // Get total count for pagination
    const totalCount = await Organization.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: organizations,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      message: `Found ${organizations.length} organizations`
    });

  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/super-admin/organizations
 * @desc    Create a new organization with initial admin user
 * @access  Super Admin Only
 */
router.post('/organizations', superAdminAuth, async (req, res) => {
  try {
    const { name, domain, description, plan, adminUser } = req.body;

    // Validate input data
    const validationErrors = validateOrganizationData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Check if organization name already exists
    const existingOrgByName = await Organization.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    
    if (existingOrgByName) {
      return res.status(409).json({
        success: false,
        message: 'Organization with this name already exists'
      });
    }

    // Check if domain already exists
    const existingOrgByDomain = await Organization.findOne({ 
      domain: domain.toLowerCase() 
    });
    
    if (existingOrgByDomain) {
      return res.status(409).json({
        success: false,
        message: 'Organization with this domain already exists'
      });
    }

    // Check if admin email already exists
    const existingUser = await User.findOne({ 
      email: adminUser.email.toLowerCase() 
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Set subscription limits based on plan
    const planLimits = {
      basic: {
        subscriptionPlan: 'pro', // Map to existing plan
        userLimit: 10,
        callLimit: 5000,
        contactLimit: 1000,
        teamLimit: 3
      },
      professional: {
        subscriptionPlan: 'business',
        userLimit: 50,
        callLimit: 50000,
        contactLimit: 10000,
        teamLimit: 10
      },
      enterprise: {
        subscriptionPlan: 'enterprise',
        userLimit: 999,
        callLimit: 999999,
        contactLimit: 999999,
        teamLimit: 50
      }
    };

    const limits = planLimits[plan];

    // First create a temp user to get the ID for ownerId
    const tempUser = new User({
      firstName: adminUser.firstName.trim(),
      lastName: adminUser.lastName.trim(),
      email: adminUser.email.toLowerCase(),
      password: adminUser.password, // Will be hashed by pre-save hook
      phone: adminUser.phone || '1234567890', // Default phone if not provided
      organizationName: name.trim(), // Temporary - will be updated
      role: 'org_admin',
      isActive: true,
      subscriptionPlan: limits.subscriptionPlan,
      callLimit: limits.callLimit,
      callsUsed: 0,
      signupSource: 'api' // Use valid enum value instead of 'super_admin'
    });

    await tempUser.save();

    // Now create organization with ownerId
    const organization = new Organization({
      name: name.trim(),
      domain: domain.toLowerCase(),
      description: description || `${name.trim()} organization`,
      plan: plan,
      subscriptionPlan: limits.subscriptionPlan,
      subscriptionStatus: 'active',
      isActive: true,
      userLimit: limits.userLimit,
      callLimit: limits.callLimit,
      contactLimit: limits.contactLimit,
      teamLimit: limits.teamLimit,
      ownerId: tempUser._id, // Set the owner ID
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        workingHours: {
          start: '09:00',
          end: '17:00'
        },
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        features: {
          callRecording: true,
          analytics: true,
          teamManagement: true,
          apiAccess: plan === 'enterprise',
          whatsappIntegration: plan !== 'basic',
          customBranding: plan === 'enterprise'
        }
      },
      billing: {
        email: adminUser.email.toLowerCase(),
        subscriptionStartDate: new Date()
      }
    });

    await organization.save();

    // Update user with organizationId
    tempUser.organizationId = organization._id;
    tempUser.organizationName = organization.name;
    await tempUser.save();

    const user = tempUser; // Rename for consistency with response code

    // Return success response
    res.status(201).json({
      success: true,
      data: {
        organization: {
          _id: organization._id,
          name: organization.name,
          domain: organization.domain,
          description: organization.description,
          plan: plan, // Return original plan name for frontend
          subscriptionPlan: organization.subscriptionPlan,
          subscriptionStatus: organization.subscriptionStatus,
          isActive: organization.isActive,
          userLimit: organization.userLimit,
          callLimit: organization.callLimit,
          createdAt: organization.createdAt,
          owner: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          }
        },
        adminUser: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          createdAt: user.createdAt
        }
      },
      message: `Organization "${organization.name}" created successfully with admin user`
    });

  } catch (error) {
    console.error('Error creating organization:', error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create organization',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   DELETE /api/super-admin/organizations/:orgId
 * @desc    Delete an organization and all its data
 * @access  Super Admin Only
 */
router.delete('/organizations/:orgId', superAdminAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { confirmDelete } = req.body;

    // Require explicit confirmation
    if (!confirmDelete) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation required. Include confirmDelete: true in request body'
      });
    }

    // Find organization
    const organization = await Organization.findById(orgId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Prevent deletion of organizations with super_admin users
    const superAdminUsers = await User.find({ 
      organizationId: orgId, 
      role: 'super_admin',
      isActive: true
    });

    if (superAdminUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete organization with super admin users'
      });
    }

    // Get counts for confirmation
    const userCount = await User.countDocuments({ organizationId: orgId });
    const callLogCount = await CallLog.countDocuments({ organizationId: orgId });
    const contactCount = await Contact.countDocuments({ organizationId: orgId });
    
    // Use Ticket model if it exists
    let ticketCount = 0;
    try {
      ticketCount = await Ticket.countDocuments({ organizationId: orgId });
    } catch (e) {
      // Ticket model might not exist
    }

    // Delete all organization data
    await Promise.all([
      User.deleteMany({ organizationId: orgId }),
      CallLog.deleteMany({ organizationId: orgId }),
      Contact.deleteMany({ organizationId: orgId }),
      // Only delete tickets if model exists
      ticketCount > 0 ? Ticket.deleteMany({ organizationId: orgId }) : Promise.resolve()
    ]);

    // Delete the organization itself
    await Organization.findByIdAndDelete(orgId);

    res.json({
      success: true,
      data: {
        organization: organization.name,
        users: userCount,
        callLogs: callLogCount,
        contacts: contactCount,
        tickets: ticketCount
      },
      message: 'Organization and all associated data deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete organization',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/super-admin/stats
 * @desc    Get platform statistics
 * @access  Super Admin Only
 */
router.get('/stats', superAdminAuth, async (req, res) => {
  try {
    const [
      totalOrganizations,
      totalUsers,
      totalCallLogs,
      totalContacts,
      activeOrganizations,
      organizationsByPlan
    ] = await Promise.all([
      Organization.countDocuments(),
      User.countDocuments({ isActive: true }),
      CallLog.countDocuments(),
      Contact.countDocuments(),
      Organization.countDocuments({ subscriptionStatus: 'active' }),
      Organization.aggregate([
        {
          $group: {
            _id: '$subscriptionPlan',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const planStats = organizationsByPlan.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalOrganizations,
        totalUsers,
        totalCallLogs,
        totalContacts,
        activeOrganizations,
        organizationsByPlan: planStats
      },
      message: 'Platform statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/super-admin/organizations/:id
 * @desc    Update organization details
 * @access  Super Admin Only
 */
router.put('/organizations/:id', superAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, description, plan, isActive, settings } = req.body;

    // Find organization
    const organization = await Organization.findById(id);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Validate domain uniqueness if being updated
    if (domain && domain.toLowerCase() !== organization.domain) {
      const existingOrgByDomain = await Organization.findOne({ 
        domain: domain.toLowerCase(),
        _id: { $ne: id }
      });
      
      if (existingOrgByDomain) {
        return res.status(409).json({
          success: false,
          message: 'Organization with this domain already exists'
        });
      }
    }

    // Validate name uniqueness if being updated
    if (name && name.trim() !== organization.name) {
      const existingOrgByName = await Organization.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id }
      });
      
      if (existingOrgByName) {
        return res.status(409).json({
          success: false,
          message: 'Organization with this name already exists'
        });
      }
    }

    // Update organization fields
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (domain) updateData.domain = domain.toLowerCase();
    if (description !== undefined) updateData.description = description;
    if (plan && ['basic', 'professional', 'enterprise'].includes(plan)) {
      updateData.plan = plan;
      // Map to existing subscription plan
      const planMapping = {
        basic: 'pro',
        professional: 'business',
        enterprise: 'enterprise'
      };
      updateData.subscriptionPlan = planMapping[plan];
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (settings) updateData.settings = { ...organization.settings, ...settings };

    // Update the organization
    const updatedOrganization = await Organization.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('ownerId', 'firstName lastName email');

    res.json({
      success: true,
      data: {
        _id: updatedOrganization._id,
        name: updatedOrganization.name,
        domain: updatedOrganization.domain,
        description: updatedOrganization.description,
        plan: updatedOrganization.plan,
        isActive: updatedOrganization.isActive,
        settings: updatedOrganization.settings,
        createdAt: updatedOrganization.createdAt,
        updatedAt: updatedOrganization.updatedAt,
        owner: updatedOrganization.ownerId
      },
      message: 'Organization updated successfully'
    });

  } catch (error) {
    console.error('Error updating organization:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update organization',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/super-admin/organizations/:id/users
 * @desc    Get all users in a specific organization
 * @access  Super Admin Only
 */
router.get('/organizations/:id/users', superAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role;
    const status = req.query.status;

    // Check if organization exists
    const organization = await Organization.findById(id);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Build filter query
    const filter = { organizationId: id };
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      filter.role = role;
    }
    
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password -emailVerificationToken -passwordResetToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      organization: {
        _id: organization._id,
        name: organization.name,
        domain: organization.domain
      },
      message: `Found ${users.length} users in ${organization.name}`
    });

  } catch (error) {
    console.error('Error fetching organization users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/super-admin/users/test
 * @desc    Test endpoint to debug user functionality
 * @access  Super Admin Only
 */
router.get('/users/test', superAdminAuth, async (req, res) => {
  try {
    console.log('🧪 User test endpoint called');
    console.log('🧪 User model exists:', !!User);
    console.log('🧪 Database connected:', require('mongoose').connection.readyState === 1);
    
    // Test basic user query
    const userCount = await User.countDocuments();
    console.log('🧪 Total users in database:', userCount);
    
    res.json({
      success: true,
      message: 'User endpoint test successful',
      data: {
        userModelExists: !!User,
        databaseConnected: require('mongoose').connection.readyState === 1,
        totalUsers: userCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ User test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'User test endpoint failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route   GET /api/super-admin/users
 * @desc    Get all users across all organizations with pagination and filtering
 * @access  Super Admin Only
 */
router.get('/users', superAdminAuth, async (req, res) => {
  try {
    console.log('🔍 GET /users endpoint called');
    console.log('🔍 Query params:', req.query);
    console.log('🔍 User authenticated:', !!req.user);
    console.log('🔍 User role:', req.user?.role);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const organizationId = req.query.organizationId || '';

    console.log('🔍 Pagination params:', { page, limit, skip });

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role && role !== 'all') {
      filter.role = role;
    }
    
    if (organizationId && organizationId !== 'all') {
      filter.organizationId = organizationId;
    }

    console.log('🔍 Filter object:', filter);
    console.log('🔍 User model exists:', !!User);
    console.log('🔍 Database state:', require('mongoose').connection.readyState);

    // Get users with organization details
    console.log('🔍 Starting User.find query...');
    const users = await User.find(filter)
      .populate('organizationId', 'name domain subscriptionPlan')
      .select('-password -emailVerificationToken -passwordResetToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    console.log('🔍 Users query completed, found:', users.length);

    // Get total count for pagination
    const totalCount = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    // Format response data
    const formattedUsers = users.map(user => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId?._id,
      organizationName: user.organizationId?.name || 'No Organization',
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      loginCount: user.loginCount || 0,
      loginHistory: user.loginHistory || [],
      subscriptionPlan: user.organizationId?.subscriptionPlan
    }));

    res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      message: `Found ${formattedUsers.length} users`
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
      errorName: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route   POST /api/super-admin/users
 * @desc    Create a new user in a specific organization
 * @access  Super Admin Only
 */
router.post('/users', superAdminAuth, async (req, res) => {
  try {
    console.log('🔍 POST /users endpoint called');
    console.log('🔍 Request body:', req.body);
    console.log('🔍 User authenticated:', !!req.user);
    console.log('🔍 User role:', req.user?.role);
    
    const { firstName, lastName, email, role, organizationId, phone, password } = req.body;
    console.log('🔍 Extracted fields:', { firstName, lastName, email, role, organizationId, phone: !!phone, password: !!password });

    // Validate required fields
    const errors = [];
    if (!firstName || firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters');
    }
    if (!lastName || lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Valid email is required');
    }
    if (!role || !['super_admin', 'org_admin', 'manager', 'agent', 'viewer'].includes(role)) {
      errors.push('Valid role is required (super_admin, org_admin, manager, agent, viewer)');
    }
    if (!organizationId) {
      errors.push('Organization ID is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Verify organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Generate temporary password if not provided
    const tempPassword = password || `Temp${Math.random().toString(36).slice(-8)}!`;

    // Create user
    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase(),
      password: tempPassword, // Will be hashed by pre-save hook
      role: role,
      organizationId: organizationId,
      organizationName: organization.name,
      phone: phone || '1234567890',
      isActive: true,
      subscriptionPlan: organization.subscriptionPlan,
      callLimit: organization.callLimit,
      callsUsed: 0,
      signupSource: 'api'
    });

    await user.save();

    // Return response without password
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organizationName,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      data: {
        user: userResponse,
        temporaryPassword: !password ? tempPassword : undefined
      },
      message: `User "${user.firstName} ${user.lastName}" created successfully`
    });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message,
      errorName: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route   PUT /api/super-admin/users/:userId
 * @desc    Update user details
 * @access  Super Admin Only
 */
router.put('/users/:userId', superAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, role, phone, isActive, organizationId } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate email if being changed
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
    }

    // Validate organization if being changed
    let organization = null;
    if (organizationId && organizationId !== user.organizationId?.toString()) {
      organization = await Organization.findById(organizationId);
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }
    }

    // Update user fields
    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    if (email) user.email = email.toLowerCase();
    if (role && ['super_admin', 'org_admin', 'manager', 'agent', 'viewer'].includes(role)) {
      user.role = role;
    }
    if (phone) user.phone = phone;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    
    if (organization) {
      user.organizationId = organizationId;
      user.organizationName = organization.name;
      user.subscriptionPlan = organization.subscriptionPlan;
      user.callLimit = organization.callLimit;
    }

    await user.save();

    // Return updated user (without password)
    const updatedUser = await User.findById(userId)
      .populate('organizationId', 'name domain subscriptionPlan')
      .select('-password -emailVerificationToken -passwordResetToken');

    res.json({
      success: true,
      data: {
        _id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        role: updatedUser.role,
        organizationId: updatedUser.organizationId?._id,
        organizationName: updatedUser.organizationId?.name,
        phone: updatedUser.phone,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      },
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   DELETE /api/super-admin/users/:userId
 * @desc    Delete user (soft delete by setting isActive to false)
 * @access  Super Admin Only
 */
router.delete('/users/:userId', superAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deletion of super admin users
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete super admin users'
      });
    }

    // Soft delete by setting isActive to false
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: `User "${user.firstName} ${user.lastName}" has been deactivated`
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;