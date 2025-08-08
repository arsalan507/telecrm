// Minimal Express app to test deployment issues
require('dotenv').config();
const express = require('express');
// const cors = require('cors'); // Removed to use manual CORS headers
const mongoose = require('mongoose');

const app = express();

// Connect to MongoDB with extensive error handling and retry
const connectDB = async () => {
  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    console.log('🔌 MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('🔌 MONGODB_URI preview:', process.env.MONGODB_URI?.substring(0, 50) + '...');
    
    // Test the connection string format
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    if (!process.env.MONGODB_URI.startsWith('mongodb')) {
      throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
    }
    
    console.log('🔌 Connection string format looks valid');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Increased timeout
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log('✅ Database name:', mongoose.connection.db.databaseName);
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('❌ MongoDB error code:', error.code);
    console.error('❌ MongoDB error name:', error.name);
    
    // Try alternative connection for debugging
    console.log('🔄 Attempting alternative connection...');
    try {
      await mongoose.connect(process.env.MONGODB_URI.replace('retryWrites=true&w=majority&', ''), {
        serverSelectionTimeoutMS: 5000,
      });
      console.log('✅ Alternative connection successful');
    } catch (altError) {
      console.error('❌ Alternative connection also failed:', altError.message);
    }
  }
};

// Initialize database connection
connectDB();

// Remove global CORS - use route-specific CORS only
// Global CORS middleware removed to prevent conflicts

app.use(express.json());

// Add CORS headers to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-organization-id, Accept, Origin, X-Requested-With, Cache-Control');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Global preflight handler with correct headers
app.options('*', (req, res) => {
  console.log('🔀 Preflight request for:', req.path);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-organization-id, Accept, Origin, X-Requested-With, Cache-Control');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '0'); // Force no caching
  res.status(204).end();
});

// Import all route modules
const superAdminRoute = require('./routes/superAdmin');
const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const callLogRoutes = require('./routes/callLogs');
const notificationRoutes = require('./routes/notifications');
// const organizationRoutes = require('./routes/organizations'); // Disabled - using Supabase routes instead
const contactRoutes = require('./routes/contacts');
const invitationRoutes = require('./routes/invitations');
const demoRequestRoutes = require('./routes/demoRequestsSimplified');

// Mount all routes
// Switch to Supabase super-admin routes
app.use('/api/super-admin', require('./routes/supabaseSuperAdmin'));
// Switch to Supabase authentication
app.use('/api/auth', require('./routes/supabaseAuth'));
// Switch to Supabase-based routes
app.use('/api/tickets', require('./routes/supabaseTickets'));
app.use('/api/call-logs', require('./routes/supabaseCallLogs'));
// Use Supabase-compatible notifications routes
app.use('/api/notifications', require('./routes/supabaseNotifications'));
// Use Supabase-compatible organization routes  
app.use('/api/organizations', require('./routes/supabaseOrganizations'));
// Backup path for organization routes to avoid conflicts
app.use('/api/orgs-supabase', require('./routes/supabaseOrganizations'));
app.use('/api/contacts', contactRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/demo-requests', demoRequestRoutes);

// User management routes - direct proxy to super-admin endpoints
app.use('/api/users', superAdminRoute);

// Simple test routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'CallTracker Pro - Super Admin Backend',
    version: '2.0.1-auth-fixed',
    timestamp: new Date().toISOString(),
    endpoints: {
      superAdmin: [
        'GET /api/super-admin/organizations',
        'POST /api/super-admin/organizations', 
        'PUT /api/super-admin/organizations/:id',
        'DELETE /api/super-admin/organizations/:id',
        'GET /api/super-admin/organizations/:id/users',
        'GET /api/super-admin/users',
        'POST /api/super-admin/users',
        'PUT /api/super-admin/users/:userId',
        'DELETE /api/super-admin/users/:userId',
        'GET /api/super-admin/stats',
        'POST /api/super-admin/debug-auth'
      ],
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login'
      ],
      tickets: [
        'GET /api/tickets',
        'GET /api/tickets/stats',
        'POST /api/tickets'
      ],
      callLogs: [
        'GET /api/call-logs',
        'POST /api/call-logs'
      ],
      notifications: [
        'GET /api/notifications',
        'GET /api/notifications/unread'
      ],
      demoRequests: [
        'POST /api/demo-requests',
        'GET /api/demo-requests',
        'GET /api/demo-requests/analytics'
      ],
      organizations: [
        'GET /api/organizations',
        'POST /api/organizations'
      ],
      contacts: [
        'GET /api/contacts',
        'POST /api/contacts'
      ],
      users: [
        'GET /api/users (→ super-admin users)',
        'POST /api/users (→ super-admin users)',
        'PUT /api/users/:userId (→ super-admin users)',
        'DELETE /api/users/:userId (→ super-admin users)'
      ]
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    database: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState,
      states: {
        0: 'disconnected',
        1: 'connected', 
        2: 'connecting',
        3: 'disconnecting'
      }
    },
    environment: {
      mongodbUriSet: !!process.env.MONGODB_URI,
      jwtSecretSet: !!process.env.JWT_SECRET,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Backend API is working',
    timestamp: new Date().toISOString()
  });
});

// New test endpoint to verify CORS configuration
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: 'CORS test endpoint working',
    timestamp: new Date().toISOString(),
    corsHeaders: {
      origin: res.getHeader('Access-Control-Allow-Origin'),
      methods: res.getHeader('Access-Control-Allow-Methods'),
      headers: res.getHeader('Access-Control-Allow-Headers'),
      maxAge: res.getHeader('Access-Control-Max-Age')
    }
  });
});

// TEMPORARY: Super Admin Password Reset Endpoint
// Remove this after resetting your password!
app.post('/api/reset-super-admin', async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    
    console.log('🔐 Super admin password reset requested for:', email);
    
    // Basic validation
    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, newPassword, and confirmPassword are required'
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }
    
    // Only allow reset for the known super admin email
    if (email !== 'adminpro@ctp.com') {
      return res.status(403).json({
        success: false,
        message: 'Password reset only allowed for super admin email'
      });
    }
    
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    
    // Find the super admin user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Super admin user not found'
      });
    }
    
    if (user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'User is not a super admin'
      });
    }
    
    // Update the password (let the User model's pre-save hook handle hashing)
    user.password = newPassword;
    await user.save();
    
    console.log('✅ Super admin password updated successfully');
    
    res.json({
      success: true,
      message: 'Super admin password reset successfully',
      data: {
        email: user.email,
        role: user.role,
        updatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error resetting super admin password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
});

// Debug endpoint for authentication issues
app.get('/api/debug/token', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const mongoose = require('mongoose');
    
    const authHeader = req.headers.authorization;
    console.log('🔍 Debug - Auth header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'None');
    
    if (!authHeader) {
      return res.json({
        success: false,
        error: 'No authorization header',
        jwtSecretSet: !!process.env.JWT_SECRET,
        dbConnected: mongoose.connection.readyState === 1
      });
    }
    
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
      
    console.log('🔍 Debug - Token:', token ? `${token.substring(0, 20)}...` : 'None');
    
    if (!process.env.JWT_SECRET) {
      return res.json({
        success: false,
        error: 'JWT_SECRET not set',
        jwtSecretSet: false,
        dbConnected: mongoose.connection.readyState === 1
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 Debug - Decoded token:', decoded);
    
    // Try both possible ID fields
    const userId = decoded.userId || decoded.id;
    console.log('🔍 Debug - User ID to lookup:', userId);
    
    let user = null;
    let dbError = null;
    
    // Try database lookup with timeout
    if (mongoose.connection.readyState === 1) {
      try {
        const User = require('./models/User');
        user = await User.findById(userId).select('_id email role firstName lastName isActive').maxTimeMS(5000);
      } catch (dbErr) {
        dbError = dbErr.message;
        console.log('🔍 Debug - Database lookup failed:', dbErr.message);
      }
    }
    
    // If database fails, mock the user data for testing (for super admin user)
    if (!user && decoded.role === 'super_admin' && decoded.email === 'adminpro@ctp.com') {
      console.log('🔍 Debug - Using mock user data for testing');
      user = {
        _id: decoded.userId || decoded.id,
        email: decoded.email,
        role: decoded.role,
        firstName: 'admin',
        lastName: 'super',
        isActive: true
      };
    }
    
    res.json({
      success: true,
      tokenValid: true,
      userExists: !!user,
      userRole: user?.role,
      userActive: user?.isActive,
      decoded: decoded,
      jwtSecretSet: !!process.env.JWT_SECRET,
      dbConnected: mongoose.connection.readyState === 1,
      userIdField: decoded.userId ? 'userId' : decoded.id ? 'id' : 'unknown',
      dbError: dbError,
      mockDataUsed: !!(dbError && user)
    });
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      jwtSecretSet: !!process.env.JWT_SECRET,
      dbConnected: require('mongoose').connection.readyState === 1
    });
  }
});

// TEMPORARY: Serve password reset form
app.get('/reset-password', (req, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, 'reset-password.html'));
});

module.exports = app;