const mongoose = require('mongoose');

const ticketHistorySchema = new mongoose.Schema({
    // Basic Information
    ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        required: true,
        index: true
    },
    
    // Change Information
    action: {
        type: String,
        required: true,
        enum: [
            'created', 'updated', 'assigned', 'unassigned', 'status_changed',
            'priority_changed', 'category_changed', 'due_date_changed',
            'escalated', 'resolved', 'closed', 'reopened', 'archived',
            'note_added', 'attachment_added', 'attachment_removed',
            'customer_satisfaction_updated', 'linked_to_call',
            'unlinked_from_call', 'merged', 'split', 'tag_added',
            'tag_removed', 'team_changed', 'sla_breached', 'workflow_changed'
        ],
        index: true
    },
    
    // Actor Information
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    performedByName: {
        type: String,
        required: true,
        trim: true
    },
    performedByRole: {
        type: String,
        enum: ['super_admin', 'org_admin', 'manager', 'agent', 'viewer', 'system'],
        required: true
    },
    
    // Organization Context
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        index: true
    },
    
    // Change Details
    fieldName: {
        type: String,
        trim: true,
        index: true
    },
    oldValue: {
        type: mongoose.Schema.Types.Mixed
    },
    newValue: {
        type: mongoose.Schema.Types.Mixed
    },
    
    // Change Description
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    details: {
        type: String,
        trim: true,
        maxlength: [1000, 'Details cannot exceed 1000 characters']
    },
    
    // System vs Manual Change
    source: {
        type: String,
        enum: ['manual', 'system', 'automation', 'api', 'integration', 'workflow'],
        default: 'manual',
        index: true
    },
    
    // Related Information
    relatedEntityType: {
        type: String,
        enum: ['TicketNote', 'CallLog', 'Contact', 'Ticket', 'User', 'Team'],
        sparse: true
    },
    relatedEntityId: {
        type: mongoose.Schema.Types.ObjectId,
        sparse: true
    },
    
    // IP and Location (for audit purposes)
    ipAddress: {
        type: String,
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    },
    location: {
        country: String,
        region: String,
        city: String
    },
    
    // Change Context
    changeReason: {
        type: String,
        trim: true,
        maxlength: [200, 'Change reason cannot exceed 200 characters']
    },
    batchId: {
        type: String, // For grouping related changes
        index: true, sparse: true
    },
    
    // Notification and Communication
    notificationSent: {
        type: Boolean,
        default: false
    },
    notificationRecipients: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        email: String,
        notificationMethod: {
            type: String,
            enum: ['email', 'sms', 'push', 'in_app'],
            default: 'email'
        },
        sent: {
            type: Boolean,
            default: false
        },
        sentAt: Date
    }],
    
    // Approval Workflow (for sensitive changes)
    requiresApproval: {
        type: Boolean,
        default: false
    },
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'not_required'],
        default: 'not_required'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    approvalNotes: {
        type: String,
        trim: true,
        maxlength: [500, 'Approval notes cannot exceed 500 characters']
    },
    
    // Impact Assessment
    impactLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    },
    affectedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // Rollback Information
    canRollback: {
        type: Boolean,
        default: false
    },
    rollbackData: {
        type: mongoose.Schema.Types.Mixed
    },
    rolledBack: {
        type: Boolean,
        default: false
    },
    rollbackBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rollbackAt: {
        type: Date
    },
    rollbackReason: {
        type: String,
        trim: true
    },
    
    // Metadata
    version: {
        type: Number,
        default: 1
    },
    isSystemGenerated: {
        type: Boolean,
        default: false,
        index: true
    },
    tags: [{
        type: String,
        lowercase: true,
        trim: true
    }],
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    effectiveAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound indexes for performance
ticketHistorySchema.index({ ticketId: 1, createdAt: -1 });
ticketHistorySchema.index({ organizationId: 1, action: 1, createdAt: -1 });
ticketHistorySchema.index({ performedBy: 1, createdAt: -1 });
ticketHistorySchema.index({ ticketId: 1, action: 1, fieldName: 1 });
ticketHistorySchema.index({ organizationId: 1, isSystemGenerated: 1, createdAt: -1 });
ticketHistorySchema.index({ batchId: 1, createdAt: 1 }, { sparse: true });
ticketHistorySchema.index({ approvalStatus: 1, requiresApproval: 1 });

// Pre-save middleware
ticketHistorySchema.pre('save', function(next) {
    // Generate description if not provided
    if (!this.description) {
        this.description = this.generateDescription();
    }
    
    // Set system generated flag for system users
    if (this.performedByRole === 'system') {
        this.isSystemGenerated = true;
    }
    
    next();
});

// Instance methods
ticketHistorySchema.methods.generateDescription = function() {
    const actor = this.performedByName || 'System';
    
    switch (this.action) {
        case 'created':
            return `${actor} created the ticket`;
        case 'assigned':
            return `${actor} assigned ticket to ${this.newValue}`;
        case 'unassigned':
            return `${actor} unassigned ticket from ${this.oldValue}`;
        case 'status_changed':
            return `${actor} changed status from "${this.oldValue}" to "${this.newValue}"`;
        case 'priority_changed':
            return `${actor} changed priority from "${this.oldValue}" to "${this.newValue}"`;
        case 'category_changed':
            return `${actor} changed category from "${this.oldValue}" to "${this.newValue}"`;
        case 'due_date_changed':
            return `${actor} changed due date from ${this.oldValue} to ${this.newValue}`;
        case 'escalated':
            return `${actor} escalated ticket to level ${this.newValue}`;
        case 'resolved':
            return `${actor} resolved the ticket`;
        case 'closed':
            return `${actor} closed the ticket`;
        case 'reopened':
            return `${actor} reopened the ticket`;
        case 'note_added':
            return `${actor} added a note`;
        case 'attachment_added':
            return `${actor} added an attachment`;
        case 'linked_to_call':
            return `${actor} linked ticket to call log`;
        case 'customer_satisfaction_updated':
            return `Customer satisfaction rating updated to ${this.newValue}/5`;
        case 'tag_added':
            return `${actor} added tag "${this.newValue}"`;
        case 'tag_removed':
            return `${actor} removed tag "${this.oldValue}"`;
        case 'team_changed':
            return `${actor} transferred ticket from ${this.oldValue} to ${this.newValue}`;
        case 'sla_breached':
            return `SLA breached for this ticket`;
        default:
            return `${actor} performed ${this.action} on ticket`;
    }
};

ticketHistorySchema.methods.rollback = function(performedBy, reason) {
    if (!this.canRollback || this.rolledBack) {
        throw new Error('This change cannot be rolled back');
    }
    
    this.rolledBack = true;
    this.rollbackBy = performedBy;
    this.rollbackAt = Date.now();
    this.rollbackReason = reason;
    
    return this.save();
};

ticketHistorySchema.methods.approve = function(approvedBy, notes) {
    if (!this.requiresApproval) {
        throw new Error('This change does not require approval');
    }
    
    this.approvalStatus = 'approved';
    this.approvedBy = approvedBy;
    this.approvedAt = Date.now();
    this.approvalNotes = notes;
    
    return this.save();
};

ticketHistorySchema.methods.reject = function(rejectedBy, notes) {
    if (!this.requiresApproval) {
        throw new Error('This change does not require approval');
    }
    
    this.approvalStatus = 'rejected';
    this.approvedBy = rejectedBy;
    this.approvedAt = Date.now();
    this.approvalNotes = notes;
    
    return this.save();
};

// Static methods
ticketHistorySchema.statics.createEntry = function(ticketId, action, performedBy, changes = {}) {
    const entry = new this({
        ticketId,
        action,
        performedBy: performedBy._id,
        performedByName: performedBy.fullName || `${performedBy.firstName} ${performedBy.lastName}`,
        performedByRole: performedBy.role,
        organizationId: performedBy.organizationId,
        teamId: performedBy.teamId,
        ...changes
    });
    
    return entry.save();
};

ticketHistorySchema.statics.findByTicket = function(ticketId, limit = 50) {
    return this.find({ ticketId })
        .populate('performedBy', 'firstName lastName email role')
        .populate('approvedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(limit);
};

ticketHistorySchema.statics.findByUser = function(performedBy, organizationId, filters = {}) {
    const query = {
        performedBy,
        organizationId,
        ...filters
    };
    
    return this.find(query)
        .populate('ticketId', 'ticketNumber title status priority')
        .sort({ createdAt: -1 });
};

ticketHistorySchema.statics.getActivityStats = function(organizationId, dateRange = {}) {
    const matchQuery = { organizationId };
    
    if (dateRange.start && dateRange.end) {
        matchQuery.createdAt = {
            $gte: dateRange.start,
            $lte: dateRange.end
        };
    }
    
    return this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$action',
                count: { $sum: 1 },
                users: { $addToSet: '$performedBy' }
            }
        },
        { $sort: { count: -1 } }
    ]);
};

ticketHistorySchema.statics.getUserActivity = function(organizationId, dateRange = {}) {
    const matchQuery = { organizationId, isSystemGenerated: false };
    
    if (dateRange.start && dateRange.end) {
        matchQuery.createdAt = {
            $gte: dateRange.start,
            $lte: dateRange.end
        };
    }
    
    return this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$performedBy',
                activityCount: { $sum: 1 },
                actions: { $addToSet: '$action' },
                userName: { $first: '$performedByName' },
                userRole: { $first: '$performedByRole' },
                lastActivity: { $max: '$createdAt' }
            }
        },
        { $sort: { activityCount: -1 } }
    ]);
};

ticketHistorySchema.statics.getTicketTimeline = function(ticketId) {
    return this.find({ ticketId })
        .populate('performedBy', 'firstName lastName email avatar')
        .populate('relatedEntityId')
        .sort({ createdAt: 1 });
};

ticketHistorySchema.statics.getSystemChanges = function(organizationId, limit = 100) {
    return this.find({
        organizationId,
        isSystemGenerated: true
    })
    .populate('ticketId', 'ticketNumber title')
    .sort({ createdAt: -1 })
    .limit(limit);
};

ticketHistorySchema.statics.getPendingApprovals = function(organizationId) {
    return this.find({
        organizationId,
        requiresApproval: true,
        approvalStatus: 'pending'
    })
    .populate('performedBy', 'firstName lastName email')
    .populate('ticketId', 'ticketNumber title priority')
    .sort({ createdAt: 1 });
};

ticketHistorySchema.statics.getBatchChanges = function(batchId) {
    return this.find({ batchId })
        .populate('ticketId', 'ticketNumber title')
        .populate('performedBy', 'firstName lastName email')
        .sort({ createdAt: 1 });
};

ticketHistorySchema.statics.getAuditTrail = function(organizationId, filters = {}) {
    const query = { organizationId, ...filters };
    
    return this.find(query)
        .populate('performedBy', 'firstName lastName email role')
        .populate('ticketId', 'ticketNumber title status')
        .select('action fieldName oldValue newValue description createdAt ipAddress')
        .sort({ createdAt: -1 });
};

// Virtual for formatted change
ticketHistorySchema.virtual('formattedChange').get(function() {
    if (!this.fieldName) return this.description;
    
    let change = `${this.fieldName} changed`;
    if (this.oldValue) change += ` from "${this.oldValue}"`;
    if (this.newValue) change += ` to "${this.newValue}"`;
    
    return change;
});

// Virtual for time ago
ticketHistorySchema.virtual('timeAgo').get(function() {
    const now = new Date();
    const diffMs = now - this.createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
});

// Enable virtuals in JSON
ticketHistorySchema.set('toJSON', { virtuals: true });
ticketHistorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TicketHistory', ticketHistorySchema);