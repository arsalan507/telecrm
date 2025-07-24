// Minimal Express app to test deployment issues
require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// Basic CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Add super admin routes back
const superAdminRoute = require('./routes/superAdmin');
app.use('/api/super-admin', superAdminRoute);

// Simple test routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'CallTracker Pro - Super Admin Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      superAdmin: [
        'GET /api/super-admin/organizations',
        'POST /api/super-admin/organizations',
        'PUT /api/super-admin/organizations/:id',
        'DELETE /api/super-admin/organizations/:id',
        'GET /api/super-admin/organizations/:id/users',
        'GET /api/super-admin/stats'
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

module.exports = app;