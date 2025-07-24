// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// Enhanced CORS Configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'https://super-admin-dashboard-telecrm.netlify.app',
    'https://telecrm-super-admin.netlify.app',
    /\.netlify\.app$/,
    /\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposedHeaders: ['Authorization'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Additional CORS headers for manual handling
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (corsOptions.origin.some(allowed => {
    if (typeof allowed === 'string') return allowed === origin;
    if (allowed instanceof RegExp) return allowed.test(origin);
    return false;
  })) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name');
  res.header('Access-Control-Expose-Headers', 'Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.url} - ${new Date().toLocaleTimeString()}`);
    next();
});

// Enhanced Multi-Tenant Routes
const callLogsRoute = require('./routes/callLogs');
const authRoute = require('./routes/auth');
const contactsRoute = require('./routes/contacts');
const organizationsRoute = require('./routes/organizations');
const invitationsRoute = require('./routes/invitations');
const superAdminRoute = require('./routes/superAdmin');

// Mount routes
app.use('/api/call-logs', callLogsRoute);
app.use('/api/auth', authRoute);
app.use('/api/contacts', contactsRoute);
app.use('/api/organizations', organizationsRoute);
app.use('/api/invitations', invitationsRoute);
app.use('/api/super-admin', superAdminRoute);

// Health check endpoint for debugging
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        cors: 'enabled',
        origin: req.headers.origin || 'not-provided',
        userAgent: req.headers['user-agent'] || 'not-provided'
    });
});

// API test endpoint for debugging
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Backend API is working',
        cors: 'configured',
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'not-provided'
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: 'CallTracker Pro - Multi-Tenant SaaS CRM API',
        version: '2.0.0',
        architecture: 'Multi-Tenant SaaS',
        database: process.env.MONGODB_URI ? 'MongoDB Atlas Connected' : 'Database Not Configured',
        features: [
            'Organization Management',
            'Team Hierarchies', 
            'Role-Based Access Control',
            'Invitation System',
            'Contact & Lead Management',
            'Call Logging & Analytics',
            'Subscription Management'
        ],
        endpoints: {
            authentication: [
                'POST /api/auth/register',
                'POST /api/auth/login',
                'GET /api/auth/debug'
            ],
            organizations: [
                'GET /api/organizations/:orgId',
                'PUT /api/organizations/:orgId',
                'GET /api/organizations/:orgId/users',
                'GET /api/organizations/:orgId/teams',
                'POST /api/organizations/:orgId/teams',
                'GET /api/organizations/:orgId/analytics',
                'GET /api/organizations/:orgId/subscription'
            ],
            invitations: [
                'POST /api/organizations/:orgId/invitations',
                'GET /api/organizations/:orgId/invitations',
                'POST /api/invitations/:token/accept',
                'GET /api/invitations/:token',
                'POST /api/invitations/:token/decline'
            ],
            contacts: [
                'GET /api/contacts',
                'POST /api/contacts',
                'GET /api/contacts/:id',
                'PUT /api/contacts/:id',
                'DELETE /api/contacts/:id',
                'POST /api/contacts/:id/notes',
                'POST /api/contacts/:id/interactions'
            ],
            callLogs: [
                'GET /api/call-logs',
                'POST /api/call-logs',
                'GET /api/call-logs/:id',
                'PUT /api/call-logs/:id',
                'DELETE /api/call-logs/:id'
            ],
            superAdmin: [
                'GET /api/super-admin/organizations',
                'POST /api/super-admin/organizations',
                'PUT /api/super-admin/organizations/:id',
                'DELETE /api/super-admin/organizations/:id',
                'GET /api/super-admin/organizations/:id/users',
                'GET /api/super-admin/stats'
            ]
        },
        documentation: {
            roles: ['super_admin', 'org_admin', 'manager', 'agent', 'viewer'],
            permissions: 'Role-based with granular permissions',
            dataIsolation: 'Complete organization-level isolation',
            subscriptionPlans: ['free', 'pro', 'business', 'enterprise']
        }
    });
});

module.exports = app;