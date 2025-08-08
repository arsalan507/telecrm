// api/index.js - Vercel serverless function entry point
const express = require('express');
const mongoose = require('mongoose');

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

// Import routes conditionally to prevent crashes
try {
  // Only import Supabase routes which don't require MongoDB
  const supabaseAuth = require('../routes/supabaseAuth');
  const supabaseOrganizations = require('../routes/supabaseOrganizations');
  const supabaseNotifications = require('../routes/supabaseNotifications');
  const demoRequests = require('../routes/demoRequestsSimplified');
  
  app.use('/api/auth', supabaseAuth);
  app.use('/api/organizations', supabaseOrganizations);
  app.use('/api/notifications', supabaseNotifications);
  app.use('/api/demo-requests', demoRequests);
  
  console.log('✅ Supabase routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
  
  // Fallback route handler
  app.use('/api/*', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable',
      error: 'Routes loading failed',
      timestamp: new Date().toISOString()
    });
  });
}

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