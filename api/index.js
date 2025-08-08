// api/index.js - Vercel serverless function entry point
require('dotenv').config();
const express = require('express');

// Create a minimal Express app for serverless
const app = express();

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-organization-id, Accept, Origin, X-Requested-With, Cache-Control');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '0');
  next();
});

// Handle preflight requests
app.options('*', (req, res) => {
  res.status(204).end();
});

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic test endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'CallTracker Pro Backend API',
    version: '2.0.1-serverless',
    timestamp: new Date().toISOString(),
    status: 'running'
  });
});

// Simple API endpoints without external route imports
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.1-minimal'
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

// Temporary auth endpoint for testing
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Simple hardcoded validation for testing
  if (email === 'anas@anas.com' && password) {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        userId: 'test-user-id',
        email: email,
        role: 'org_admin',
        organizationId: 'test-org-id'
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        email,
        role: 'org_admin',
        organizationId: 'test-org-id'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

console.log('✅ Minimal API loaded successfully');

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
module.exports = app;