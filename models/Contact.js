// models/Contact.js - Enhanced Multi-Tenant Contact Management
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    // Multi-tenant isolation
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization ID is required'],
        index: true
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        index: true
    },
    
    // Contact Information
    name: {
        type: String,
        required: [true, 'Contact name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
    },
    company: {
        type: String,
        trim: true,
        maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    
    // Lead Management
    status: {
        type: String,
        enum: ['new', 'contacted', 'interested', 'qualified', 'proposal', 'negotiation', 'converted', 'lost', 'not_interested'],
        default: 'new',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    source: {
        type: String,
        enum: ['call', 'email', 'website', 'referral', 'social_media', 'advertisement', 'trade_show', 'cold_outreach', 'other'],
        default: 'call'
    },
    
    // Assignment & Ownership
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    assignedAgent: {
        type: String // Keep for backward compatibility
    },
    
    // Interaction History
    lastContactDate: {
        type: Date,
        index: true
    },
    nextFollowUpDate: {
        type: Date,
        index: true
    },
    lastContactType: {
        type: String,
        enum: ['call', 'email', 'meeting', 'message', 'other']
    },
    
    // Notes & Details
    notes: [{
        content: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        type: {
            type: String,
            enum: ['note', 'call_summary', 'meeting_notes', 'follow_up'],
            default: 'note'
        }
    }],
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    
    // Business Information
    dealValue: {
        type: Number,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD',
        maxlength: 3
    },
    
    // Tags & Categories
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }],
    category: {
        type: String,
        trim: true,
        maxlength: 50
    },
    
    // Contact Preferences
    preferredContactMethod: {
        type: String,
        enum: ['phone', 'email', 'sms', 'whatsapp'],
        default: 'phone'
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    
    // Status & Tracking
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    isQualified: {
        type: Boolean,
        default: false
    },
    
    // Interaction Counters
    totalInteractions: {
        type: Number,
        default: 0
    },
    totalCalls: {
        type: Number,
        default: 0
    },
    totalEmails: {
        type: Number,
        default: 0
    },
    
    // Timestamps
    convertedAt: Date,
    lostAt: Date,
    lastActivityAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for multi-tenant optimization
contactSchema.index({ organizationId: 1, createdAt: -1 });
contactSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });
contactSchema.index({ organizationId: 1, teamId: 1, status: 1 });
contactSchema.index({ organizationId: 1, lastActivityAt: -1 });
contactSchema.index({ organizationId: 1, nextFollowUpDate: 1 });

// Compound index for phone uniqueness within organization
contactSchema.index({ organizationId: 1, phone: 1 }, { unique: true });

// Virtual for full contact info
contactSchema.virtual('fullContactInfo').get(function() {
    return `${this.name}${this.company ? ` (${this.company})` : ''} - ${this.phone}`;
});

// Virtual for days since last contact
contactSchema.virtual('daysSinceLastContact').get(function() {
    if (!this.lastContactDate) return null;
    return Math.floor((Date.now() - this.lastContactDate) / (1000 * 60 * 60 * 24));
});

// Update lastActivityAt before saving
contactSchema.pre('save', function(next) {
    this.lastActivityAt = new Date();
    next();
});

// Static method for organization-scoped queries
contactSchema.statics.findByOrganization = function(organizationId, query = {}) {
    return this.find({ organizationId, ...query });
};

// Static method for user-scoped queries (based on role)
contactSchema.statics.findByUserScope = function(userId, organizationId, role, query = {}) {
    const baseQuery = { organizationId, ...query };
    
    // Admins and managers can see all contacts in their organization
    if (['super_admin', 'org_admin', 'manager'].includes(role)) {
        return this.find(baseQuery);
    }
    
    // Agents can only see contacts assigned to them or created by them
    return this.find({
        ...baseQuery,
        $or: [
            { assignedTo: userId },
            { createdBy: userId }
        ]
    });
};

// Method to add interaction note
contactSchema.methods.addNote = function(content, userId, type = 'note') {
    this.notes.push({
        content,
        addedBy: userId,
        type,
        addedAt: new Date()
    });
    this.lastActivityAt = new Date();
    return this.save();
};

// Method to update interaction counters
contactSchema.methods.recordInteraction = function(type) {
    this.totalInteractions += 1;
    this.lastActivityAt = new Date();
    
    switch(type) {
        case 'call':
            this.totalCalls += 1;
            this.lastContactType = 'call';
            break;
        case 'email':
            this.totalEmails += 1;
            this.lastContactType = 'email';
            break;
        default:
            this.lastContactType = type;
    }
    
    this.lastContactDate = new Date();
    return this.save();
};

module.exports = mongoose.model('Contact', contactSchema);