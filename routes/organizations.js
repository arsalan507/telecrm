// routes/organizations.js - Multi-Tenant Organization Management
const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const User = require('../models/User');
const Team = require('../models/Team');
const CallLog = require('../models/CallLog');
const Contact = require('../models/Contact');
const { 
    authenticate, 
    requirePermission, 
    requireRole,
    validateOrganizationContext,
    checkSubscriptionLimits,
    auditLog
} = require('../middleware/multiTenantAuth');

// @route   GET /api/organizations/:organizationId
// @desc    Get organization details
// @access  Org Admin, Super Admin
router.get('/:organizationId', 
    authenticate,
    validateOrganizationContext,
    requirePermission('manage_organization'),
    async (req, res) => {
        try {
            const organization = await Organization.findById(req.targetOrganizationId)
                .populate('owner', 'firstName lastName email')
                .populate('billingContact', 'firstName lastName email');

            if (!organization) {
                return res.status(404).json({
                    success: false,
                    message: 'Organization not found'
                });
            }

            res.json({
                success: true,
                data: organization
            });
        } catch (error) {
            console.error('Get organization error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving organization details'
            });
        }
    }
);

// @route   PUT /api/organizations/:organizationId
// @desc    Update organization details
// @access  Org Admin, Super Admin
router.put('/:organizationId',
    authenticate,
    validateOrganizationContext,
    requirePermission('manage_organization'),
    auditLog('UPDATE_ORGANIZATION'),
    async (req, res) => {
        try {
            const { 
                name, 
                description, 
                industry, 
                website, 
                phone, 
                address,
                settings,
                branding
            } = req.body;

            const organization = await Organization.findByIdAndUpdate(
                req.targetOrganizationId,
                {
                    name,
                    description,
                    industry,
                    website,
                    phone,
                    address,
                    settings: {
                        ...req.organization.settings,
                        ...settings
                    },
                    branding: {
                        ...req.organization.branding,
                        ...branding
                    },
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            );

            res.json({
                success: true,
                message: 'Organization updated successfully',
                data: organization
            });
        } catch (error) {
            console.error('Update organization error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating organization'
            });
        }
    }
);

// @route   GET /api/organizations/:organizationId/users
// @desc    Get organization users
// @access  Org Admin, Manager, Super Admin
router.get('/:organizationId/users',
    authenticate,
    validateOrganizationContext,
    requirePermission('view_all_users'),
    async (req, res) => {
        try {
            const { role, team, status = 'active', page = 1, limit = 20 } = req.query;
            
            let query = { organizationId: req.targetOrganizationId };
            
            if (role) query.role = role;
            if (team) query.teamId = team;
            if (status === 'active') query.isActive = true;
            if (status === 'inactive') query.isActive = false;

            const users = await User.find(query)
                .populate('teamId', 'name')
                .select('-password -emailVerificationToken -passwordResetToken')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await User.countDocuments(query);

            // Get user statistics
            const stats = await User.aggregate([
                { $match: { organizationId: req.targetOrganizationId } },
                {
                    $group: {
                        _id: '$role',
                        count: { $sum: 1 },
                        activeCount: {
                            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                        }
                    }
                }
            ]);

            res.json({
                success: true,
                data: {
                    users,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalUsers: total,
                        limit
                    },
                    stats: stats.reduce((acc, stat) => {
                        acc[stat._id] = {
                            total: stat.count,
                            active: stat.activeCount
                        };
                        return acc;
                    }, {})
                }
            });
        } catch (error) {
            console.error('Get organization users error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving users'
            });
        }
    }
);

// @route   PUT /api/organizations/:organizationId/users/:userId/role
// @desc    Update user role
// @access  Org Admin, Super Admin
router.put('/:organizationId/users/:userId/role',
    authenticate,
    validateOrganizationContext,
    requirePermission('manage_user_roles'),
    auditLog('UPDATE_USER_ROLE'),
    async (req, res) => {
        try {
            const { role, permissions } = req.body;
            const { userId } = req.params;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Check if user can manage this target user
            if (!req.user.canManageUser(user)) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot manage this user'
                });
            }

            await user.updateRole(role, permissions);

            res.json({
                success: true,
                message: 'User role updated successfully',
                data: {
                    userId: user._id,
                    newRole: user.role,
                    permissions: user.permissions
                }
            });
        } catch (error) {
            console.error('Update user role error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating user role'
            });
        }
    }
);

// @route   DELETE /api/organizations/:organizationId/users/:userId
// @desc    Deactivate user
// @access  Org Admin, Super Admin
router.delete('/:organizationId/users/:userId',
    authenticate,
    validateOrganizationContext,
    requirePermission('manage_user_roles'),
    auditLog('DEACTIVATE_USER'),
    async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Check if user can manage this target user
            if (!req.user.canManageUser(user)) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot manage this user'
                });
            }

            // Don't allow deactivating organization owner
            if (req.organization.owner.toString() === userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot deactivate organization owner'
                });
            }

            user.isActive = false;
            await user.save();

            res.json({
                success: true,
                message: 'User deactivated successfully'
            });
        } catch (error) {
            console.error('Deactivate user error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deactivating user'
            });
        }
    }
);

// @route   GET /api/organizations/:organizationId/teams
// @desc    Get organization teams
// @access  Org Admin, Manager, Super Admin
router.get('/:organizationId/teams',
    authenticate,
    validateOrganizationContext,
    requirePermission('manage_teams'),
    async (req, res) => {
        try {
            const { includeArchived = false } = req.query;

            const teams = await Team.findByOrganization(
                req.targetOrganizationId, 
                includeArchived === 'true'
            ).populate('members.userId', 'firstName lastName email role');

            res.json({
                success: true,
                data: teams
            });
        } catch (error) {
            console.error('Get teams error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving teams'
            });
        }
    }
);

// @route   POST /api/organizations/:organizationId/teams
// @desc    Create new team
// @access  Org Admin, Super Admin
router.post('/:organizationId/teams',
    authenticate,
    validateOrganizationContext,
    requirePermission('manage_teams'),
    checkSubscriptionLimits('teams'),
    auditLog('CREATE_TEAM'),
    async (req, res) => {
        try {
            const { name, description, managerId, settings, targets } = req.body;

            const team = new Team({
                organizationId: req.targetOrganizationId,
                name,
                description,
                managerId,
                settings,
                targets,
                createdBy: req.user._id
            });

            await team.save();

            // Add manager to team members
            if (managerId) {
                await team.addMember(managerId, 'manager');
            }

            res.status(201).json({
                success: true,
                message: 'Team created successfully',
                data: team
            });
        } catch (error) {
            console.error('Create team error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating team'
            });
        }
    }
);

// @route   GET /api/organizations/:organizationId/analytics
// @desc    Get organization analytics
// @access  Org Admin, Manager, Super Admin
router.get('/:organizationId/analytics',
    authenticate,
    validateOrganizationContext,
    requirePermission('view_organization_analytics'),
    async (req, res) => {
        try {
            const { timeRange = '30d' } = req.query;
            
            // Calculate date range
            const endDate = new Date();
            const startDate = new Date();
            
            switch (timeRange) {
                case '7d':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case '30d':
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                case '90d':
                    startDate.setDate(endDate.getDate() - 90);
                    break;
                case '1y':
                    startDate.setFullYear(endDate.getFullYear() - 1);
                    break;
                default:
                    startDate.setDate(endDate.getDate() - 30);
            }

            // Parallel analytics queries
            const [
                userStats,
                callStats,
                contactStats,
                teamStats,
                recentActivity
            ] = await Promise.all([
                // User statistics
                User.aggregate([
                    { $match: { organizationId: req.targetOrganizationId } },
                    {
                        $group: {
                            _id: null,
                            totalUsers: { $sum: 1 },
                            activeUsers: {
                                $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                            },
                            usersByRole: {
                                $push: {
                                    role: '$role',
                                    isActive: '$isActive'
                                }
                            }
                        }
                    }
                ]),
                
                // Call statistics
                CallLog.aggregate([
                    { 
                        $match: { 
                            organizationId: req.targetOrganizationId,
                            createdAt: { $gte: startDate, $lte: endDate }
                        } 
                    },
                    {
                        $group: {
                            _id: null,
                            totalCalls: { $sum: 1 },
                            totalDuration: { $sum: '$duration' },
                            avgDuration: { $avg: '$duration' },
                            callsByType: {
                                $push: '$type'
                            }
                        }
                    }
                ]),
                
                // Contact/Lead statistics
                Contact.aggregate([
                    { $match: { organizationId: req.targetOrganizationId } },
                    {
                        $group: {
                            _id: null,
                            totalContacts: { $sum: 1 },
                            contactsByStatus: {
                                $push: '$status'
                            },
                            totalDealValue: { $sum: '$dealValue' },
                            conversions: {
                                $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] }
                            }
                        }
                    }
                ]),
                
                // Team statistics
                Team.aggregate([
                    { 
                        $match: { 
                            organizationId: req.targetOrganizationId,
                            isActive: true 
                        } 
                    },
                    {
                        $group: {
                            _id: null,
                            totalTeams: { $sum: 1 },
                            totalMembers: { $sum: '$stats.totalMembers' },
                            avgMembersPerTeam: { $avg: '$stats.totalMembers' }
                        }
                    }
                ]),
                
                // Recent activity (simplified)
                CallLog.find({ 
                    organizationId: req.targetOrganizationId,
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })
                .populate('userId', 'firstName lastName')
                .sort({ createdAt: -1 })
                .limit(10)
                .select('type duration createdAt userId')
            ]);

            // Process and format the results
            const analytics = {
                timeRange,
                users: userStats[0] || { totalUsers: 0, activeUsers: 0, usersByRole: [] },
                calls: callStats[0] || { totalCalls: 0, totalDuration: 0, avgDuration: 0, callsByType: [] },
                contacts: contactStats[0] || { totalContacts: 0, contactsByStatus: [], totalDealValue: 0, conversions: 0 },
                teams: teamStats[0] || { totalTeams: 0, totalMembers: 0, avgMembersPerTeam: 0 },
                recentActivity,
                conversionRate: contactStats[0] ? 
                    (contactStats[0].conversions / contactStats[0].totalContacts * 100).toFixed(2) : 0
            };

            res.json({
                success: true,
                data: analytics
            });
        } catch (error) {
            console.error('Get analytics error:', error);
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
    validateOrganizationContext,
    requirePermission('manage_billing'),
    async (req, res) => {
        try {
            const organization = await Organization.findById(req.targetOrganizationId)
                .select('subscriptionPlan subscriptionStatus billing userLimit callLimit contactLimit teamLimit features');

            if (!organization) {
                return res.status(404).json({
                    success: false,
                    message: 'Organization not found'
                });
            }

            // Get current usage
            const [userCount, callCount, contactCount, teamCount] = await Promise.all([
                User.countByOrganization(req.targetOrganizationId),
                CallLog.countDocuments({ 
                    organizationId: req.targetOrganizationId,
                    createdAt: { 
                        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
                    }
                }),
                Contact.countDocuments({ organizationId: req.targetOrganizationId }),
                Team.countDocuments({ organizationId: req.targetOrganizationId, isActive: true })
            ]);

            const subscriptionData = {
                plan: organization.subscriptionPlan,
                status: organization.subscriptionStatus,
                billing: organization.billing,
                limits: {
                    users: { current: userCount, limit: organization.userLimit },
                    calls: { current: callCount, limit: organization.callLimit },
                    contacts: { current: contactCount, limit: organization.contactLimit },
                    teams: { current: teamCount, limit: organization.teamLimit }
                },
                features: organization.features
            };

            res.json({
                success: true,
                data: subscriptionData
            });
        } catch (error) {
            console.error('Get subscription error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving subscription details'
            });
        }
    }
);

// @route   PUT /api/organizations/:organizationId/subscription
// @desc    Update organization subscription
// @access  Org Admin, Super Admin
router.put('/:organizationId/subscription',
    authenticate,
    validateOrganizationContext,
    requireRole(['super_admin', 'org_admin']),
    auditLog('UPDATE_SUBSCRIPTION'),
    async (req, res) => {
        try {
            const { plan, billing } = req.body;

            // Validate plan
            const validPlans = ['free', 'pro', 'business', 'enterprise'];
            if (!validPlans.includes(plan)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid subscription plan'
                });
            }

            const organization = await Organization.findById(req.targetOrganizationId);
            
            // Update subscription
            organization.subscriptionPlan = plan;
            if (billing) {
                organization.billing = { ...organization.billing, ...billing };
            }
            
            // Update limits based on plan
            switch (plan) {
                case 'free':
                    organization.userLimit = 5;
                    organization.callLimit = 50;
                    organization.contactLimit = 100;
                    organization.teamLimit = 1;
                    break;
                case 'pro':
                    organization.userLimit = 25;
                    organization.callLimit = 1000;
                    organization.contactLimit = 1000;
                    organization.teamLimit = 5;
                    break;
                case 'business':
                    organization.userLimit = 100;
                    organization.callLimit = 10000;
                    organization.contactLimit = 10000;
                    organization.teamLimit = 20;
                    break;
                case 'enterprise':
                    organization.userLimit = -1; // Unlimited
                    organization.callLimit = -1;
                    organization.contactLimit = -1;
                    organization.teamLimit = -1;
                    break;
            }

            await organization.save();

            res.json({
                success: true,
                message: 'Subscription updated successfully',
                data: {
                    plan: organization.subscriptionPlan,
                    limits: {
                        users: organization.userLimit,
                        calls: organization.callLimit,
                        contacts: organization.contactLimit,
                        teams: organization.teamLimit
                    }
                }
            });
        } catch (error) {
            console.error('Update subscription error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating subscription'
            });
        }
    }
);

// @route   PUT /api/organizations/initial-super-admin/:userId
// @desc    Promote user to super admin (for initial setup only)
// @access  Authenticated (with special password)
router.put('/initial-super-admin/:userId',
    authenticate,
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { adminPassword } = req.body;

            // Security check: Use a special password for initial setup
            if (adminPassword !== 'CallTracker2024!Initial') {
                return res.status(403).json({ 
                    success: false,
                    message: 'Invalid admin password' 
                });
            }

            // Find the user to promote
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ 
                    success: false,
                    message: 'User not found' 
                });
            }

            // Check if this is really the first super admin (security measure)
            const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
            if (existingSuperAdmin) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Super admin already exists' 
                });
            }

            // Update user role to super_admin
            user.role = 'super_admin';
            await user.save();

            res.json({
                success: true,
                message: 'User promoted to super admin successfully',
                data: {
                    id: user._id,
                    email: user.email,
                    role: user.role,
                    firstName: user.firstName,
                    lastName: user.lastName
                }
            });

        } catch (error) {
            console.error('Error promoting user to super admin:', error);
            res.status(500).json({ 
                success: false,
                message: 'Internal server error' 
            });
        }
    }
);

module.exports = router;