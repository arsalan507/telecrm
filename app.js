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

// Routes (no database middleware here)
const callLogsRoute = require('./routes/callLogs');
const authRoute = require('./routes/auth');

app.use('/api/call-logs', callLogsRoute);
app.use('/api/auth', authRoute);

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: 'CallTracker Pro API is running',
        version: '1.0.0',
        database: process.env.MONGODB_URI ? 'configured' : 'not configured',
        endpoints: [
            'GET /api/call-logs/test',
            'POST /api/call-logs',
            'GET /api/call-logs',
            'POST /api/auth/register',
            'POST /api/auth/login',
            'GET /api/auth/profile'
        ]
    });
});

module.exports = app;