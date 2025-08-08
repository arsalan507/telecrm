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

    if (method === 'GET' && pathname.startsWith('/api/organizations/') && pathname.endsWith('/users')) {
      return jsonResponse(res, 200, {
        success: true,
        data: [
          {
            id: 'user1',
            firstName: 'Anas',
            lastName: 'User', 
            email: 'anas@anas.com',
            role: 'org_admin',
            isActive: true,
            organizationId: 'test-org-id'
          },
          {
            id: 'user2', 
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'agent',
            isActive: true,
            organizationId: 'test-org-id'
          }
        ],
        message: 'Organization users (test data)'
      });
    }

    if (method === 'GET' && pathname.match(/^\/api\/organizations\/[^\/]+$/)) {
      // Single organization by ID
      const orgId = pathname.split('/')[3];
      return jsonResponse(res, 200, {
        success: true,
        data: {
          id: orgId,
          name: 'Test Organization',
          plan: 'pro',
          users: 5,
          createdAt: new Date().toISOString(),
          isActive: true
        },
        message: 'Organization data (test)'
      });
    }

    if (method === 'GET' && pathname === '/api/organizations') {
      // Organizations list - return array
      return jsonResponse(res, 200, {
        success: true,
        data: [
          {
            id: 'test-org-id',
            name: 'Test Organization',
            plan: 'pro',
            users: 5,
            createdAt: new Date().toISOString(),
            isActive: true
          }
        ],
        total: 1,
        message: 'Organizations list (test)'
      });
    }

    if (method === 'GET' && pathname === '/api/call-logs') {
      return jsonResponse(res, 200, {
        success: true,
        data: [
          {
            id: 'call1',
            contactName: 'John Smith',
            phoneNumber: '+1234567890',
            duration: 120,
            outcome: 'interested',
            notes: 'Interested in premium plan',
            createdAt: new Date().toISOString()
          },
          {
            id: 'call2',
            contactName: 'Jane Doe', 
            phoneNumber: '+1987654321',
            duration: 90,
            outcome: 'not_interested',
            notes: 'Not ready to purchase',
            createdAt: new Date(Date.now() - 86400000).toISOString()
          }
        ],
        total: 2,
        message: 'Call logs (test data)'
      });
    }

    if (method === 'GET' && pathname === '/api/tickets/stats') {
      return jsonResponse(res, 200, {
        success: true,
        data: {
          total: 15,
          open: 8,
          inProgress: 4, 
          resolved: 3,
          priority: {
            high: 2,
            medium: 6,
            low: 7
          }
        },
        message: 'Ticket stats (test data)'
      });
    }

    if (method === 'GET' && pathname === '/api/tickets') {
      return jsonResponse(res, 200, {
        success: true,
        data: [
          {
            id: 'ticket1',
            title: 'Customer inquiry about pricing',
            description: 'Customer wants to know about enterprise pricing',
            status: 'open',
            priority: 'medium',
            assignedTo: 'Anas User',
            createdAt: new Date().toISOString()
          },
          {
            id: 'ticket2',
            title: 'Technical issue with dashboard',
            description: 'Dashboard not loading properly',
            status: 'in_progress', 
            priority: 'high',
            assignedTo: 'John Doe',
            createdAt: new Date(Date.now() - 3600000).toISOString()
          }
        ],
        total: 2,
        message: 'Tickets (test data)'
      });
    }

    if (method === 'GET' && pathname === '/api/notifications/unread') {
      return jsonResponse(res, 200, {
        success: true,
        count: 3,
        data: [
          {
            id: 'notif1',
            title: 'New ticket assigned',
            message: 'You have been assigned a new high priority ticket',
            type: 'assignment',
            isRead: false,
            createdAt: new Date().toISOString()
          },
          {
            id: 'notif2',
            title: 'Call log updated',
            message: 'Call outcome has been updated for John Smith',
            type: 'update',
            isRead: false,
            createdAt: new Date(Date.now() - 1800000).toISOString()
          }
        ],
        message: 'Unread notifications (test data)'
      });
    }

    if (method === 'GET' && pathname === '/api/notifications') {
      return jsonResponse(res, 200, {
        success: true,
        data: [
          {
            id: 'notif1',
            title: 'New ticket assigned',
            message: 'You have been assigned a new high priority ticket',
            type: 'assignment',
            isRead: false,
            createdAt: new Date().toISOString()
          },
          {
            id: 'notif2', 
            title: 'Call log updated',
            message: 'Call outcome has been updated for John Smith',
            type: 'update',
            isRead: false,
            createdAt: new Date(Date.now() - 1800000).toISOString()
          }
        ],
        total: 2,
        message: 'All notifications (test data)'
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