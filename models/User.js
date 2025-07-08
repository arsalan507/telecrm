const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  // Basic User Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    required: true
  },
  
  // Role & Permissions
  role: {
    type: String,
    enum: ['admin', 'manager', 'agent', 'viewer'],
    default: 'agent'
  },
  permissions: [{
    type: String,
    enum: [
      'manage_team', 'view_all_calls', 'manage_leads', 
      'export_data', 'manage_settings', 'view_analytics'
    ]
  }],
  
  // Team & Organization
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      userId: this._id, 
      email: this.email, 
      role: this.role,
      organizationId: this.organizationId 
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

module.exports = mongoose.model('User', userSchema);