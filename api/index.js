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

// SLA Calculation
const calculateSLAStatus = (ticket) => {
  if (!ticket.dueDate) return 'on-track';
  
  const now = new Date();
  const created = new Date(ticket.createdAt);
  const dueDate = new Date(ticket.dueDate);
  
  const timeToDeadline = dueDate - now;
  const totalTime = dueDate - created;
  const percentRemaining = timeToDeadline / totalTime;
  
  if (timeToDeadline < 0) return 'breached';
  if (percentRemaining < 0.2) return 'at-risk';
  return 'on-track';
};

// Generate ticket ID
const generateId = (prefix = 'ticket') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Generate ticket ID in CallTrackerPro format
const generateTicketId = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const counter = Math.floor(Math.random() * 1000) + 1;
  return `TKT-${year}-${month}-${String(counter).padStart(3, '0')}`;
};

// Calculate due date based on SLA
const calculateDueDate = (slaHours = 24) => {
  return new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();
};

// CallTrackerPro ticket database (matching mobile app schema)
const ticketDatabase = {
  ticket1: {
    _id: 'ticket1',
    ticketId: 'TKT-2024-08-001',
    
    // Contact Information (from CallTrackerPro app)
    phoneNumber: '+1 (555) 123-4567',
    contactName: 'John Doe',
    alternatePhones: ['+1 (555) 123-4568'],
    email: 'john.doe@example.com',
    company: 'Acme Corp',
    jobTitle: 'IT Manager',
    location: {
      city: 'New York',
      state: 'NY',
      country: 'USA',
      address: '123 Business Ave'
    },
    
    // Call Details (linked from mobile app)
    callLogId: 'call_log_001',
    callDate: new Date(Date.now() - 3600000).toISOString(),
    callDuration: 323, // seconds
    callType: 'incoming',
    callRecordingUrl: null,
    callQuality: 4,
    
    // Lead Qualification (CallTrackerPro CRM features)
    leadSource: 'cold_call',
    leadStatus: 'contacted',
    priority: 'medium',
    interestLevel: 'warm',
    budgetRange: '$10k-$25k',
    timeline: 'Q1 2024',
    productsInterested: ['CRM Software', 'Call Tracking'],
    
    // Ticket Lifecycle
    status: 'open',
    category: 'sales',
    source: 'mobile_app',
    
    // SLA & Escalation (CallTrackerPro business logic)
    slaStatus: 'on_track',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    escalatedAt: null,
    escalatedTo: null,
    resolutionTime: null,
    
    // Assignment (from CallTrackerPro app)
    assignedTo: 'agent_456',
    assignedTeam: 'sales_team_001',
    previousAssignee: null,
    assignedAt: new Date(Date.now() - 3600000).toISOString(),
    
    // Customer Satisfaction
    satisfactionRating: null,
    satisfactionFeedback: null,
    satisfactionDate: null,
    
    // CRM Pipeline (CallTrackerPro pipeline features)
    stage: 'qualified',
    nextFollowUp: new Date(Date.now() + 86400000 * 2).toISOString(),
    followUpActions: ['Send proposal', 'Schedule demo'],
    dealValue: 15000.00,
    conversionProbability: 75,
    
    // Notes & Tracking (CallTrackerPro app format)
    agentNotes: [
      {
        _id: 'note_1',
        note: 'Customer called regarding login issues. Provided initial troubleshooting steps.',
        author: 'agent_456',
        authorName: 'Sarah Wilson',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        isPrivate: false,
        noteType: 'agent'
      },
      {
        _id: 'note_2',
        note: 'Escalated to technical team for further investigation.',
        author: 'agent_456', 
        authorName: 'Sarah Wilson',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        isPrivate: false,
        noteType: 'agent'
      }
    ],
    clientNotes: [
      {
        _id: 'note_3',
        note: 'Customer confirmed they can now access the dashboard after password reset.',
        author: 'agent_456',
        authorName: 'Sarah Wilson',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        isPrivate: false,
        noteType: 'client'
      }
    ],
    tags: ['login-issue', 'authentication', 'resolved'],
    customFields: {
      'urgency_level': 'high',
      'customer_tier': 'premium'
    },
    
    // Multi-tenant (CallTrackerPro organization structure)
    organizationId: 'org_12345',
    teamId: 'sales_team_001',
    
    // Audit Trail (CallTrackerPro tracking)
    createdBy: 'agent_456',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedBy: 'agent_456',
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    isActive: true,
    ticketHistory: [
      {
        action: 'created',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        userId: 'agent_456',
        details: 'Ticket auto-created from incoming call'
      },
      {
        action: 'updated',
        timestamp: new Date(Date.now() - 1800000).toISOString(), 
        userId: 'agent_456',
        details: 'Added customer information and initial notes'
      }
    ]
  },
  
  ticket2: {
    id: 'ticket2',
    _id: 'ticket2',
    title: 'Technical issue with dashboard',
    description: 'Dashboard not loading properly for multiple users in the organization',
    status: 'in-progress',
    priority: 'high',
    category: 'technical-support',
    
    customerName: 'Jane Doe',
    customerEmail: 'jane.doe@company.com',
    customerPhone: '+1 (555) 987-6543',
    
    assignedTo: {
      id: 'agent_789',
      name: 'John Doe',
      email: 'john.doe@company.com'
    },
    
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    lastActivity: new Date(Date.now() - 900000).toISOString(),
    
    source: 'phone',
    tags: ['dashboard', 'loading-issue', 'high-priority'],
    estimatedHours: 4,
    actualHours: 2,
    
    notes: [
      {
        id: 'note_4',
        content: 'Ticket created from phone call',
        author: 'System',
        authorId: 'system',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        type: 'system'
      },
      {
        id: 'note_5',
        content: 'Investigating server logs for dashboard loading issues',
        author: 'John Doe',
        authorId: 'agent_789',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        type: 'note'
      }
    ],
    
    attachments: [],
    resolution: null,
    resolutionDate: null,
    resolutionTime: null,
    relatedTickets: []
  },
  
  ticket3: {
    id: 'ticket3',
    _id: 'ticket3',
    title: 'Feature request - Export data',
    description: 'Customer wants to export call logs and ticket data to CSV format for analysis',
    status: 'resolved',
    priority: 'low',
    category: 'feature-request',
    
    customerName: 'Mike Johnson',
    customerEmail: 'mike.johnson@business.com',
    customerPhone: '+1 (555) 456-7890',
    
    assignedTo: {
      id: 'agent_456',
      name: 'Sarah Wilson', 
      email: 'sarah.wilson@company.com'
    },
    
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    lastActivity: new Date(Date.now() - 86400000).toISOString(),
    
    source: 'web',
    tags: ['feature-request', 'export', 'csv'],
    estimatedHours: 3,
    actualHours: 2.5,
    
    notes: [
      {
        id: 'note_6',
        content: 'Feature request submitted via web form',
        author: 'System',
        authorId: 'system',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        type: 'system'
      },
      {
        id: 'note_7',
        content: 'Implemented CSV export functionality for call logs',
        author: 'Sarah Wilson',
        authorId: 'agent_456',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        type: 'resolution'
      }
    ],
    
    attachments: [],
    resolution: 'Added CSV export feature to call logs page. Customer can now download their data.',
    resolutionDate: new Date(Date.now() - 86400000).toISOString(),
    resolutionTime: 60, // minutes
    relatedTickets: []
  }
};

// Ticket management functions
const getTicketDetails = (ticketId) => {
  const ticket = ticketDatabase[ticketId];
  if (!ticket) return null;
  
  // Calculate SLA status
  const slaStatus = calculateSLAStatus(ticket);
  
  return {
    ...ticket,
    slaStatus,
    isOverdue: slaStatus === 'breached'
  };
};

const getAllTickets = (query = {}) => {
  const {
    limit = 20,
    offset = 0,
    status,
    priority,
    assignedTo,
    category,
    search,
    dateFrom,
    dateTo
  } = query;
  
  let tickets = Object.values(ticketDatabase);
  
  // Apply filters
  if (status) {
    tickets = tickets.filter(t => t.status === status);
  }
  if (priority) {
    tickets = tickets.filter(t => t.priority === priority);
  }
  if (assignedTo) {
    tickets = tickets.filter(t => t.assignedTo?.id === assignedTo);
  }
  if (category) {
    tickets = tickets.filter(t => t.category === category);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    tickets = tickets.filter(t => 
      t.title.toLowerCase().includes(searchLower) ||
      t.description.toLowerCase().includes(searchLower) ||
      t.customerName.toLowerCase().includes(searchLower)
    );
  }
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    tickets = tickets.filter(t => new Date(t.createdAt) >= fromDate);
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    tickets = tickets.filter(t => new Date(t.createdAt) <= toDate);
  }
  
  // Add computed fields
  tickets = tickets.map(ticket => ({
    ...ticket,
    slaStatus: calculateSLAStatus(ticket),
    isOverdue: calculateSLAStatus(ticket) === 'breached'
  }));
  
  const total = Object.keys(ticketDatabase).length;
  const filtered = tickets.length;
  
  // Pagination
  const paginatedTickets = tickets.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  return {
    data: paginatedTickets,
    total,
    filtered,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + parseInt(limit) < filtered
    }
  };
};

const createTicket = (data) => {
  const ticketId = generateId('ticket');
  const now = new Date().toISOString();
  
  const newTicket = {
    id: ticketId,
    _id: ticketId,
    title: data.title,
    description: data.description,
    status: 'new',
    priority: data.priority || 'medium',
    category: data.category || 'general',
    
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    
    assignedTo: data.assignedTo ? {
      id: data.assignedTo,
      name: 'Auto-assigned User',
      email: 'user@company.com'
    } : null,
    
    createdAt: now,
    updatedAt: now,
    dueDate: data.dueDate || new Date(Date.now() + 86400000 * 3).toISOString(),
    lastActivity: now,
    
    source: data.source || 'web',
    tags: data.tags || [],
    estimatedHours: data.estimatedHours || 0,
    actualHours: 0,
    
    notes: [{
      id: generateId('note'),
      content: 'Ticket created',
      author: 'System',
      authorId: 'system',
      createdAt: now,
      type: 'system'
    }],
    
    attachments: [],
    resolution: null,
    resolutionDate: null,
    resolutionTime: null,
    relatedTickets: []
  };
  
  // Add to database
  ticketDatabase[ticketId] = newTicket;
  
  return {
    ...newTicket,
    slaStatus: calculateSLAStatus(newTicket)
  };
};

const updateTicket = (ticketId, data) => {
  const ticket = ticketDatabase[ticketId];
  if (!ticket) return null;
  
  const updatedTicket = {
    ...ticket,
    ...data,
    updatedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };
  
  ticketDatabase[ticketId] = updatedTicket;
  
  return {
    ...updatedTicket,
    slaStatus: calculateSLAStatus(updatedTicket)
  };
};

const getTicketNotes = (ticketId) => {
  const ticket = ticketDatabase[ticketId];
  return ticket ? ticket.notes : [];
};

const addTicketNote = (ticketId, data) => {
  const ticket = ticketDatabase[ticketId];
  if (!ticket) return null;
  
  const newNote = {
    id: generateId('note'),
    content: data.content,
    author: data.author || 'User',
    authorId: data.authorId || 'user_id',
    createdAt: new Date().toISOString(),
    type: data.type || 'note'
  };
  
  ticket.notes.push(newNote);
  ticket.updatedAt = new Date().toISOString();
  ticket.lastActivity = new Date().toISOString();
  
  return newNote;
};

const assignTicket = (ticketId, data) => {
  const ticket = ticketDatabase[ticketId];
  if (!ticket) return null;
  
  ticket.assignedTo = {
    id: data.assignedTo,
    name: data.assignedToName || 'User',
    email: data.assignedToEmail || 'user@company.com'
  };
  ticket.updatedAt = new Date().toISOString();
  ticket.lastActivity = new Date().toISOString();
  
  // Add assignment note
  ticket.notes.push({
    id: generateId('note'),
    content: `Ticket assigned to ${ticket.assignedTo.name}`,
    author: 'System',
    authorId: 'system',
    createdAt: new Date().toISOString(),
    type: 'assignment'
  });
  
  return ticket;
};

const resolveTicket = (ticketId, data) => {
  const ticket = ticketDatabase[ticketId];
  if (!ticket) return null;
  
  const now = new Date().toISOString();
  const resolutionTime = Math.floor((new Date() - new Date(ticket.createdAt)) / 60000); // minutes
  
  ticket.status = 'resolved';
  ticket.resolution = data.resolution;
  ticket.resolutionDate = now;
  ticket.resolutionTime = resolutionTime;
  ticket.updatedAt = now;
  ticket.lastActivity = now;
  
  // Add resolution note
  ticket.notes.push({
    id: generateId('note'),
    content: data.resolution,
    author: data.resolvedBy || 'User',
    authorId: data.resolvedById || 'user_id',
    createdAt: now,
    type: 'resolution'
  });
  
  return ticket;
};

// Call Log Database (CallTrackerPro format)
const callLogDatabase = {
  call_log_001: {
    _id: 'call_log_001',
    phoneNumber: '+1 (555) 123-4567',
    contactName: 'John Doe',
    company: 'Acme Corp',
    callType: 'incoming',
    duration: 323,
    status: 'answered',
    callQuality: 4,
    organizationId: 'org_12345',
    userId: 'agent_456',
    teamId: 'sales_team_001',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    ticketId: 'ticket1' // Linked ticket
  },
  call_log_002: {
    _id: 'call_log_002', 
    phoneNumber: '+1 (555) 987-6543',
    contactName: 'Jane Smith',
    company: 'Tech Solutions',
    callType: 'outgoing',
    duration: 180,
    status: 'answered',
    callQuality: 5,
    organizationId: 'org_12345',
    userId: 'agent_789',
    teamId: 'support_team_001',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    ticketId: null // No ticket created
  }
};

// CallTrackerPro Auto Ticket Creation from Call Logs
const createCallLogWithTicket = async (data) => {
  try {
    // Create call log entry
    const callLogId = generateId('call_log');
    const now = new Date().toISOString();
    
    const callLog = {
      _id: callLogId,
      phoneNumber: data.phoneNumber,
      contactName: data.contactName || "Unknown Contact",
      company: data.company || "",
      callType: data.callType || 'incoming',
      duration: data.duration || 0,
      status: data.status || 'answered',
      callQuality: data.callQuality || 0,
      organizationId: data.organizationId,
      userId: data.userId,
      teamId: data.teamId,
      createdAt: now,
      ticketId: null
    };
    
    // Store call log
    callLogDatabase[callLogId] = callLog;
    
    let ticket = null;
    
    // Auto-create ticket if requested (CallTrackerPro mobile app feature)
    if (data.autoCreateTicket === true) {
      const ticketId = generateId('ticket');
      
      ticket = {
        _id: ticketId,
        ticketId: generateTicketId(),
        
        // Contact Information from call
        phoneNumber: data.phoneNumber,
        contactName: data.contactName || "Unknown Contact",
        alternatePhones: [],
        email: "",
        company: data.company || "",
        jobTitle: "",
        location: {
          city: "",
          state: "",
          country: "",
          address: ""
        },
        
        // Call Details (link to call log)
        callLogId: callLogId,
        callDate: now,
        callDuration: data.duration || 0,
        callType: data.callType || 'incoming',
        callRecordingUrl: null,
        callQuality: data.callQuality || 0,
        
        // Intelligent Defaults (CallTrackerPro business logic)
        leadSource: data.callType === 'incoming' ? 'cold_call' : 'outbound',
        leadStatus: 'new',
        priority: 'medium',
        interestLevel: 'warm',
        budgetRange: "",
        timeline: "",
        productsInterested: [],
        
        // Ticket Lifecycle
        status: 'open',
        category: data.teamId?.includes('sales') ? 'sales' : 'support',
        source: 'mobile_app',
        
        // SLA Settings (based on organization config)
        slaStatus: 'on_track',
        dueDate: calculateDueDate(24), // 24 hour default SLA
        escalatedAt: null,
        escalatedTo: null,
        resolutionTime: null,
        
        // Assignment (auto-assign to call receiver)
        assignedTo: data.userId,
        assignedTeam: data.teamId,
        previousAssignee: null,
        assignedAt: now,
        
        // Customer Satisfaction
        satisfactionRating: null,
        satisfactionFeedback: null,
        satisfactionDate: null,
        
        // CRM Pipeline
        stage: 'prospect',
        nextFollowUp: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days
        followUpActions: [],
        dealValue: 0,
        conversionProbability: 0,
        
        // Notes & Tracking
        agentNotes: [{
          _id: generateId('note'),
          note: `Ticket auto-created from ${data.callType} call. Duration: ${data.duration}s`,
          author: data.userId,
          authorName: 'System Auto-Creation',
          timestamp: now,
          isPrivate: false,
          noteType: 'system'
        }],
        clientNotes: [],
        tags: ['auto-created', data.callType + '-call'],
        customFields: {},
        
        // Multi-tenant
        organizationId: data.organizationId,
        teamId: data.teamId,
        
        // Audit Trail
        createdBy: data.userId,
        createdAt: now,
        updatedBy: data.userId,
        updatedAt: now,
        isActive: true,
        ticketHistory: [{
          action: 'created',
          timestamp: now,
          userId: data.userId,
          details: `Auto-created from ${data.callType} call to ${data.phoneNumber}`
        }]
      };
      
      // Store ticket
      ticketDatabase[ticketId] = ticket;
      
      // Link ticket to call log
      callLogDatabase[callLogId].ticketId = ticketId;
      
      // Send real-time notifications (mock implementation)
      console.log('🔔 SSE Event: TICKET_CREATED', {
        type: 'TICKET_CREATED',
        ticketId: ticketId,
        organizationId: data.organizationId,
        teamId: data.teamId
      });
    }
    
    return {
      success: true,
      message: ticket ? 'Call logged and ticket created successfully' : 'Call logged successfully',
      data: {
        callLog: callLog,
        ticket: ticket
      },
      realTimeUpdates: {
        sseTriggered: ticket ? true : false,
        webSocketTriggered: ticket ? true : false,
        analyticsUpdated: true
      }
    };
    
  } catch (error) {
    console.error('❌ Call log creation failed:', error);
    return {
      success: false,
      error: 'Call log creation failed',
      details: error.message
    };
  }
};

// Get call logs with filtering
const getCallLogs = (query = {}) => {
  const {
    limit = 20,
    offset = 0,
    organizationId,
    teamId,
    userId,
    callType,
    dateFrom,
    dateTo
  } = query;
  
  let callLogs = Object.values(callLogDatabase);
  
  // Apply filters (CallTrackerPro app filters)
  if (organizationId) {
    callLogs = callLogs.filter(c => c.organizationId === organizationId);
  }
  if (teamId) {
    callLogs = callLogs.filter(c => c.teamId === teamId);
  }
  if (userId) {
    callLogs = callLogs.filter(c => c.userId === userId);
  }
  if (callType) {
    callLogs = callLogs.filter(c => c.callType === callType);
  }
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    callLogs = callLogs.filter(c => new Date(c.createdAt) >= fromDate);
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    callLogs = callLogs.filter(c => new Date(c.createdAt) <= toDate);
  }
  
  // Sort by most recent first
  callLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Pagination
  const total = callLogs.length;
  const paginatedLogs = callLogs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  return {
    data: paginatedLogs,
    total: total
  };
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
        stats: {
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
        recentTickets: [
          {
            id: 'ticket1',
            title: 'Customer inquiry about pricing',
            description: 'Customer wants to know about enterprise pricing',
            status: 'open',
            priority: 'medium',
            assignedTo: 'Anas User',
            customerName: 'John Smith',
            createdAt: new Date().toISOString()
          },
          {
            id: 'ticket2',
            title: 'Technical issue with dashboard',
            description: 'Dashboard not loading properly',
            status: 'in_progress', 
            priority: 'high',
            assignedTo: 'John Doe',
            customerName: 'Jane Doe',
            createdAt: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 'ticket3',
            title: 'Feature request - Export data',
            description: 'Customer wants to export call logs',
            status: 'open', 
            priority: 'low',
            assignedTo: 'Anas User',
            customerName: 'Mike Johnson',
            createdAt: new Date(Date.now() - 7200000).toISOString()
          }
        ],
        message: 'Ticket stats with recent tickets (test data)'
      });
    }

    // Single ticket details
    if (method === 'GET' && pathname.match(/^\/api\/tickets\/[^\/]+$/)) {
      const ticketId = pathname.split('/')[3];
      const ticketDetails = getTicketDetails(ticketId);
      
      if (!ticketDetails) {
        return jsonResponse(res, 404, {
          success: false,
          message: 'Ticket not found'
        });
      }
      
      return jsonResponse(res, 200, {
        success: true,
        data: ticketDetails
      });
    }

    // Tickets list with filtering
    if (method === 'GET' && pathname === '/api/tickets') {
      const query = parsedUrl.query;
      const tickets = getAllTickets(query);
      
      return jsonResponse(res, 200, {
        success: true,
        data: tickets.data,
        total: tickets.total,
        filtered: tickets.filtered,
        pagination: tickets.pagination,
        message: 'Tickets retrieved successfully'
      });
    }

    // Create new ticket
    if (method === 'POST' && pathname === '/api/tickets') {
      const body = await parseBody(req);
      const newTicket = createTicket(body);
      
      return jsonResponse(res, 201, {
        success: true,
        data: newTicket,
        message: 'Ticket created successfully'
      });
    }

    // Update ticket
    if (method === 'PUT' && pathname.match(/^\/api\/tickets\/[^\/]+$/)) {
      const ticketId = pathname.split('/')[3];
      const body = await parseBody(req);
      const updatedTicket = updateTicket(ticketId, body);
      
      if (!updatedTicket) {
        return jsonResponse(res, 404, {
          success: false,
          message: 'Ticket not found'
        });
      }
      
      return jsonResponse(res, 200, {
        success: true,
        data: updatedTicket,
        message: 'Ticket updated successfully'
      });
    }

    // Ticket notes endpoints
    if (method === 'GET' && pathname.match(/^\/api\/tickets\/[^\/]+\/notes$/)) {
      const ticketId = pathname.split('/')[3];
      const notes = getTicketNotes(ticketId);
      
      return jsonResponse(res, 200, {
        success: true,
        data: notes,
        message: 'Ticket notes retrieved successfully'
      });
    }

    if (method === 'POST' && pathname.match(/^\/api\/tickets\/[^\/]+\/notes$/)) {
      const ticketId = pathname.split('/')[3];
      const body = await parseBody(req);
      const newNote = addTicketNote(ticketId, body);
      
      return jsonResponse(res, 201, {
        success: true,
        data: newNote,
        message: 'Note added successfully'
      });
    }

    // Ticket actions
    if (method === 'POST' && pathname.match(/^\/api\/tickets\/[^\/]+\/assign$/)) {
      const ticketId = pathname.split('/')[3];
      const body = await parseBody(req);
      const result = assignTicket(ticketId, body);
      
      return jsonResponse(res, 200, {
        success: true,
        data: result,
        message: 'Ticket assigned successfully'
      });
    }

    if (method === 'POST' && pathname.match(/^\/api\/tickets\/[^\/]+\/resolve$/)) {
      const ticketId = pathname.split('/')[3];
      const body = await parseBody(req);
      const result = resolveTicket(ticketId, body);
      
      return jsonResponse(res, 200, {
        success: true,
        data: result,
        message: 'Ticket resolved successfully'
      });
    }

    // CallTrackerPro Mobile App Integration - Call Logs with Auto Ticket Creation
    if (method === 'POST' && pathname === '/api/call-logs') {
      const body = await parseBody(req);
      const callLogResult = await createCallLogWithTicket(body);
      
      if (!callLogResult.success) {
        return jsonResponse(res, 500, callLogResult);
      }
      
      return jsonResponse(res, 201, callLogResult);
    }

    // Get call logs
    if (method === 'GET' && pathname === '/api/call-logs') {
      const query = parsedUrl.query;
      const callLogs = getCallLogs(query);
      
      return jsonResponse(res, 200, {
        success: true,
        data: callLogs.data,
        total: callLogs.total,
        message: 'Call logs retrieved successfully'
      });
    }

    // Server-Sent Events for real-time ticket updates
    if (method === 'GET' && pathname === '/api/tickets/stream') {
      const query = parsedUrl.query;
      
      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization'
      });
      
      // Send initial connection message
      res.write('data: {"type":"connected","message":"SSE connected successfully"}\n\n');
      
      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write('data: {"type":"heartbeat","timestamp":"' + new Date().toISOString() + '"}\n\n');
      }, 30000);
      
      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        console.log('SSE client disconnected');
      });
      
      return; // Don't call jsonResponse for SSE
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