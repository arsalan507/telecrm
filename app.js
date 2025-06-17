const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.url} - ${new Date().toLocaleTimeString()}`);
    next();
});

const callLogsRoute = require('./routes/callLogs');
app.use('/api/call-logs', callLogsRoute);

app.get('/', (req, res) => {
    res.json({ 
        message: 'TeleCRM API is running',
        version: '1.0.0',
        endpoints: [
            'GET /api/call-logs/test',
            'POST /api/call-logs (coming soon)'
        ]
    });
});

module.exports = app;