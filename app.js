// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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