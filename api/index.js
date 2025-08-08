// api/index.js - Pure Node.js serverless function (no Express)
require('dotenv').config();
const url = require('url');
const jwt = require('jsonwebtoken');

// CORS headers
const setCORSHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-organization-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '0');
};

// JSON response helper
const jsonResponse = (res, statusCode, data) => {
  setCORSHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

// Parse JSON body
const parseBody = (req) => {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        resolve({});
      }
    });
  });
};

// Main handler function
module.exports = async (req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    console.log(`${method} ${pathname}`);

    // Handle preflight requests
    if (method === 'OPTIONS') {
      setCORSHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    // Routes
    if (method === 'GET' && pathname === '/') {
      return jsonResponse(res, 200, {
        message: 'CallTracker Pro Backend API',
        version: '2.0.1-pure-nodejs',
        timestamp: new Date().toISOString(),
        status: 'running'
      });
    }

    if (method === 'GET' && pathname === '/health') {
      return jsonResponse(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.1-pure-nodejs'
      });
    }

    if (method === 'GET' && pathname === '/api/test') {
      return jsonResponse(res, 200, {
        success: true,
        message: 'Pure Node.js API is working',
        timestamp: new Date().toISOString()
      });
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await parseBody(req);
      const { email, password } = body;

      if (email === 'anas@anas.com' && password) {
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

        return jsonResponse(res, 200, {
          success: true,
          token,
          user: {
            email,
            role: 'org_admin',
            organizationId: 'test-org-id'
          }
        });
      } else {
        return jsonResponse(res, 401, {
          success: false,
          message: 'Invalid credentials'
        });
      }
    }

    if (method === 'GET' && pathname.startsWith('/api/organizations')) {
      return jsonResponse(res, 200, {
        success: true,
        data: {
          id: 'test-org-id',
          name: 'Test Organization',
          plan: 'pro',
          users: 5
        },
        message: 'Organization data (test)'
      });
    }

    // 404 for unmatched routes
    return jsonResponse(res, 404, {
      success: false,
      message: 'Endpoint not found',
      path: pathname,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return jsonResponse(res, 500, {
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};