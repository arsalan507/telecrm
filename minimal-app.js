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

// Simple test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Minimal Express app working',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

module.exports = app;