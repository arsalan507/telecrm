// models/Organization.js - Organization/Company Schema
const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    maxLength: 100
  },
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.?[a-zA-Z]{2,}$/.test(v);
      },
      message: 'Please enter a valid domain'
    }
  },
  description: {
    type: String,
    trim: true,
    maxLength: 500
  },
  plan: {
    type: String,
    enum: ['basic', 'professional', 'enterprise'],
    default: 'basic',
    index: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  logo: {
    type: String,
    default: null
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty website
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Website must be a valid URL'
    }
  },
  industry: {
    type: String,
    enum: [
      'Technology', 'Healthcare', 'Finance', 'Education', 'Retail',
      'Manufacturing', 'Real Estate', 'Insurance', 'Consulting', 'Other'
    ]
  },
  size: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '500+']
  },
  
  // Contact Information
  address: {
    street: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    pincode: String
  },
  phone: {
    type: String,
    trim: true
  },
  
  // Subscription Management
  subscriptionPlan: {
    type: String,
    enum: ['free', 'pro', 'business', 'enterprise'],
    default: 'free'
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'trial', 'expired'],
    default: 'trial'
  },
  subscriptionStartDate: {
    type: Date,
    default: Date.now
  },
  subscriptionEndDate: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setDate(date.getDate() + 14); // 14-day trial
      return date;
    }
  },
  
  // Limits based on subscription
  userLimit: {
    type: Number,
    default: function() {
      switch(this.subscriptionPlan) {
        case 'free': return 3;
        case 'pro': return 10;
        case 'business': return 50;
        case 'enterprise': return 999;
        default: return 3;
      }
    }
  },
  callLimit: {
    type: Number,
    default: function() {
      switch(this.subscriptionPlan) {
        case 'free': return 500;
        case 'pro': return 5000;
        case 'business': return 50000;
        case 'enterprise': return 999999;
        default: return 500;
      }
    }
  },
  
  // Owner & Billing
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  billingEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  
  // Organization Settings
  settings: {
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    currency: {
      type: String,
      default: 'INR'
    },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' }
    },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }],
    features: {
      callRecording: { type: Boolean, default: true },
      analytics: { type: Boolean, default: true },
      teamManagement: { type: Boolean, default: true },
      apiAccess: { type: Boolean, default: false },
      whatsappIntegration: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false }
    },
    branding: {
      primaryColor: { type: String, default: '#1ABCB4' },
      secondaryColor: { type: String, default: '#00D4B8' },
      customLogo: String,
      companyName: String
    }
  },
  
  // Usage Tracking
  monthlyStats: {
    callsUsed: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }, // in MB
    apiCallsUsed: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  },
  
  // Billing Information
  billing: {
    customerId: String, // Stripe/Razorpay customer ID
    subscriptionId: String, // Stripe/Razorpay subscription ID
    paymentMethod: {
      type: String,
      enum: ['card', 'bank_transfer', 'upi', 'wallet']
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'annually'],
      default: 'monthly'
    },
    nextBillingDate: Date,
    lastPaymentDate: Date,
    totalPaid: { type: Number, default: 0 }
  },
  
  // API Configuration
  apiConfig: {
    apiKey: String,
    webhookUrl: String,
    allowedIPs: [String],
    rateLimit: { type: Number, default: 1000 } // requests per hour
  },
  
  // Compliance & Security
  compliance: {
    dataRetentionDays: { type: Number, default: 365 },
    gdprCompliant: { type: Boolean, default: true },
    dataProcessingConsent: { type: Boolean, default: false },
    auditTrail: { type: Boolean, default: false }
  },
  
  // Integration Settings
  integrations: {
    whatsapp: {
      enabled: { type: Boolean, default: false },
      businessApiKey: String,
      phoneNumberId: String,
      webhookVerifyToken: String
    },
    email: {
      provider: { type: String, enum: ['smtp', 'sendgrid', 'mailgun'] },
      config: mongoose.Schema.Types.Mixed
    },
    crm: {
      enabled: { type: Boolean, default: false },
      provider: String,
      apiCredentials: mongoose.Schema.Types.Mixed
    }
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
organizationSchema.index({ domain: 1 });
organizationSchema.index({ plan: 1 });
organizationSchema.index({ slug: 1 });
organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ subscriptionStatus: 1 });
organizationSchema.index({ subscriptionPlan: 1 });

// Pre-save middleware
organizationSchema.pre('save', function(next) {
  // Generate slug if not exists
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  
  // Set billing email to owner's email if not set
  if (!this.billingEmail && this.ownerId) {
    // This will be populated when we have the user
  }
  
  next();
});

// Instance methods
organizationSchema.methods.isActive = function() {
  return ['active', 'trial'].includes(this.subscriptionStatus);
};

organizationSchema.methods.isPremium = function() {
  return !['free'].includes(this.subscriptionPlan);
};

organizationSchema.methods.isTrialExpired = function() {
  return this.subscriptionStatus === 'trial' && new Date() > this.subscriptionEndDate;
};

organizationSchema.methods.getDaysRemaining = function() {
  if (this.subscriptionStatus !== 'trial') return null;
  const now = new Date();
  const end = new Date(this.subscriptionEndDate);
  const diffTime = end - now;
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
};

organizationSchema.methods.canAddUsers = function(currentUserCount) {
  return currentUserCount < this.userLimit;
};

organizationSchema.methods.getRemainingUsers = function(currentUserCount) {
  return Math.max(0, this.userLimit - currentUserCount);
};

organizationSchema.methods.updateMonthlyStats = function(callsIncrement = 0, storageIncrement = 0) {
  this.monthlyStats.callsUsed += callsIncrement;
  this.monthlyStats.storageUsed += storageIncrement;
  return this.save();
};

organizationSchema.methods.resetMonthlyStats = function() {
  this.monthlyStats.callsUsed = 0;
  this.monthlyStats.storageUsed = 0;
  this.monthlyStats.apiCallsUsed = 0;
  this.monthlyStats.lastReset = new Date();
  return this.save();
};

organizationSchema.methods.generateApiKey = function() {
  const crypto = require('crypto');
  this.apiConfig.apiKey = 'ctp_' + crypto.randomBytes(32).toString('hex');
  return this.save();
};

// Static methods
organizationSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug });
};

organizationSchema.statics.getSubscriptionStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$subscriptionPlan',
        count: { $sum: 1 },
        activeCount: {
          $sum: { $cond: [{ $eq: ['$subscriptionStatus', 'active'] }, 1, 0] }
        }
      }
    }
  ]);
};

organizationSchema.statics.getExpiringTrials = function(days = 3) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  
  return this.find({
    subscriptionStatus: 'trial',
    subscriptionEndDate: { $lte: expiryDate }
  }).populate('ownerId', 'firstName lastName email');
};

// Virtual for active users count
organizationSchema.virtual('activeUsersCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'organizationId',
  count: true,
  match: { isActive: true }
});

// Virtual for total calls this month
organizationSchema.virtual('totalCallsThisMonth').get(function() {
  return this.monthlyStats.callsUsed;
});

// Virtual for usage percentage
organizationSchema.virtual('callUsagePercentage').get(function() {
  if (this.callLimit === 0) return 0;
  return Math.round((this.monthlyStats.callsUsed / this.callLimit) * 100);
});

// Ensure virtuals are included in JSON
organizationSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Remove sensitive fields
    delete ret.apiConfig.apiKey;
    delete ret.integrations.whatsapp.businessApiKey;
    delete ret.integrations.whatsapp.webhookVerifyToken;
    delete ret.billing.customerId;
    delete ret.billing.subscriptionId;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Organization', organizationSchema);