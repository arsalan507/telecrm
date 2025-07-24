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
      data: organizations,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
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

    // Create organization
    const organization = new Organization({
      name: name.trim(),
      domain: domain.toLowerCase(),
      description: description || `${name.trim()} organization`,
      subscriptionPlan: limits.subscriptionPlan,
      subscriptionStatus: 'active',
      isActive: true,
      userLimit: limits.userLimit,
      callLimit: limits.callLimit,
      contactLimit: limits.contactLimit,
      teamLimit: limits.teamLimit,
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

    // Create admin user
    const user = new User({
      firstName: adminUser.firstName.trim(),
      lastName: adminUser.lastName.trim(),
      email: adminUser.email.toLowerCase(),
      password: adminUser.password, // Will be hashed by pre-save hook
      phone: adminUser.phone || '',
      organizationId: organization._id,
      organizationName: organization.name,
      role: 'org_admin',
      isActive: true,
      subscriptionPlan: organization.subscriptionPlan,
      callLimit: organization.callLimit,
      callsUsed: 0,
      signupSource: 'super_admin'
    });

    await user.save();

    // Update organization with owner reference
    organization.ownerId = user._id;
    await organization.save();

    // Return success response
    res.status(201).json({
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
      message: 'Organization and all associated data deleted successfully',
      deletedData: {
        organization: organization.name,
        users: userCount,
        callLogs: callLogCount,
        contacts: contactCount,
        tickets: ticketCount
      }
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
      totalOrganizations,
      totalUsers,
      totalCallLogs,
      totalContacts,
      activeOrganizations,
      organizationsByPlan: planStats
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

module.exports = router;