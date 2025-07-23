const mongoose = require('mongoose');

const ticketNoteSchema = new mongoose.Schema({
    // Basic Information
    ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        required: true,
        index: true
    },
    content: {
        type: String,
        required: [true, 'Note content is required'],
        trim: true,
        maxlength: [5000, 'Note content cannot exceed 5000 characters']
    },
    
    // Note Type and Visibility
    type: {
        type: String,
        enum: ['note', 'status_update', 'resolution', 'escalation', 'customer_communication', 'internal_memo'],
        default: 'note',
        index: true
    },
    isInternal: {
        type: Boolean,
        default: false,
        index: true
    },
    visibility: {
        type: String,
        enum: ['public', 'internal', 'team_only', 'assignee_only', 'manager_only'],
        default: 'public'
    },
    
    // Author Information
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    authorName: {
        type: String,
        required: true,
        trim: true
    },
    authorRole: {
        type: String,
        enum: ['super_admin', 'org_admin', 'manager', 'agent', 'viewer'],
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
    
    // Communication Details
    communicationMethod: {
        type: String,
        enum: ['phone', 'email', 'chat', 'in_person', 'mobile_app', 'system'],
        default: 'system'
    },
    communicationDirection: {
        type: String,
        enum: ['inbound', 'outbound', 'internal'],
        default: 'internal'
    },
    
    // Customer Interaction
    customerContactInfo: {
        name: {
            type: String,
            trim: true
        },
        phone: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            trim: true,
            lowercase: true
        }
    },
    customerVisible: {
        type: Boolean,
        default: false,
        index: true
    },
    customerNotified: {
        type: Boolean,
        default: false
    },
    
    // Note Metadata
    tags: [{
        type: String,
        lowercase: true,
        trim: true,
        maxlength: [50, 'Tag cannot exceed 50 characters']
    }],
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
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
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Time Tracking
    timeSpent: {
        type: Number, // in minutes
        default: 0,
        min: 0
    },
    billableTime: {
        type: Number, // in minutes
        default: 0,
        min: 0
    },
    
    // Status and Follow-up
    requiresFollowUp: {
        type: Boolean,
        default: false,
        index: true
    },
    followUpDate: {
        type: Date,
        index: true
    },
    followUpAssignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isFollowUpCompleted: {
        type: Boolean,
        default: false
    },
    
    // Note Status
    status: {
        type: String,
        enum: ['draft', 'published', 'edited', 'deleted'],
        default: 'published',
        index: true
    },
    
    // Edit History
    editHistory: [{
        editedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        editedAt: {
            type: Date,
            default: Date.now
        },
        originalContent: {
            type: String,
            required: true
        },
        reason: {
            type: String,
            trim: true,
            maxlength: [200, 'Edit reason cannot exceed 200 characters']
        }
    }],
    
    // Mentions and Notifications
    mentions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        notified: {
            type: Boolean,
            default: false
        },
        notifiedAt: {
            type: Date
        }
    }],
    
    // Thread and Reply Management
    parentNoteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TicketNote',
        index: true
    },
    threadId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    replyCount: {
        type: Number,
        default: 0
    },
    
    // System Integration
    source: {
        type: String,
        enum: ['manual', 'email_integration', 'phone_system', 'chat_system', 'api', 'automation'],
        default: 'manual'
    },
    externalId: {
        type: String,
        trim: true,
        index: true, sparse: true
    },
    
    // Analytics and Metrics
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    reactions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        reaction: {
            type: String,
            enum: ['like', 'helpful', 'resolved', 'important'],
            required: true
        },
        reactedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Version Control
    version: {
        type: Number,
        default: 1
    },
    
    // Soft Delete
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date
    },
    deletedBy: {
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
    }
});

// Compound indexes for performance
ticketNoteSchema.index({ ticketId: 1, createdAt: -1 });
ticketNoteSchema.index({ organizationId: 1, authorId: 1, createdAt: -1 });
ticketNoteSchema.index({ ticketId: 1, isInternal: 1, status: 1 });
ticketNoteSchema.index({ authorId: 1, requiresFollowUp: 1, followUpDate: 1 });
ticketNoteSchema.index({ organizationId: 1, type: 1, createdAt: -1 });
ticketNoteSchema.index({ threadId: 1, createdAt: 1 });

// Pre-save middleware
ticketNoteSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedAt = Date.now();
        this.version += 1;
    }
    
    // Set thread ID if this is a top-level note
    if (this.isNew && !this.parentNoteId && !this.threadId) {
        this.threadId = this._id;
    }
    
    next();
});

// Post-save middleware to update ticket activity
ticketNoteSchema.post('save', async function(doc) {
    try {
        // Update parent ticket's last activity and response count
        const Ticket = mongoose.model('Ticket');
        await Ticket.findByIdAndUpdate(doc.ticketId, {
            lastActivityAt: Date.now(),
            $inc: { responseCount: 1 }
        });
        
        // Update parent note's reply count if this is a reply
        if (doc.parentNoteId) {
            await this.constructor.findByIdAndUpdate(doc.parentNoteId, {
                $inc: { replyCount: 1 }
            });
        }
    } catch (error) {
        console.error('Error updating ticket activity:', error);
    }
});

// Virtuals
ticketNoteSchema.virtual('isEdited').get(function() {
    return this.editHistory && this.editHistory.length > 0;
});

ticketNoteSchema.virtual('lastEditedAt').get(function() {
    if (this.editHistory && this.editHistory.length > 0) {
        return this.editHistory[this.editHistory.length - 1].editedAt;
    }
    return null;
});

ticketNoteSchema.virtual('readCount').get(function() {
    return this.readBy ? this.readBy.length : 0;
});

ticketNoteSchema.virtual('isOverdue').get(function() {
    return this.requiresFollowUp && 
           this.followUpDate && 
           this.followUpDate < new Date() && 
           !this.isFollowUpCompleted;
});

// Instance methods
ticketNoteSchema.methods.editContent = function(newContent, editedBy, reason) {
    // Store original content in edit history
    this.editHistory.push({
        editedBy,
        editedAt: Date.now(),
        originalContent: this.content,
        reason: reason || 'Content updated'
    });
    
    this.content = newContent;
    this.status = 'edited';
    this.updatedAt = Date.now();
    
    return this.save();
};

ticketNoteSchema.methods.markAsRead = function(userId) {
    const existingRead = this.readBy.find(read => 
        read.userId.toString() === userId.toString()
    );
    
    if (!existingRead) {
        this.readBy.push({
            userId,
            readAt: Date.now()
        });
        return this.save();
    }
    
    return Promise.resolve(this);
};

ticketNoteSchema.methods.addReaction = function(userId, reaction) {
    // Remove existing reaction from same user
    this.reactions = this.reactions.filter(r => 
        r.userId.toString() !== userId.toString()
    );
    
    // Add new reaction
    this.reactions.push({
        userId,
        reaction,
        reactedAt: Date.now()
    });
    
    return this.save();
};

ticketNoteSchema.methods.removeReaction = function(userId) {
    this.reactions = this.reactions.filter(r => 
        r.userId.toString() !== userId.toString()
    );
    
    return this.save();
};

ticketNoteSchema.methods.addMention = function(userId) {
    const existingMention = this.mentions.find(mention => 
        mention.userId.toString() === userId.toString()
    );
    
    if (!existingMention) {
        this.mentions.push({
            userId,
            notified: false
        });
        return this.save();
    }
    
    return Promise.resolve(this);
};

ticketNoteSchema.methods.markMentionNotified = function(userId) {
    const mention = this.mentions.find(mention => 
        mention.userId.toString() === userId.toString()
    );
    
    if (mention) {
        mention.notified = true;
        mention.notifiedAt = Date.now();
        return this.save();
    }
    
    return Promise.resolve(this);
};

ticketNoteSchema.methods.softDelete = function(deletedBy) {
    this.isDeleted = true;
    this.deletedAt = Date.now();
    this.deletedBy = deletedBy;
    this.status = 'deleted';
    
    return this.save();
};

// Static methods
ticketNoteSchema.statics.findByTicket = function(ticketId, includeInternal = true, includeDeleted = false) {
    const query = { ticketId };
    
    if (!includeInternal) {
        query.isInternal = false;
    }
    
    if (!includeDeleted) {
        query.isDeleted = false;
    }
    
    return this.find(query)
        .populate('authorId', 'firstName lastName email role')
        .populate('mentions.userId', 'firstName lastName email')
        .populate('parentNoteId', 'content authorName createdAt')
        .sort({ createdAt: 1 });
};

ticketNoteSchema.statics.findByAuthor = function(authorId, organizationId, filters = {}) {
    const query = {
        authorId,
        organizationId,
        isDeleted: false,
        ...filters
    };
    
    return this.find(query)
        .populate('ticketId', 'ticketNumber title status priority')
        .sort({ createdAt: -1 });
};

ticketNoteSchema.statics.findRequiringFollowUp = function(organizationId, assignedTo = null) {
    const query = {
        organizationId,
        requiresFollowUp: true,
        isFollowUpCompleted: false,
        isDeleted: false
    };
    
    if (assignedTo) {
        query.followUpAssignedTo = assignedTo;
    }
    
    return this.find(query)
        .populate('ticketId', 'ticketNumber title status priority')
        .populate('authorId', 'firstName lastName email')
        .populate('followUpAssignedTo', 'firstName lastName email')
        .sort({ followUpDate: 1 });
};

ticketNoteSchema.statics.getNotesStats = function(organizationId, dateRange = {}) {
    const matchQuery = { organizationId, isDeleted: false };
    
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
                totalNotes: { $sum: 1 },
                internalNotes: { $sum: { $cond: ['$isInternal', 1, 0] } },
                publicNotes: { $sum: { $cond: ['$isInternal', 0, 1] } },
                followUpRequired: { $sum: { $cond: ['$requiresFollowUp', 1, 0] } },
                avgTimeSpent: { $avg: '$timeSpent' },
                totalTimeSpent: { $sum: '$timeSpent' },
                totalBillableTime: { $sum: '$billableTime' }
            }
        }
    ]);
};

ticketNoteSchema.statics.getTopContributors = function(organizationId, limit = 10) {
    return this.aggregate([
        { $match: { organizationId, isDeleted: false } },
        {
            $group: {
                _id: '$authorId',
                noteCount: { $sum: 1 },
                totalTimeSpent: { $sum: '$timeSpent' },
                totalBillableTime: { $sum: '$billableTime' },
                authorName: { $first: '$authorName' },
                authorRole: { $first: '$authorRole' }
            }
        },
        { $sort: { noteCount: -1 } },
        { $limit: limit }
    ]);
};

// Enable virtuals in JSON
ticketNoteSchema.set('toJSON', { virtuals: true });
ticketNoteSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TicketNote', ticketNoteSchema);