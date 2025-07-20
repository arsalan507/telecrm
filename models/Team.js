// models/Team.js - Team Management for Multi-Tenant Organizations
const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    // Multi-tenant isolation
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization ID is required'],
        index: true
    },
    
    // Team Information
    name: {
        type: String,
        required: [true, 'Team name is required'],
        trim: true,
        maxlength: [100, 'Team name cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    
    // Team Hierarchy
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Team manager is required'],
        index: true
    },
    parentTeamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        index: true
    },
    
    // Team Members
    members: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['manager', 'agent', 'viewer'],
            default: 'agent'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    
    // Team Settings
    permissions: [{
        type: String,
        enum: [
            'view_team_calls', 'manage_team_calls', 'view_team_contacts',
            'manage_team_contacts', 'view_team_analytics', 'manage_team_settings',
            'invite_team_members', 'remove_team_members'
        ]
    }],
    
    // Team Configuration
    settings: {
        maxMembers: {
            type: Number,
            default: 50,
            min: 1,
            max: 500
        },
        autoAssignLeads: {
            type: Boolean,
            default: false
        },
        leadAssignmentMethod: {
            type: String,
            enum: ['round_robin', 'random', 'manual', 'workload_based'],
            default: 'manual'
        },
        allowSelfAssignment: {
            type: Boolean,
            default: true
        },
        requireManagerApproval: {
            type: Boolean,
            default: false
        }
    },
    
    // Team Targets & Goals
    targets: {
        monthlyCallTarget: {
            type: Number,
            default: 0,
            min: 0
        },
        monthlyLeadTarget: {
            type: Number,
            default: 0,
            min: 0
        },
        monthlyConversionTarget: {
            type: Number,
            default: 0,
            min: 0
        },
        monthlyRevenueTarget: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    
    // Team Statistics (updated periodically)
    stats: {
        totalMembers: {
            type: Number,
            default: 0
        },
        activeMembers: {
            type: Number,
            default: 0
        },
        totalCalls: {
            type: Number,
            default: 0
        },
        totalContacts: {
            type: Number,
            default: 0
        },
        totalConversions: {
            type: Number,
            default: 0
        },
        totalRevenue: {
            type: Number,
            default: 0
        },
        lastStatsUpdate: Date
    },
    
    // Team Status
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    
    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }],
    
    // Timestamps
    archivedAt: Date,
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

// Indexes for optimization
teamSchema.index({ organizationId: 1, isActive: 1 });
teamSchema.index({ organizationId: 1, managerId: 1 });
teamSchema.index({ organizationId: 1, createdAt: -1 });
teamSchema.index({ 'members.userId': 1, 'members.isActive': 1 });

// Virtual for active members count
teamSchema.virtual('activeMemberCount').get(function() {
    return this.members.filter(member => member.isActive).length;
});

// Virtual for team hierarchy path
teamSchema.virtual('hierarchyPath').get(function() {
    // This would be populated during queries to show full path
    return this.name;
});

// Pre-save middleware to update stats
teamSchema.pre('save', function(next) {
    this.stats.totalMembers = this.members.length;
    this.stats.activeMembers = this.members.filter(m => m.isActive).length;
    this.lastActivityAt = new Date();
    next();
});

// Static method to find teams by organization
teamSchema.statics.findByOrganization = function(organizationId, includeArchived = false) {
    const query = { organizationId };
    if (!includeArchived) {
        query.isArchived = false;
    }
    return this.find(query).populate('managerId', 'firstName lastName email');
};

// Static method to find teams by manager
teamSchema.statics.findByManager = function(managerId, organizationId) {
    return this.find({ 
        managerId, 
        organizationId,
        isActive: true,
        isArchived: false 
    });
};

// Method to add team member
teamSchema.methods.addMember = function(userId, role = 'agent') {
    // Check if user is already a member
    const existingMember = this.members.find(member => 
        member.userId.toString() === userId.toString()
    );
    
    if (existingMember) {
        if (!existingMember.isActive) {
            existingMember.isActive = true;
            existingMember.role = role;
            existingMember.joinedAt = new Date();
        }
        return this.save();
    }
    
    // Check team capacity
    if (this.members.length >= this.settings.maxMembers) {
        throw new Error(`Team has reached maximum capacity of ${this.settings.maxMembers} members`);
    }
    
    this.members.push({
        userId,
        role,
        joinedAt: new Date(),
        isActive: true
    });
    
    return this.save();
};

// Method to remove team member
teamSchema.methods.removeMember = function(userId) {
    const memberIndex = this.members.findIndex(member => 
        member.userId.toString() === userId.toString()
    );
    
    if (memberIndex === -1) {
        throw new Error('User is not a member of this team');
    }
    
    // Don't remove, just deactivate to maintain history
    this.members[memberIndex].isActive = false;
    return this.save();
};

// Method to update member role
teamSchema.methods.updateMemberRole = function(userId, newRole) {
    const member = this.members.find(member => 
        member.userId.toString() === userId.toString() && member.isActive
    );
    
    if (!member) {
        throw new Error('Active member not found');
    }
    
    member.role = newRole;
    return this.save();
};

// Method to check if user is team member
teamSchema.methods.isMember = function(userId) {
    return this.members.some(member => 
        member.userId.toString() === userId.toString() && member.isActive
    );
};

// Method to check if user is team manager
teamSchema.methods.isManager = function(userId) {
    return this.managerId.toString() === userId.toString();
};

// Method to get member role
teamSchema.methods.getMemberRole = function(userId) {
    const member = this.members.find(member => 
        member.userId.toString() === userId.toString() && member.isActive
    );
    return member ? member.role : null;
};

// Method to archive team
teamSchema.methods.archive = function() {
    this.isArchived = true;
    this.isActive = false;
    this.archivedAt = new Date();
    return this.save();
};

// Method to update team statistics
teamSchema.methods.updateStats = async function() {
    const CallLog = mongoose.model('CallLog');
    const Contact = mongoose.model('Contact');
    
    // Get team member IDs
    const memberIds = this.members
        .filter(m => m.isActive)
        .map(m => m.userId);
    
    // Calculate stats
    const [callStats, contactStats] = await Promise.all([
        CallLog.aggregate([
            { $match: { userId: { $in: memberIds }, organizationId: this.organizationId } },
            { $group: { 
                _id: null, 
                totalCalls: { $sum: 1 },
                totalDuration: { $sum: '$duration' }
            }}
        ]),
        Contact.aggregate([
            { $match: { assignedTo: { $in: memberIds }, organizationId: this.organizationId } },
            { $group: { 
                _id: null,
                totalContacts: { $sum: 1 },
                totalConversions: { 
                    $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] }
                },
                totalRevenue: { $sum: '$dealValue' }
            }}
        ])
    ]);
    
    // Update stats
    this.stats.totalCalls = callStats[0]?.totalCalls || 0;
    this.stats.totalContacts = contactStats[0]?.totalContacts || 0;
    this.stats.totalConversions = contactStats[0]?.totalConversions || 0;
    this.stats.totalRevenue = contactStats[0]?.totalRevenue || 0;
    this.stats.lastStatsUpdate = new Date();
    
    return this.save();
};

module.exports = mongoose.model('Team', teamSchema);