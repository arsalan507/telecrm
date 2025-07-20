// routes/invitations.js - Multi-Tenant User Invitation System
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Invitation = require('../models/Invitation');
const User = require('../models/User');
const Team = require('../models/Team');
const Organization = require('../models/Organization');
const { 
    authenticate, 
    requirePermission, 
    validateOrganizationContext,
    validateTeamContext,
    checkSubscriptionLimits,
    auditLog
} = require('../middleware/multiTenantAuth');

// @route   POST /api/organizations/:organizationId/invitations
// @desc    Send invitation to new user
// @access  Org Admin, Manager (with invite_users permission)
router.post('/:organizationId',
    authenticate,
    validateOrganizationContext,
    requirePermission('invite_users'),
    checkSubscriptionLimits('users'),
    auditLog('SEND_INVITATION'),
    async (req, res) => {
        try {
            const { email, role, teamId, permissions, message, customMessage } = req.body;

            // Validate required fields
            if (!email || !role) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and role are required'
                });
            }

            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'User with this email already exists'
                });
            }

            // Check if there's already a pending invitation
            const existingInvitation = await Invitation.findOne({
                email: email.toLowerCase(),
                organizationId: req.targetOrganizationId,
                status: 'pending',
                expiresAt: { $gt: new Date() }
            });

            if (existingInvitation) {
                return res.status(409).json({
                    success: false,
                    message: 'Pending invitation already exists for this email'
                });
            }

            // Validate team if specified
            let team = null;
            if (teamId) {
                team = await Team.findById(teamId);
                if (!team || team.organizationId.toString() !== req.targetOrganizationId.toString()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid team specified'
                    });
                }
            }

            // Validate role permissions
            const validRoles = ['org_admin', 'manager', 'agent', 'viewer'];
            if (!validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role specified'
                });
            }

            // Check if user can assign this role
            if (role === 'org_admin' && req.user.role !== 'super_admin' && req.user.role !== 'org_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot assign org_admin role'
                });
            }

            // Create invitation
            const invitation = new Invitation({
                organizationId: req.targetOrganizationId,
                email: email.toLowerCase(),
                role,
                teamId,
                permissions: permissions || [],
                inviterUserId: req.user._id,
                inviterName: req.user.fullName,
                inviterEmail: req.user.email,
                message,
                customMessage,
                token: crypto.randomBytes(32).toString('hex'),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    source: 'web_dashboard'
                }
            });

            await invitation.save();

            // TODO: Send invitation email
            await sendInvitationEmail(invitation);

            res.status(201).json({
                success: true,
                message: 'Invitation sent successfully',
                data: {
                    invitationId: invitation._id,
                    email: invitation.email,
                    role: invitation.role,
                    expiresAt: invitation.expiresAt,
                    invitationUrl: invitation.invitationUrl
                }
            });
        } catch (error) {
            console.error('Send invitation error:', error);
            res.status(500).json({
                success: false,
                message: 'Error sending invitation'
            });
        }
    }
);

// @route   GET /api/organizations/:organizationId/invitations
// @desc    Get organization invitations
// @access  Org Admin, Manager
router.get('/:organizationId',
    authenticate,
    validateOrganizationContext,
    requirePermission('invite_users'),
    async (req, res) => {
        try {
            const { status, page = 1, limit = 20 } = req.query;

            let query = { organizationId: req.targetOrganizationId };
            if (status) query.status = status;

            const invitations = await Invitation.find(query)
                .populate('inviterUserId', 'firstName lastName email')
                .populate('teamId', 'name')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Invitation.countDocuments(query);

            // Get invitation statistics
            const stats = await Invitation.aggregate([
                { $match: { organizationId: req.targetOrganizationId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            res.json({
                success: true,
                data: {
                    invitations: invitations.map(inv => inv.getSummary()),
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalInvitations: total,
                        limit
                    },
                    stats: stats.reduce((acc, stat) => {
                        acc[stat._id] = stat.count;
                        return acc;
                    }, {})
                }
            });
        } catch (error) {
            console.error('Get invitations error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving invitations'
            });
        }
    }
);

// @route   POST /api/invitations/:token/accept
// @desc    Accept invitation
// @access  Public (token-based)
router.post('/:token/accept', async (req, res) => {
    try {
        const { firstName, lastName, password, phone } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !password) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, and password are required'
            });
        }

        // Find valid invitation
        const invitation = await Invitation.findByToken(req.params.token);
        
        if (!invitation) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired invitation'
            });
        }

        // Check if email is already registered
        const existingUser = await User.findByEmail(invitation.email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create user account
        const userData = {
            firstName,
            lastName,
            email: invitation.email,
            phone: phone || '',
            organizationId: invitation.organizationId,
            organizationName: invitation.organizationId.name,
            teamId: invitation.teamId,
            role: invitation.role,
            permissions: invitation.permissions,
            password,
            isActive: true,
            signupSource: 'invitation',
            signupStep: 'completed'
        };

        const user = new User(userData);
        await user.save();

        // Add user to team if specified
        if (invitation.teamId) {
            const team = await Team.findById(invitation.teamId);
            if (team) {
                await team.addMember(user._id, invitation.teamRole || 'agent');
            }
        }

        // Mark invitation as accepted
        await invitation.accept(user._id);

        // Generate auth token
        const token = user.generateAuthToken();

        // Track invitation acceptance
        await invitation.trackLinkClicked();

        res.status(201).json({
            success: true,
            message: `Welcome to ${invitation.organizationId.name}! Your account has been created successfully.`,
            token,
            user: user.getSafeProfile(),
            expiresIn: 604800 // 7 days
        });
    } catch (error) {
        console.error('Accept invitation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error accepting invitation'
        });
    }
});

// @route   GET /api/invitations/:token
// @desc    Get invitation details
// @access  Public (token-based)
router.get('/:token', async (req, res) => {
    try {
        const invitation = await Invitation.findByToken(req.params.token);
        
        if (!invitation) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired invitation'
            });
        }

        // Track link clicked
        await invitation.trackLinkClicked();

        res.json({
            success: true,
            data: {
                organizationName: invitation.organizationId.name,
                teamName: invitation.teamId?.name,
                role: invitation.role,
                inviterName: invitation.inviterName,
                inviterEmail: invitation.inviterEmail,
                email: invitation.email,
                expiresAt: invitation.expiresAt,
                message: invitation.message,
                customMessage: invitation.customMessage,
                daysRemaining: invitation.daysRemaining
            }
        });
    } catch (error) {
        console.error('Get invitation details error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving invitation details'
        });
    }
});

// @route   POST /api/invitations/:token/decline
// @desc    Decline invitation
// @access  Public (token-based)
router.post('/:token/decline', async (req, res) => {
    try {
        const invitation = await Invitation.findByToken(req.params.token);
        
        if (!invitation) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired invitation'
            });
        }

        await invitation.decline();

        res.json({
            success: true,
            message: 'Invitation declined successfully'
        });
    } catch (error) {
        console.error('Decline invitation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error declining invitation'
        });
    }
});

// @route   DELETE /api/organizations/:organizationId/invitations/:invitationId
// @desc    Revoke invitation
// @access  Org Admin, Manager (who sent the invitation)
router.delete('/:organizationId/:invitationId',
    authenticate,
    validateOrganizationContext,
    requirePermission('invite_users'),
    auditLog('REVOKE_INVITATION'),
    async (req, res) => {
        try {
            const invitation = await Invitation.findById(req.params.invitationId);
            
            if (!invitation) {
                return res.status(404).json({
                    success: false,
                    message: 'Invitation not found'
                });
            }

            // Check organization access
            if (invitation.organizationId.toString() !== req.targetOrganizationId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot access invitation from different organization'
                });
            }

            // Check if user can revoke this invitation
            if (req.user.role !== 'super_admin' && 
                req.user.role !== 'org_admin' && 
                invitation.inviterUserId.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Can only revoke your own invitations'
                });
            }

            await invitation.revoke();

            res.json({
                success: true,
                message: 'Invitation revoked successfully'
            });
        } catch (error) {
            console.error('Revoke invitation error:', error);
            res.status(500).json({
                success: false,
                message: 'Error revoking invitation'
            });
        }
    }
);

// @route   POST /api/organizations/:organizationId/invitations/:invitationId/resend
// @desc    Resend invitation email
// @access  Org Admin, Manager (who sent the invitation)
router.post('/:organizationId/:invitationId/resend',
    authenticate,
    validateOrganizationContext,
    requirePermission('invite_users'),
    async (req, res) => {
        try {
            const invitation = await Invitation.findById(req.params.invitationId);
            
            if (!invitation) {
                return res.status(404).json({
                    success: false,
                    message: 'Invitation not found'
                });
            }

            // Check if invitation is still valid
            if (!invitation.isValid()) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot resend expired or inactive invitation'
                });
            }

            // Check organization access
            if (invitation.organizationId.toString() !== req.targetOrganizationId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot access invitation from different organization'
                });
            }

            // Check if user can resend this invitation
            if (req.user.role !== 'super_admin' && 
                req.user.role !== 'org_admin' && 
                invitation.inviterUserId.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Can only resend your own invitations'
                });
            }

            // Check reminder limits
            if (invitation.remindersSent >= 3) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum reminders already sent'
                });
            }

            // Send reminder email
            await sendInvitationEmail(invitation, 'reminder');
            
            // Track email sent
            await invitation.trackEmailSent('reminder');

            res.json({
                success: true,
                message: 'Invitation reminder sent successfully',
                data: {
                    remindersSent: invitation.remindersSent,
                    nextReminderAt: invitation.nextReminderAt
                }
            });
        } catch (error) {
            console.error('Resend invitation error:', error);
            res.status(500).json({
                success: false,
                message: 'Error resending invitation'
            });
        }
    }
);

// @route   POST /api/organizations/:organizationId/invitations/bulk
// @desc    Send bulk invitations
// @access  Org Admin, Super Admin
router.post('/:organizationId/bulk',
    authenticate,
    validateOrganizationContext,
    requirePermission('invite_users'),
    auditLog('SEND_BULK_INVITATIONS'),
    async (req, res) => {
        try {
            const { invitations, defaultRole = 'agent', defaultTeamId } = req.body;

            if (!Array.isArray(invitations) || invitations.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invitations array is required and cannot be empty'
                });
            }

            if (invitations.length > 50) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot send more than 50 invitations at once'
                });
            }

            const results = {
                successful: [],
                failed: [],
                skipped: []
            };

            for (const invitationData of invitations) {
                try {
                    const { email, role, teamId, permissions } = invitationData;
                    
                    if (!email) {
                        results.failed.push({ email, error: 'Email is required' });
                        continue;
                    }

                    // Check if user already exists
                    const existingUser = await User.findByEmail(email);
                    if (existingUser) {
                        results.skipped.push({ email, reason: 'User already exists' });
                        continue;
                    }

                    // Check for existing pending invitation
                    const existingInvitation = await Invitation.findOne({
                        email: email.toLowerCase(),
                        organizationId: req.targetOrganizationId,
                        status: 'pending',
                        expiresAt: { $gt: new Date() }
                    });

                    if (existingInvitation) {
                        results.skipped.push({ email, reason: 'Pending invitation already exists' });
                        continue;
                    }

                    // Create invitation
                    const invitation = new Invitation({
                        organizationId: req.targetOrganizationId,
                        email: email.toLowerCase(),
                        role: role || defaultRole,
                        teamId: teamId || defaultTeamId,
                        permissions: permissions || [],
                        inviterUserId: req.user._id,
                        inviterName: req.user.fullName,
                        inviterEmail: req.user.email,
                        invitationType: 'bulk',
                        token: crypto.randomBytes(32).toString('hex'),
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        metadata: {
                            ipAddress: req.ip,
                            userAgent: req.get('User-Agent'),
                            source: 'bulk_import'
                        }
                    });

                    await invitation.save();
                    
                    // Send invitation email
                    await sendInvitationEmail(invitation);
                    
                    results.successful.push({
                        email: invitation.email,
                        invitationId: invitation._id,
                        role: invitation.role
                    });

                } catch (error) {
                    console.error(`Bulk invitation error for ${invitationData.email}:`, error);
                    results.failed.push({ 
                        email: invitationData.email, 
                        error: error.message 
                    });
                }
            }

            res.status(201).json({
                success: true,
                message: `Bulk invitation process completed. ${results.successful.length} sent, ${results.failed.length} failed, ${results.skipped.length} skipped.`,
                data: results
            });
        } catch (error) {
            console.error('Bulk invitation error:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing bulk invitations'
            });
        }
    }
);

// Helper function to send invitation email
async function sendInvitationEmail(invitation, type = 'initial') {
    // TODO: Implement email sending logic
    // This would integrate with your email service (SendGrid, SES, etc.)
    
    console.log(`Sending ${type} invitation email to ${invitation.email}`);
    console.log(`Invitation URL: ${invitation.invitationUrl}`);
    
    // Track email sent
    await invitation.trackEmailSent(type, 'system');
    
    return true;
}

module.exports = router;