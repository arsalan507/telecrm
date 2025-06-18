// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

const app = express();

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.url} - ${new Date().toLocaleTimeString()}`);
    next();
});

// Routes
const callLogsRoute = require('./routes/callLogs');
app.use('/api/call-logs', callLogsRoute);

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: 'TeleCRM API is running',
        version: '1.0.0',
        database: process.env.MONGODB_URI ? 'configured' : 'not configured',
        endpoints: [
            'GET /api/call-logs/test',
            'POST /api/call-logs',
            'GET /api/call-logs'
        ]
    });
});

module.exports = app;