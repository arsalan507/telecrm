// models/Invitation.js - Multi-Tenant User Invitation System
const mongoose = require('mongoose');
const crypto = require('crypto');

const invitationSchema = new mongoose.Schema({
    // Multi-tenant isolation
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization ID is required'],
        index: true
    },
    
    // Invitation Details
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
        index: true
    },
    
    // Inviter Information
    inviterUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Inviter user ID is required'],
        index: true
    },
    inviterName: {
        type: String,
        required: true
    },
    inviterEmail: {
        type: String,
        required: true
    },
    
    // Role & Permissions Assignment
    role: {
        type: String,
        enum: ['org_admin', 'manager', 'agent', 'viewer'],
        required: [true, 'Role is required'],
        default: 'agent'
    },
    permissions: [{
        type: String,
        enum: [
            'manage_team', 'view_all_calls', 'manage_leads', 
            'export_data', 'manage_settings', 'view_analytics',
            'invite_users', 'manage_user_roles', 'view_all_users',
            'manage_organization', 'manage_billing', 'manage_subscription'
        ]
    }],
    
    // Team Assignment
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        index: true
    },
    teamRole: {
        type: String,
        enum: ['manager', 'agent', 'viewer'],
        default: 'agent'
    },
    
    // Invitation Security
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Invitation Status
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'expired', 'revoked'],
        default: 'pending',
        index: true
    },
    
    // Invitation Lifecycle
    sentAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    acceptedAt: Date,
    declinedAt: Date,
    revokedAt: Date,
    
    // Accepted User Reference
    acceptedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Invitation Message
    message: {
        type: String,
        maxlength: [500, 'Message cannot exceed 500 characters'],
        trim: true
    },
    customMessage: {
        type: String,
        maxlength: [1000, 'Custom message cannot exceed 1000 characters'],
        trim: true
    },
    
    // Email Tracking
    emailsSent: [{
        sentAt: {
            type: Date,
            default: Date.now
        },
        type: {
            type: String,
            enum: ['initial', 'reminder', 'final_reminder'],
            default: 'initial'
        },
        emailProvider: String,
        messageId: String
    }],
    emailOpened: {
        type: Boolean,
        default: false
    },
    emailOpenedAt: Date,
    linkClicked: {
        type: Boolean,
        default: false
    },
    linkClickedAt: Date,
    
    // Invitation Type
    invitationType: {
        type: String,
        enum: ['manual', 'bulk', 'auto_generated'],
        default: 'manual'
    },
    
    // Additional Metadata
    metadata: {
        ipAddress: String,
        userAgent: String,
        source: {
            type: String,
            enum: ['web_dashboard', 'mobile_app', 'api', 'csv_import'],
            default: 'web_dashboard'
        },
        campaign: String, // For tracking invitation campaigns
        referralCode: String
    },
    
    // Reminder Settings
    remindersSent: {
        type: Number,
        default: 0,
        max: 3
    },
    nextReminderAt: Date,
    
    // Notes
    notes: [{
        content: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for optimization
invitationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
invitationSchema.index({ token: 1, status: 1 });
invitationSchema.index({ email: 1, organizationId: 1 });
invitationSchema.index({ expiresAt: 1, status: 1 });
invitationSchema.index({ inviterUserId: 1, createdAt: -1 });
invitationSchema.index({ teamId: 1, status: 1 });

// Virtual for time remaining
invitationSchema.virtual('timeRemaining').get(function() {
    if (this.status !== 'pending') return null;
    const now = new Date();
    const remaining = this.expiresAt - now;
    return remaining > 0 ? remaining : 0;
});

// Virtual for days remaining
invitationSchema.virtual('daysRemaining').get(function() {
    const timeRemaining = this.timeRemaining;
    if (!timeRemaining) return 0;
    return Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
});

// Virtual for invitation URL
invitationSchema.virtual('invitationUrl').get(function() {
    const baseUrl = process.env.FRONTEND_URL || 'https://app.calltrackerPro.com';
    return `${baseUrl}/invite/accept/${this.token}`;
});

// Pre-save middleware
invitationSchema.pre('save', function(next) {
    // Set expiration if not set (default 7 days)
    if (!this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    
    // Generate token if not set
    if (!this.token) {
        this.token = crypto.randomBytes(32).toString('hex');
    }
    
    // Set next reminder date
    if (this.status === 'pending' && !this.nextReminderAt && this.remindersSent < 3) {
        this.nextReminderAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
    }
    
    next();
});

// Static method to find pending invitations for organization
invitationSchema.statics.findPendingByOrganization = function(organizationId) {
    return this.find({
        organizationId,
        status: 'pending',
        expiresAt: { $gt: new Date() }
    }).populate('inviterUserId', 'firstName lastName email')
      .populate('teamId', 'name');
};

// Static method to find invitation by token
invitationSchema.statics.findByToken = function(token) {
    return this.findOne({
        token,
        status: 'pending',
        expiresAt: { $gt: new Date() }
    }).populate('organizationId')
      .populate('teamId', 'name')
      .populate('inviterUserId', 'firstName lastName email');
};

// Static method to find expired invitations
invitationSchema.statics.findExpired = function() {
    return this.find({
        status: 'pending',
        expiresAt: { $lt: new Date() }
    });
};

// Static method to find invitations needing reminders
invitationSchema.statics.findNeedingReminders = function() {
    return this.find({
        status: 'pending',
        nextReminderAt: { $lt: new Date() },
        remindersSent: { $lt: 3 },
        expiresAt: { $gt: new Date() }
    });
};

// Method to accept invitation
invitationSchema.methods.accept = function(userId) {
    this.status = 'accepted';
    this.acceptedAt = new Date();
    this.acceptedUserId = userId;
    return this.save();
};

// Method to decline invitation
invitationSchema.methods.decline = function() {
    this.status = 'declined';
    this.declinedAt = new Date();
    return this.save();
};

// Method to revoke invitation
invitationSchema.methods.revoke = function() {
    this.status = 'revoked';
    this.revokedAt = new Date();
    return this.save();
};

// Method to mark as expired
invitationSchema.methods.expire = function() {
    this.status = 'expired';
    return this.save();
};

// Method to track email sent
invitationSchema.methods.trackEmailSent = function(type = 'initial', provider = null, messageId = null) {
    this.emailsSent.push({
        sentAt: new Date(),
        type,
        emailProvider: provider,
        messageId
    });
    
    if (type === 'reminder') {
        this.remindersSent += 1;
        // Set next reminder (2 days later)
        if (this.remindersSent < 3) {
            this.nextReminderAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        } else {
            this.nextReminderAt = null;
        }
    }
    
    return this.save();
};

// Method to track email opened
invitationSchema.methods.trackEmailOpened = function() {
    if (!this.emailOpened) {
        this.emailOpened = true;
        this.emailOpenedAt = new Date();
        return this.save();
    }
};

// Method to track link clicked
invitationSchema.methods.trackLinkClicked = function() {
    if (!this.linkClicked) {
        this.linkClicked = true;
        this.linkClickedAt = new Date();
        return this.save();
    }
};

// Method to add note
invitationSchema.methods.addNote = function(content, userId) {
    this.notes.push({
        content,
        addedBy: userId,
        addedAt: new Date()
    });
    return this.save();
};

// Method to check if invitation is valid
invitationSchema.methods.isValid = function() {
    return this.status === 'pending' && this.expiresAt > new Date();
};

// Method to extend expiration
invitationSchema.methods.extendExpiration = function(days = 7) {
    this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.save();
};

// Method to get invitation summary
invitationSchema.methods.getSummary = function() {
    return {
        id: this._id,
        email: this.email,
        role: this.role,
        status: this.status,
        inviterName: this.inviterName,
        teamName: this.teamId?.name,
        sentAt: this.sentAt,
        expiresAt: this.expiresAt,
        daysRemaining: this.daysRemaining,
        emailOpened: this.emailOpened,
        linkClicked: this.linkClicked
    };
};

module.exports = mongoose.model('Invitation', invitationSchema);