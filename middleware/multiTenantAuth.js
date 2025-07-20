// middleware/multiTenantAuth.js - Enhanced Multi-Tenant Authentication & Authorization
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');

// Enhanced authentication middleware with organization context
const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user with organization details
        const user = await User.findById(decoded.userId)
            .populate('organizationId', 'name subscriptionPlan subscriptionStatus isActive')
            .select('-password');

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
                message: 'Account has been deactivated.'
            });
        }

        // Check organization status
        if (!user.organizationId || !user.organizationId.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Organization is not active.'
            });
        }

        // Check subscription status
        if (user.organizationId.subscriptionStatus === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Organization subscription is suspended.'
            });
        }

        // Add user and organization context to request
        req.user = user;
        req.organizationId = user.organizationId._id;
        req.organization = user.organizationId;
        req.userRole = user.role;
        req.userPermissions = user.permissions;
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        
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

// Permission-based authorization middleware
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        if (!req.user.hasPermission(permission)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required permission: ${permission}`
            });
        }

        next();
    };
};

// Multiple permissions (user needs ANY of the listed permissions)
const requireAnyPermission = (permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        if (!req.user.hasAnyPermission(permissions)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required permissions: ${permissions.join(' OR ')}`
            });
        }

        next();
    };
};

// Multiple permissions (user needs ALL of the listed permissions)
const requireAllPermissions = (permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        if (!req.user.hasAllPermissions(permissions)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required permissions: ${permissions.join(' AND ')}`
            });
        }

        next();
    };
};

// Role-based authorization middleware
const requireRole = (roles) => {
    const roleArray = Array.isArray(roles) ? roles : [roles];
    
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        if (!roleArray.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${roleArray.join(' OR ')}`
            });
        }

        next();
    };
};

// Organization context validation middleware
const validateOrganizationContext = (req, res, next) => {
    const requestedOrgId = req.params.organizationId || req.body.organizationId || req.query.organizationId;
    
    if (requestedOrgId) {
        // Super admin can access any organization
        if (req.user.role === 'super_admin') {
            req.targetOrganizationId = requestedOrgId;
            return next();
        }
        
        // Regular users can only access their own organization
        if (req.user.organizationId.toString() !== requestedOrgId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Cannot access different organization.'
            });
        }
        
        req.targetOrganizationId = requestedOrgId;
    } else {
        // Use user's organization if no specific org requested
        req.targetOrganizationId = req.user.organizationId;
    }
    
    next();
};

// Team context validation middleware
const validateTeamContext = async (req, res, next) => {
    try {
        const teamId = req.params.teamId || req.body.teamId || req.query.teamId;
        
        if (!teamId) {
            return next(); // No team context required
        }

        const Team = require('../models/Team');
        const team = await Team.findById(teamId);
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found.'
            });
        }

        // Check if team belongs to user's organization (unless super admin)
        if (req.user.role !== 'super_admin' && 
            team.organizationId.toString() !== req.user.organizationId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Team belongs to different organization.'
            });
        }

        // Check if user has access to this team
        const hasTeamAccess = req.user.role === 'super_admin' ||
                             req.user.role === 'org_admin' ||
                             team.isManager(req.user._id) ||
                             team.isMember(req.user._id);

        if (!hasTeamAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Not a member of this team.'
            });
        }

        req.team = team;
        req.teamRole = team.getMemberRole(req.user._id) || 
                      (team.isManager(req.user._id) ? 'manager' : null);
        
        next();
    } catch (error) {
        console.error('Team context validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Team validation error.'
        });
    }
};

// Subscription limit middleware
const checkSubscriptionLimits = (resource) => {
    return async (req, res, next) => {
        try {
            const organization = req.organization;
            
            // Skip for super admin
            if (req.user.role === 'super_admin') {
                return next();
            }

            let currentCount = 0;
            let limit = 0;

            switch (resource) {
                case 'users':
                    currentCount = await User.countByOrganization(organization._id);
                    limit = organization.userLimit || 5; // Free plan default
                    break;
                
                case 'calls':
                    const CallLog = require('../models/CallLog');
                    currentCount = await CallLog.countDocuments({ 
                        organizationId: organization._id,
                        createdAt: { 
                            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
                        }
                    });
                    limit = organization.callLimit || 50; // Free plan default
                    break;
                
                case 'contacts':
                    const Contact = require('../models/Contact');
                    currentCount = await Contact.countDocuments({ 
                        organizationId: organization._id 
                    });
                    limit = organization.contactLimit || 100; // Free plan default
                    break;
                
                case 'teams':
                    const Team = require('../models/Team');
                    currentCount = await Team.countDocuments({ 
                        organizationId: organization._id,
                        isActive: true 
                    });
                    limit = organization.teamLimit || 1; // Free plan default
                    break;
                
                default:
                    return next(); // Unknown resource, skip check
            }

            if (currentCount >= limit) {
                return res.status(403).json({
                    success: false,
                    message: `${resource} limit exceeded. Current: ${currentCount}/${limit}. Please upgrade your subscription.`,
                    limitInfo: {
                        resource,
                        current: currentCount,
                        limit,
                        subscriptionPlan: organization.subscriptionPlan
                    }
                });
            }

            // Add limit info to request for potential response
            req.limitInfo = {
                resource,
                current: currentCount,
                limit,
                remaining: limit - currentCount
            };

            next();
        } catch (error) {
            console.error('Subscription limit check error:', error);
            next(); // Continue on error to avoid blocking
        }
    };
};

// Data scope middleware - adds appropriate query filters based on user role
const applyDataScope = (req, res, next) => {
    const scope = req.user.getAccessScope();
    
    // Add scope to request for use in route handlers
    req.dataScope = scope;
    
    // Helper function to build scoped query
    req.buildScopedQuery = (baseQuery = {}) => {
        const scopedQuery = { ...baseQuery };
        
        if (scope.canViewAll) {
            // Super admin and org admin can see all data in organization
            scopedQuery.organizationId = scope.organizationId;
        } else if (scope.canViewTeam && scope.teamIds.length > 0) {
            // Managers can see team data
            scopedQuery.organizationId = scope.organizationId;
            scopedQuery.$or = [
                { assignedTo: scope.userId },
                { createdBy: scope.userId },
                { teamId: { $in: scope.teamIds } }
            ];
        } else {
            // Agents and viewers can only see their own data
            scopedQuery.organizationId = scope.organizationId;
            scopedQuery.$or = [
                { assignedTo: scope.userId },
                { createdBy: scope.userId },
                { userId: scope.userId }
            ];
        }
        
        return scopedQuery;
    };
    
    next();
};

// Rate limiting middleware for API calls based on subscription
const subscriptionRateLimit = (req, res, next) => {
    // Implementation would depend on your rate limiting strategy
    // This is a placeholder for subscription-based rate limiting
    
    const organization = req.organization;
    const plan = organization.subscriptionPlan;
    
    // Add rate limit headers
    res.set({
        'X-RateLimit-Plan': plan,
        'X-RateLimit-Organization': organization._id.toString()
    });
    
    next();
};

// Audit logging middleware
const auditLog = (action) => {
    return (req, res, next) => {
        // Log the action for audit purposes
        const auditData = {
            userId: req.user._id,
            organizationId: req.organizationId,
            action,
            timestamp: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            resource: req.originalUrl,
            method: req.method
        };
        
        // Add to request for potential use in route handlers
        req.auditData = auditData;
        
        // You can implement actual audit logging here
        console.log('Audit Log:', auditData);
        
        next();
    };
};

module.exports = {
    authenticate,
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireRole,
    validateOrganizationContext,
    validateTeamContext,
    checkSubscriptionLimits,
    applyDataScope,
    subscriptionRateLimit,
    auditLog
};