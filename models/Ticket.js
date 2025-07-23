const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    // Ticket Identification
    ticketNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    title: {
        type: String,
        required: [true, 'Ticket title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Ticket description is required'],
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    
    // Status Management
    status: {
        type: String,
        required: true,
        enum: ['open', 'in_progress', 'pending_customer', 'resolved', 'closed', 'cancelled'],
        default: 'open',
        index: true
    },
    priority: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high', 'urgent', 'critical'],
        default: 'medium',
        index: true
    },
    category: {
        type: String,
        required: true,
        enum: [
            'technical_support', 'billing', 'feature_request', 
            'bug_report', 'account_issue', 'sales_inquiry',
            'complaint', 'general_inquiry', 'other'
        ],
        default: 'general_inquiry',
        index: true
    },
    subcategory: {
        type: String,
        trim: true,
        maxlength: [100, 'Subcategory cannot exceed 100 characters']
    },
    
    // Customer Information
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
        index: true
    },
    customerName: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Customer name cannot exceed 100 characters']
    },
    customerEmail: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
    },
    customerPhone: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    
    // Assignment & Ownership
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        index: true
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    
    // Related Records
    callLogIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CallLog'
    }],
    relatedTickets: [{
        ticketId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ticket'
        },
        relationship: {
            type: String,
            enum: ['duplicate', 'related', 'blocks', 'blocked_by', 'child', 'parent'],
            default: 'related'
        }
    }],
    
    // Time Tracking
    estimatedResolutionTime: {
        type: Number, // in hours
        min: 0
    },
    actualResolutionTime: {
        type: Number, // in hours
        min: 0
    },
    firstResponseTime: {
        type: Date
    },
    resolutionDate: {
        type: Date
    },
    dueDate: {
        type: Date,
        index: true
    },
    
    // SLA Management
    slaLevel: {
        type: String,
        enum: ['standard', 'premium', 'enterprise'],
        default: 'standard'
    },
    slaBreached: {
        type: Boolean,
        default: false,
        index: true
    },
    escalationLevel: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    escalatedAt: {
        type: Date
    },
    escalatedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Communication Tracking
    lastContactDate: {
        type: Date,
        default: Date.now
    },
    contactMethod: {
        type: String,
        enum: ['phone', 'email', 'chat', 'in_person', 'mobile_app'],
        default: 'phone'
    },
    responseCount: {
        type: Number,
        default: 0
    },
    
    // Resolution Information
    resolution: {
        summary: {
            type: String,
            maxlength: [1000, 'Resolution summary cannot exceed 1000 characters']
        },
        details: {
            type: String,
            maxlength: [2000, 'Resolution details cannot exceed 2000 characters']
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rootCause: {
            type: String,
            maxlength: [500, 'Root cause cannot exceed 500 characters']
        },
        preventiveMeasures: {
            type: String,
            maxlength: [500, 'Preventive measures cannot exceed 500 characters']
        }
    },
    
    // Customer Satisfaction
    customerSatisfaction: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        feedback: {
            type: String,
            maxlength: [1000, 'Feedback cannot exceed 1000 characters']
        },
        surveyDate: {
            type: Date
        }
    },
    
    // Tags and Labels
    tags: [{
        type: String,
        lowercase: true,
        trim: true,
        maxlength: [50, 'Tag cannot exceed 50 characters']
    }],
    
    // Internal Notes
    internalNotes: {
        type: String,
        maxlength: [2000, 'Internal notes cannot exceed 2000 characters']
    },
    
    // Attachments
    attachments: [{
        filename: {
            type: String,
            required: true
        },
        originalName: {
            type: String,
            required: true
        },
        mimeType: {
            type: String,
            required: true
        },
        size: {
            type: Number,
            required: true
        },
        path: {
            type: String,
            required: true
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Workflow and Automation
    workflowState: {
        type: String,
        enum: ['draft', 'submitted', 'in_review', 'approved', 'completed'],
        default: 'submitted'
    },
    automationTriggers: [{
        type: String,
        enum: ['status_change', 'priority_change', 'assignment_change', 'due_date_approach', 'sla_breach']
    }],
    
    // Business Intelligence
    source: {
        type: String,
        enum: ['phone_call', 'email', 'web_form', 'mobile_app', 'chat', 'walk_in', 'social_media'],
        default: 'phone_call',
        index: true
    },
    channel: {
        type: String,
        enum: ['support', 'sales', 'billing', 'technical', 'general'],
        default: 'support'
    },
    
    // Metadata
    version: {
        type: Number,
        default: 1
    },
    isArchived: {
        type: Boolean,
        default: false,
        index: true
    },
    archivedAt: {
        type: Date
    },
    archivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    lastActivityAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound indexes for performance
ticketSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });
ticketSchema.index({ organizationId: 1, priority: 1, dueDate: 1 });
ticketSchema.index({ organizationId: 1, category: 1, status: 1 });
ticketSchema.index({ customerPhone: 1, organizationId: 1 });
ticketSchema.index({ createdAt: -1, organizationId: 1 });
ticketSchema.index({ slaBreached: 1, organizationId: 1 });
ticketSchema.index({ teamId: 1, status: 1 });

// Generate ticket number before saving
ticketSchema.pre('save', async function(next) {
    if (this.isNew && !this.ticketNumber) {
        try {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            
            // Find the last ticket for this organization in the current month
            const lastTicket = await this.constructor
                .findOne({ 
                    organizationId: this.organizationId,
                    ticketNumber: new RegExp(`^TKT-${year}${month}-`)
                })
                .sort({ ticketNumber: -1 });
            
            let sequence = 1;
            if (lastTicket) {
                const lastSequence = parseInt(lastTicket.ticketNumber.split('-')[2]);
                sequence = lastSequence + 1;
            }
            
            this.ticketNumber = `TKT-${year}${month}-${String(sequence).padStart(4, '0')}`;
        } catch (error) {
            return next(error);
        }
    }
    
    // Update timestamps
    if (this.isModified() && !this.isNew) {
        this.updatedAt = Date.now();
        this.lastActivityAt = Date.now();
        this.version += 1;
    }
    
    next();
});

// Virtuals
ticketSchema.virtual('age').get(function() {
    return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // Age in days
});

ticketSchema.virtual('isOverdue').get(function() {
    return this.dueDate && this.dueDate < new Date() && !['resolved', 'closed'].includes(this.status);
});

ticketSchema.virtual('timeToFirstResponse').get(function() {
    if (!this.firstResponseTime) return null;
    return Math.floor((this.firstResponseTime - this.createdAt) / (1000 * 60)); // Minutes
});

ticketSchema.virtual('timeToResolution').get(function() {
    if (!this.resolutionDate) return null;
    return Math.floor((this.resolutionDate - this.createdAt) / (1000 * 60 * 60)); // Hours
});

// Instance methods
ticketSchema.methods.assignTo = function(userId) {
    this.assignedTo = userId;
    this.lastActivityAt = Date.now();
    return this.save();
};

ticketSchema.methods.updateStatus = function(newStatus, userId) {
    const oldStatus = this.status;
    this.status = newStatus;
    this.lastActivityAt = Date.now();
    
    // Set resolution date if resolving
    if (newStatus === 'resolved' && oldStatus !== 'resolved') {
        this.resolutionDate = Date.now();
        if (this.resolution && !this.resolution.resolvedBy) {
            this.resolution.resolvedBy = userId;
        }
    }
    
    return this.save();
};

ticketSchema.methods.escalate = function(toUserId, level) {
    this.escalationLevel = level || this.escalationLevel + 1;
    this.escalatedAt = Date.now();
    this.escalatedTo = toUserId;
    this.lastActivityAt = Date.now();
    
    // Auto-increase priority if escalated multiple times
    if (this.escalationLevel >= 2 && this.priority === 'medium') {
        this.priority = 'high';
    } else if (this.escalationLevel >= 3 && this.priority === 'high') {
        this.priority = 'urgent';
    }
    
    return this.save();
};

ticketSchema.methods.addNote = function(content, userId, isInternal = false) {
    // This will be implemented with TicketNote model
    this.responseCount += 1;
    this.lastActivityAt = Date.now();
    return this.save();
};

ticketSchema.methods.linkToCallLog = function(callLogId) {
    if (!this.callLogIds.includes(callLogId)) {
        this.callLogIds.push(callLogId);
        this.lastActivityAt = Date.now();
        return this.save();
    }
    return Promise.resolve(this);
};

ticketSchema.methods.setCustomerSatisfaction = function(rating, feedback) {
    this.customerSatisfaction = {
        rating,
        feedback,
        surveyDate: Date.now()
    };
    return this.save();
};

// Static methods
ticketSchema.statics.findByOrganization = function(organizationId, filters = {}) {
    const query = { organizationId, isArchived: false, ...filters };
    return this.find(query)
        .populate('assignedTo', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('customerId', 'name phone email')
        .sort({ createdAt: -1 });
};

ticketSchema.statics.findByAssignee = function(assignedTo, organizationId, filters = {}) {
    const query = { assignedTo, organizationId, isArchived: false, ...filters };
    return this.find(query)
        .populate('customerId', 'name phone email')
        .sort({ priority: -1, createdAt: -1 });
};

ticketSchema.statics.getTicketStats = function(organizationId, dateRange = {}) {
    const matchQuery = { organizationId, isArchived: false };
    
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
                _id: null,
                total: { $sum: 1 },
                open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
                resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
                closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
                overdue: { 
                    $sum: { 
                        $cond: [
                            { 
                                $and: [
                                    { $lt: ['$dueDate', new Date()] },
                                    { $not: { $in: ['$status', ['resolved', 'closed']] } }
                                ]
                            }, 
                            1, 
                            0
                        ] 
                    } 
                },
                avgResolutionTime: { $avg: '$actualResolutionTime' }
            }
        }
    ]);
};

ticketSchema.statics.getTicketsByStatus = function(organizationId) {
    return this.aggregate([
        { $match: { organizationId, isArchived: false } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                tickets: { $push: '$$ROOT' }
            }
        }
    ]);
};

ticketSchema.statics.getTicketsByPriority = function(organizationId) {
    return this.aggregate([
        { $match: { organizationId, isArchived: false } },
        {
            $group: {
                _id: '$priority',
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

ticketSchema.statics.getOverdueTickets = function(organizationId) {
    return this.find({
        organizationId,
        dueDate: { $lt: new Date() },
        status: { $nin: ['resolved', 'closed'] },
        isArchived: false
    })
    .populate('assignedTo', 'firstName lastName email')
    .populate('customerId', 'name phone email')
    .sort({ dueDate: 1 });
};

// Enable virtuals in JSON
ticketSchema.set('toJSON', { virtuals: true });
ticketSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Ticket', ticketSchema);