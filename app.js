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

module.exports = app;