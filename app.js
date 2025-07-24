// Minimal Express app to test deployment issues
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

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
    cors: 'enabled'
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
    const User = require('./models/User');
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
    
    const user = await User.findById(userId).select('_id email role firstName lastName isActive');
    console.log('🔍 Debug - User found:', user);
    
    res.json({
      success: true,
      tokenValid: true,
      userExists: !!user,
      userRole: user?.role,
      userActive: user?.isActive,
      decoded: decoded,
      jwtSecretSet: !!process.env.JWT_SECRET,
      dbConnected: mongoose.connection.readyState === 1,
      userIdField: decoded.userId ? 'userId' : decoded.id ? 'id' : 'unknown'
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