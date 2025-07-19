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
  
  // Role & Permissions
  role: {
    type: String,
    enum: ['admin', 'manager', 'agent', 'viewer'],
    default: 'admin' // First user becomes admin
  },
  permissions: [{
    type: String,
    enum: [
      'manage_team', 'view_all_calls', 'manage_leads', 
      'export_data', 'manage_settings', 'view_analytics'
    ],
    default: ['manage_team', 'view_all_calls', 'manage_leads', 'export_data', 'manage_settings', 'view_analytics']
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

// Indexes for better performance
userSchema.index({ organizationName: 1 });
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

module.exports = mongoose.model('User', userSchema);