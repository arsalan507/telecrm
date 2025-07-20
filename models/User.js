const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  // Basic User Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    minlength: [10, 'Phone number must be at least 10 digits']
  },
  
  // NEW: Organization Information
  organizationName: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    minlength: [2, 'Organization name must be at least 2 characters'],
    maxlength: [100, 'Organization name cannot exceed 100 characters']
  },
  
  // Enhanced Role & Permissions System
  role: {
    type: String,
    enum: ['super_admin', 'org_admin', 'manager', 'agent', 'viewer'],
    default: 'org_admin', // First user becomes organization admin
    index: true
  },
  permissions: [{
    type: String,
    enum: [
      // Organization Management
      'manage_organization', 'manage_billing', 'manage_subscription',
      
      // Team Management  
      'manage_teams', 'manage_team_members', 'view_team_analytics',
      
      // User Management
      'invite_users', 'manage_user_roles', 'view_all_users',
      
      // Existing permissions (enhanced)
      'manage_team', 'view_all_calls', 'manage_leads', 
      'export_data', 'manage_settings', 'view_analytics',
      
      // Contact & Lead Management
      'view_all_contacts', 'manage_all_contacts', 'view_team_contacts',
      'manage_team_contacts', 'view_own_contacts', 'manage_own_contacts',
      
      // Call Management
      'view_all_call_logs', 'manage_all_call_logs', 'view_team_call_logs',
      'manage_team_call_logs', 'view_own_call_logs', 'manage_own_call_logs',
      
      // Analytics & Reporting
      'view_organization_analytics', 'view_team_analytics', 'view_own_analytics',
      'export_organization_data', 'export_team_data', 'export_own_data',
      
      // System Administration
      'manage_system_settings', 'view_system_logs', 'manage_integrations'
    ],
    default: function() {
      // Set default permissions based on role
      switch(this.role) {
        case 'super_admin':
          return [
            'manage_organization', 'manage_billing', 'manage_subscription',
            'manage_teams', 'manage_team_members', 'view_team_analytics',
            'invite_users', 'manage_user_roles', 'view_all_users',
            'manage_team', 'view_all_calls', 'manage_leads', 'export_data',
            'manage_settings', 'view_analytics', 'view_all_contacts',
            'manage_all_contacts', 'view_all_call_logs', 'manage_all_call_logs',
            'view_organization_analytics', 'export_organization_data',
            'manage_system_settings', 'view_system_logs', 'manage_integrations'
          ];
        case 'org_admin':
          return [
            'manage_organization', 'manage_billing', 'manage_subscription',
            'manage_teams', 'manage_team_members', 'view_team_analytics',
            'invite_users', 'manage_user_roles', 'view_all_users',
            'manage_team', 'view_all_calls', 'manage_leads', 'export_data',
            'manage_settings', 'view_analytics', 'view_all_contacts',
            'manage_all_contacts', 'view_all_call_logs', 'manage_all_call_logs',
            'view_organization_analytics', 'export_organization_data'
          ];
        case 'manager':
          return [
            'manage_teams', 'manage_team_members', 'view_team_analytics',
            'invite_users', 'view_all_users', 'manage_team', 'view_all_calls',
            'manage_leads', 'export_data', 'view_analytics', 'view_team_contacts',
            'manage_team_contacts', 'view_team_call_logs', 'manage_team_call_logs',
            'view_team_analytics', 'export_team_data'
          ];
        case 'agent':
          return [
            'manage_leads', 'view_own_contacts', 'manage_own_contacts',
            'view_own_call_logs', 'manage_own_call_logs', 'view_own_analytics',
            'export_own_data'
          ];
        case 'viewer':
          return [
            'view_own_contacts', 'view_own_call_logs', 'view_own_analytics'
          ];
        default:
          return ['view_own_contacts', 'view_own_call_logs'];
      }
    }
  }],
  
  // Team-specific permissions (for users in multiple teams)
  teamPermissions: [{
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    role: {
      type: String,
      enum: ['manager', 'agent', 'viewer'],
      default: 'agent'
    },
    permissions: [{
      type: String
    }],
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Team & Organization References
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  
  // Profile Information
  avatar: {
    type: String
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  
  // Subscription & Limits
  subscriptionPlan: {
    type: String,
    enum: ['free', 'pro', 'business', 'enterprise'],
    default: 'free'
  },
  callLimit: {
    type: Number,
    default: 50 // Free plan limit
  },
  callsUsed: {
    type: Number,
    default: 0
  },
  
  // Security
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Signup Source Tracking
  signupSource: {
    type: String,
    enum: ['web', 'android', 'ios', 'api'],
    default: 'android'
  },
  signupStep: {
    type: String,
    enum: ['completed', 'pending_verification'],
    default: 'completed'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Enhanced indexes for multi-tenant optimization
userSchema.index({ organizationName: 1 });
userSchema.index({ organizationId: 1, role: 1 });
userSchema.index({ organizationId: 1, isActive: 1 });
userSchema.index({ organizationId: 1, teamId: 1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with higher salt rounds for better security
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamps before saving
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Generate JWT token
userSchema.methods.generateAuthToken = function() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  
  return jwt.sign(
    { 
      userId: this._id, 
      email: this.email, 
      role: this.role,
      organizationId: this.organizationId,
      organizationName: this.organizationName
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Update last login
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  return await this.save({ validateBeforeSave: false });
};

// Get full name virtual
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Get user stats virtual
userSchema.virtual('callLimitPercentage').get(function() {
  return this.callLimit > 0 ? Math.round((this.callsUsed / this.callLimit) * 100) : 0;
});

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to check if email exists
userSchema.statics.emailExists = async function(email) {
  const user = await this.findOne({ email: email.toLowerCase() });
  return !!user;
};

// Enhanced static methods for multi-tenant operations
userSchema.statics.findByOrganization = function(organizationId, includeInactive = false) {
  const query = { organizationId };
  if (!includeInactive) {
    query.isActive = true;
  }
  return this.find(query).select('-password');
};

userSchema.statics.findByRole = function(organizationId, role) {
  return this.find({ organizationId, role, isActive: true }).select('-password');
};

userSchema.statics.findByTeam = function(teamId, includeInactive = false) {
  const query = { teamId };
  if (!includeInactive) {
    query.isActive = true;
  }
  return this.find(query).select('-password');
};

userSchema.statics.countByOrganization = function(organizationId) {
  return this.countDocuments({ organizationId, isActive: true });
};

userSchema.statics.countByRole = function(organizationId, role) {
  return this.countDocuments({ organizationId, role, isActive: true });
};

// Enhanced instance methods for permission checking
userSchema.methods.hasPermission = function(permission) {
  // Super admin has all permissions
  if (this.role === 'super_admin') {
    return true;
  }
  
  return this.permissions.includes(permission);
};

userSchema.methods.hasAnyPermission = function(permissions) {
  if (this.role === 'super_admin') {
    return true;
  }
  
  return permissions.some(permission => this.permissions.includes(permission));
};

userSchema.methods.hasAllPermissions = function(permissions) {
  if (this.role === 'super_admin') {
    return true;
  }
  
  return permissions.every(permission => this.permissions.includes(permission));
};

userSchema.methods.canAccessOrganization = function(organizationId) {
  return this.role === 'super_admin' || 
         this.organizationId.toString() === organizationId.toString();
};

userSchema.methods.canManageUser = function(targetUser) {
  // Super admin can manage anyone
  if (this.role === 'super_admin') {
    return true;
  }
  
  // Must be in same organization
  if (this.organizationId.toString() !== targetUser.organizationId.toString()) {
    return false;
  }
  
  // Org admin can manage everyone in their org except super admins
  if (this.role === 'org_admin' && targetUser.role !== 'super_admin') {
    return true;
  }
  
  // Managers can manage agents and viewers in their team
  if (this.role === 'manager' && 
      ['agent', 'viewer'].includes(targetUser.role) &&
      this.teamId && targetUser.teamId &&
      this.teamId.toString() === targetUser.teamId.toString()) {
    return true;
  }
  
  return false;
};

userSchema.methods.getTeamRole = function(teamId) {
  const teamPermission = this.teamPermissions.find(tp => 
    tp.teamId.toString() === teamId.toString() && tp.isActive
  );
  return teamPermission ? teamPermission.role : null;
};

userSchema.methods.hasTeamPermission = function(teamId, permission) {
  if (this.role === 'super_admin') return true;
  
  const teamPermission = this.teamPermissions.find(tp => 
    tp.teamId.toString() === teamId.toString() && tp.isActive
  );
  
  return teamPermission ? teamPermission.permissions.includes(permission) : false;
};

userSchema.methods.addToTeam = function(teamId, role = 'agent', permissions = []) {
  // Remove existing team permission if exists
  this.teamPermissions = this.teamPermissions.filter(tp => 
    tp.teamId.toString() !== teamId.toString()
  );
  
  // Add new team permission
  this.teamPermissions.push({
    teamId,
    role,
    permissions,
    joinedAt: new Date(),
    isActive: true
  });
  
  return this.save();
};

userSchema.methods.removeFromTeam = function(teamId) {
  const teamPermission = this.teamPermissions.find(tp => 
    tp.teamId.toString() === teamId.toString()
  );
  
  if (teamPermission) {
    teamPermission.isActive = false;
  }
  
  return this.save();
};

userSchema.methods.updateRole = function(newRole, newPermissions = null) {
  this.role = newRole;
  
  if (newPermissions) {
    this.permissions = newPermissions;
  } else {
    // Set default permissions based on new role
    this.permissions = this.schema.paths.permissions.default.call({ role: newRole });
  }
  
  return this.save();
};

userSchema.methods.getAccessScope = function() {
  // Define what data this user can access based on role
  const scope = {
    organizationId: this.organizationId,
    canViewAll: false,
    canViewTeam: false,
    canViewOwn: true,
    teamIds: [],
    userId: this._id
  };
  
  if (['super_admin', 'org_admin'].includes(this.role)) {
    scope.canViewAll = true;
  } else if (this.role === 'manager') {
    scope.canViewTeam = true;
    scope.teamIds = [this.teamId, ...this.teamPermissions
      .filter(tp => tp.isActive && tp.role === 'manager')
      .map(tp => tp.teamId)
    ].filter(Boolean);
  } else {
    // Agents and viewers - own data only
    scope.canViewOwn = true;
  }
  
  return scope;
};

userSchema.methods.getSafeProfile = function() {
  const profile = this.toObject();
  delete profile.password;
  delete profile.passwordResetToken;
  delete profile.emailVerificationToken;
  return profile;
};

module.exports = mongoose.model('User', userSchema);