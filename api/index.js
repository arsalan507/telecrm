// api/index.js - Pure Node.js serverless function (no Express)
require('dotenv').config();
const url = require('url');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('✅ Supabase client initialized');
} else {
  console.warn('⚠️ Supabase credentials not found, using demo data');
}

// In-memory storage for initial users (fallback if no database)
const initialUsers = {};

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

// Check if time is within business hours (9 AM - 6 PM EST)
const isBusinessHours = (timestamp) => {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Monday to Friday, 9 AM to 6 PM
  return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
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
    
    // Store call log in enhanced database
    enhancedCallLogDatabase[callLogId] = {
      ...callLog,
      callId: `CALL-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      displayName: callLog.contactName || callLog.phoneNumber,
      startTime: now,
      endTime: data.duration > 0 ? new Date(new Date(now).getTime() + data.duration * 1000).toISOString() : null,
      callOutcome: data.status === 'answered' ? 'connected' : data.status,
      callNotes: data.callNotes || '',
      followUpRequired: data.followUpRequired || false,
      followUpDate: data.followUpDate || null,
      tags: data.tags || [],
      isKnownContact: !!(data.contactName && data.contactName !== 'Unknown Contact'),
      contactSource: data.contactName ? 'crm' : null,
      location: data.location || { city: '', state: '', country: 'USA' },
      deviceInfo: data.deviceInfo || { platform: 'android', appVersion: '1.0.0' },
      userName: 'Agent User', // In production, get from user database
      responseTime: data.responseTime || 0,
      isBusinessHours: isBusinessHours(now),
      callCost: 0,
      customerSatisfaction: null,
      updatedAt: now,
      isDeleted: false
    };
    
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
      enhancedCallLogDatabase[callLogId].ticketId = ticketId;
      enhancedCallLogDatabase[callLogId].ticketCreated = true;
      
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

// Enhanced call logs database with comprehensive CallTrackerPro format
const enhancedCallLogDatabase = {
  call_log_001: {
    _id: 'call_log_001',
    callId: 'CALL-2024-08-001',
    
    // Basic Call Information
    phoneNumber: '+1 (555) 123-4567',
    contactName: 'John Doe',
    company: 'Acme Corp',
    displayName: 'John Doe',
    
    // Call Details
    callType: 'incoming',
    callDate: new Date(Date.now() - 3600000).toISOString(),
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: new Date(Date.now() - 3600000 + 323000).toISOString(),
    duration: 323,
    status: 'answered',
    
    // Call Quality & Recording
    callQuality: 4,
    callRecordingUrl: 'https://storage.example.com/recordings/call_001.mp3',
    recordingDuration: 320,
    recordingSize: 2048000,
    
    // Contact Integration
    contactId: 'contact_001',
    isKnownContact: true,
    contactSource: 'crm',
    
    // Geographic & Device Info
    location: {
      city: 'New York',
      state: 'NY',
      country: 'USA',
      timezone: 'America/New_York'
    },
    deviceInfo: {
      platform: 'android',
      appVersion: '1.0.0',
      deviceModel: 'Samsung Galaxy S21'
    },
    
    // Agent & Organization Context
    userId: 'agent_456',
    userName: 'Sarah Wilson',
    organizationId: 'org_12345',
    teamId: 'sales_team_001',
    
    // Call Outcome & Follow-up
    callOutcome: 'connected',
    callNotes: 'Customer interested in enterprise plan. Scheduled follow-up call.',
    followUpRequired: true,
    followUpDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    tags: ['hot_lead', 'enterprise', 'follow_up'],
    
    // Integration with Tickets
    ticketId: 'ticket1',
    ticketCreated: true,
    autoTicketCreation: true,
    
    // Analytics & Performance
    responseTime: 3,
    isBusinessHours: true,
    callCost: 0.05,
    customerSatisfaction: 5,
    
    // Audit Trail
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 + 323000).toISOString(),
    createdBy: 'agent_456',
    isActive: true,
    isDeleted: false
  },
  
  call_log_002: {
    _id: 'call_log_002',
    callId: 'CALL-2024-08-002',
    phoneNumber: '+1 (555) 987-6543',
    contactName: 'Jane Smith',
    company: 'Tech Solutions Inc',
    displayName: 'Jane Smith',
    callType: 'outgoing',
    callDate: new Date(Date.now() - 7200000).toISOString(),
    startTime: new Date(Date.now() - 7200000).toISOString(),
    endTime: new Date(Date.now() - 7200000 + 180000).toISOString(),
    duration: 180,
    status: 'answered',
    callQuality: 5,
    callRecordingUrl: null,
    contactId: 'contact_002',
    isKnownContact: true,
    contactSource: 'local',
    location: {
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      timezone: 'America/Los_Angeles'
    },
    userId: 'agent_789',
    userName: 'John Smith',
    organizationId: 'org_12345',
    teamId: 'support_team_001',
    callOutcome: 'connected',
    callNotes: 'Customer support inquiry resolved successfully.',
    followUpRequired: false,
    tags: ['support', 'resolved'],
    ticketId: null,
    ticketCreated: false,
    autoTicketCreation: false,
    responseTime: 2,
    isBusinessHours: true,
    callCost: 0.03,
    customerSatisfaction: 4,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000 + 180000).toISOString(),
    createdBy: 'agent_789',
    isActive: true,
    isDeleted: false
  },
  
  call_log_003: {
    _id: 'call_log_003',
    callId: 'CALL-2024-08-003',
    phoneNumber: '+1 (555) 456-7890',
    contactName: 'Unknown Contact',
    company: '',
    displayName: '+1 (555) 456-7890',
    callType: 'missed',
    callDate: new Date(Date.now() - 1800000).toISOString(),
    startTime: new Date(Date.now() - 1800000).toISOString(),
    endTime: null,
    duration: 0,
    status: 'missed',
    callQuality: 0,
    callRecordingUrl: null,
    contactId: null,
    isKnownContact: false,
    contactSource: null,
    location: {
      city: 'Unknown',
      state: 'Unknown',
      country: 'USA',
      timezone: 'America/New_York'
    },
    userId: 'agent_456',
    userName: 'Sarah Wilson',
    organizationId: 'org_12345',
    teamId: 'sales_team_001',
    callOutcome: 'no_answer',
    callNotes: 'Missed call - will try to call back',
    followUpRequired: true,
    followUpDate: new Date(Date.now() + 3600000).toISOString(),
    tags: ['missed', 'callback_required'],
    ticketId: null,
    ticketCreated: false,
    autoTicketCreation: false,
    responseTime: 0,
    isBusinessHours: true,
    callCost: 0,
    customerSatisfaction: null,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    createdBy: 'agent_456',
    isActive: true,
    isDeleted: false
  }
};

// Enhanced call logs retrieval with advanced filtering
const getCallLogs = (query = {}) => {
  const {
    limit = 50,
    offset = 0,
    page = 1,
    organizationId,
    teamId,
    userId,
    callType,
    status,
    dateFrom,
    dateTo,
    phoneNumber,
    contactName,
    hasRecording,
    hasTicket,
    minDuration,
    maxDuration,
    businessHoursOnly,
    tags,
    search,
    sortBy = 'callDate',
    sortOrder = 'desc'
  } = query;
  
  let callLogs = Object.values(enhancedCallLogDatabase);
  
  // Apply comprehensive filters
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
  if (status) {
    callLogs = callLogs.filter(c => c.status === status);
  }
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    callLogs = callLogs.filter(c => new Date(c.callDate) >= fromDate);
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    callLogs = callLogs.filter(c => new Date(c.callDate) <= toDate);
  }
  if (phoneNumber) {
    callLogs = callLogs.filter(c => c.phoneNumber.includes(phoneNumber));
  }
  if (contactName) {
    callLogs = callLogs.filter(c => 
      c.contactName?.toLowerCase().includes(contactName.toLowerCase())
    );
  }
  if (hasRecording === 'true') {
    callLogs = callLogs.filter(c => c.callRecordingUrl);
  } else if (hasRecording === 'false') {
    callLogs = callLogs.filter(c => !c.callRecordingUrl);
  }
  if (hasTicket === 'true') {
    callLogs = callLogs.filter(c => c.ticketCreated);
  } else if (hasTicket === 'false') {
    callLogs = callLogs.filter(c => !c.ticketCreated);
  }
  if (minDuration) {
    callLogs = callLogs.filter(c => c.duration >= parseInt(minDuration));
  }
  if (maxDuration) {
    callLogs = callLogs.filter(c => c.duration <= parseInt(maxDuration));
  }
  if (businessHoursOnly === 'true') {
    callLogs = callLogs.filter(c => c.isBusinessHours);
  }
  if (tags) {
    const tagArray = tags.split(',');
    callLogs = callLogs.filter(c => 
      tagArray.some(tag => c.tags?.includes(tag.trim()))
    );
  }
  if (search) {
    const searchLower = search.toLowerCase();
    callLogs = callLogs.filter(c => 
      c.contactName?.toLowerCase().includes(searchLower) ||
      c.company?.toLowerCase().includes(searchLower) ||
      c.phoneNumber.includes(searchLower) ||
      c.callNotes?.toLowerCase().includes(searchLower) ||
      c.callId?.toLowerCase().includes(searchLower)
    );
  }
  
  // Sorting
  callLogs.sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (sortBy === 'callDate' || sortBy === 'createdAt' || sortBy === 'updatedAt') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }
    
    if (sortOrder === 'desc') {
      return bValue > aValue ? 1 : -1;
    } else {
      return aValue > bValue ? 1 : -1;
    }
  });
  
  // Calculate aggregations
  const totalCalls = callLogs.length;
  const answeredCalls = callLogs.filter(c => c.status === 'answered').length;
  const missedCalls = callLogs.filter(c => c.status === 'missed').length;
  const totalDuration = callLogs.reduce((sum, c) => sum + c.duration, 0);
  const averageDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
  
  // Calculate pagination
  const currentPage = parseInt(page);
  const pageSize = parseInt(limit);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLogs = callLogs.slice(startIndex, endIndex);
  
  const totalPages = Math.ceil(totalCalls / pageSize);
  
  // Get available filters for UI
  const availableAgents = [...new Set(callLogs.map(c => ({
    userId: c.userId,
    name: c.userName,
    callCount: callLogs.filter(cl => cl.userId === c.userId).length
  })))];
  
  const availableTeams = [...new Set(callLogs.map(c => ({
    teamId: c.teamId,
    name: c.teamId.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    callCount: callLogs.filter(cl => cl.teamId === c.teamId).length
  })))];
  
  return {
    data: paginatedLogs,
    pagination: {
      currentPage,
      totalPages,
      totalRecords: totalCalls,
      hasNext: currentPage < totalPages,
      hasPrevious: currentPage > 1,
      pageSize
    },
    aggregations: {
      totalCalls,
      answeredCalls,
      missedCalls,
      totalDuration,
      averageDuration,
      callsByType: {
        incoming: callLogs.filter(c => c.callType === 'incoming').length,
        outgoing: callLogs.filter(c => c.callType === 'outgoing').length,
        missed: callLogs.filter(c => c.callType === 'missed').length
      },
      callsByStatus: {
        answered: answeredCalls,
        missed: missedCalls,
        busy: callLogs.filter(c => c.status === 'busy').length,
        failed: callLogs.filter(c => c.status === 'failed').length
      }
    },
    filters: {
      applied: {
        organizationId,
        teamId,
        userId,
        callType,
        status,
        dateFrom,
        dateTo
      },
      available: {
        agents: availableAgents,
        teams: availableTeams
      }
    }
  };
};

// Get call history for specific phone number
const getCallHistory = (phoneNumber, query = {}) => {
  const { organizationId, limit = 10 } = query;
  
  let callHistory = Object.values(enhancedCallLogDatabase)
    .filter(c => c.phoneNumber === phoneNumber);
    
  if (organizationId) {
    callHistory = callHistory.filter(c => c.organizationId === organizationId);
  }
  
  // Sort by most recent first
  callHistory.sort((a, b) => new Date(b.callDate) - new Date(a.callDate));
  
  // Limit results
  callHistory = callHistory.slice(0, parseInt(limit));
  
  // Get contact info from most recent call
  const contactInfo = callHistory.length > 0 ? {
    name: callHistory[0].contactName,
    company: callHistory[0].company,
    isKnownContact: callHistory[0].isKnownContact
  } : null;
  
  // Calculate stats
  const totalCalls = callHistory.length;
  const totalDuration = callHistory.reduce((sum, c) => sum + c.duration, 0);
  const averageDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
  const conversionRate = totalCalls > 0 ? 
    (callHistory.filter(c => c.ticketCreated).length / totalCalls * 100).toFixed(1) : 0;
  
  return {
    phoneNumber,
    contactInfo,
    callHistory: callHistory.map(call => ({
      _id: call._id,
      callDate: call.callDate,
      callType: call.callType,
      duration: call.duration,
      status: call.status,
      agentName: call.userName,
      callNotes: call.callNotes,
      ticketCreated: call.ticketCreated,
      ticketId: call.ticketId
    })),
    stats: {
      totalCalls,
      lastCallDate: callHistory.length > 0 ? callHistory[0].callDate : null,
      averageDuration,
      totalDuration,
      conversionRate: parseFloat(conversionRate)
    }
  };
};

// Get call analytics and statistics
const getCallAnalytics = (query = {}) => {
  const {
    organizationId,
    teamId,
    userId,
    dateFrom,
    dateTo,
    granularity = 'day'
  } = query;
  
  let callLogs = Object.values(enhancedCallLogDatabase);
  
  // Apply filters
  if (organizationId) {
    callLogs = callLogs.filter(c => c.organizationId === organizationId);
  }
  if (teamId) {
    callLogs = callLogs.filter(c => c.teamId === teamId);
  }
  if (userId) {
    callLogs = callLogs.filter(c => c.userId === userId);
  }
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    callLogs = callLogs.filter(c => new Date(c.callDate) >= fromDate);
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    callLogs = callLogs.filter(c => new Date(c.callDate) <= toDate);
  }
  
  // Calculate summary statistics
  const totalCalls = callLogs.length;
  const answeredCalls = callLogs.filter(c => c.status === 'answered').length;
  const missedCalls = callLogs.filter(c => c.status === 'missed').length;
  const totalCallTime = callLogs.reduce((sum, c) => sum + c.duration, 0);
  const averageDuration = totalCalls > 0 ? Math.round(totalCallTime / totalCalls) : 0;
  const averageResponseTime = callLogs
    .filter(c => c.responseTime > 0)
    .reduce((sum, c, _, arr) => sum + c.responseTime / arr.length, 0);
  const callConversionRate = totalCalls > 0 ?
    (callLogs.filter(c => c.ticketCreated).length / totalCalls * 100).toFixed(1) : 0;
  
  // Calculate busy hours
  const hourlyStats = {};
  callLogs.forEach(call => {
    const hour = new Date(call.callDate).getHours();
    hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
  });
  
  const busyHours = Object.entries(hourlyStats)
    .map(([hour, count]) => ({ hour: parseInt(hour), callCount: count }))
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 5);
  
  // Agent performance
  const agentStats = {};
  callLogs.forEach(call => {
    if (!agentStats[call.userId]) {
      agentStats[call.userId] = {
        userId: call.userId,
        name: call.userName,
        totalCalls: 0,
        answeredCalls: 0,
        totalDuration: 0,
        responseTimeSum: 0,
        responseTimeCount: 0,
        ticketsCreated: 0
      };
    }
    
    const agent = agentStats[call.userId];
    agent.totalCalls++;
    if (call.status === 'answered') agent.answeredCalls++;
    agent.totalDuration += call.duration;
    if (call.responseTime > 0) {
      agent.responseTimeSum += call.responseTime;
      agent.responseTimeCount++;
    }
    if (call.ticketCreated) agent.ticketsCreated++;
  });
  
  const agentPerformance = Object.values(agentStats).map(agent => ({
    ...agent,
    averageDuration: agent.totalCalls > 0 ? Math.round(agent.totalDuration / agent.totalCalls) : 0,
    responseTime: agent.responseTimeCount > 0 ? 
      (agent.responseTimeSum / agent.responseTimeCount).toFixed(1) : 0,
    conversionRate: agent.totalCalls > 0 ? 
      (agent.ticketsCreated / agent.totalCalls * 100).toFixed(1) : 0
  }));
  
  // Call patterns by hour, day
  const callsByHour = {};
  const callsByDay = {};
  
  callLogs.forEach(call => {
    const date = new Date(call.callDate);
    const hour = date.getHours();
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    
    callsByHour[hour] = (callsByHour[hour] || 0) + 1;
    callsByDay[dayName] = (callsByDay[dayName] || 0) + 1;
  });
  
  // Calculate percentages for call types
  const callsByTypePercent = {
    incoming: totalCalls > 0 ? 
      (callLogs.filter(c => c.callType === 'incoming').length / totalCalls * 100).toFixed(1) : 0,
    outgoing: totalCalls > 0 ? 
      (callLogs.filter(c => c.callType === 'outgoing').length / totalCalls * 100).toFixed(1) : 0,
    missed: totalCalls > 0 ? 
      (callLogs.filter(c => c.callType === 'missed').length / totalCalls * 100).toFixed(1) : 0
  };
  
  return {
    summary: {
      totalCalls,
      answeredCalls,
      missedCalls,
      averageDuration,
      totalCallTime,
      averageResponseTime: parseFloat(averageResponseTime.toFixed(1)),
      callConversionRate: parseFloat(callConversionRate),
      busyHours
    },
    trends: {
      callVolumeTrend: [
        { date: new Date(Date.now() - 86400000 * 6).toISOString().split('T')[0], calls: 142 },
        { date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0], calls: 156 },
        { date: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0], calls: 134 },
        { date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0], calls: 178 },
        { date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], calls: 165 },
        { date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0], calls: 189 },
        { date: new Date().toISOString().split('T')[0], calls: totalCalls }
      ],
      performanceTrend: [
        { date: new Date(Date.now() - 86400000 * 6).toISOString().split('T')[0], answerRate: 76.8 },
        { date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0], answerRate: 78.5 },
        { date: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0], answerRate: 82.1 },
        { date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0], answerRate: 79.3 },
        { date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], answerRate: 84.2 },
        { date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0], answerRate: 81.7 },
        { date: new Date().toISOString().split('T')[0], answerRate: totalCalls > 0 ? (answeredCalls / totalCalls * 100).toFixed(1) : 0 }
      ]
    },
    agentPerformance,
    callPatterns: {
      byHour: callsByHour,
      byDay: callsByDay,
      byType: callsByTypePercent
    }
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

    // Backend Setup Endpoints - For Initial User Creation
    if (method === 'POST' && pathname === '/api/setup/initial-user') {
      const body = await parseBody(req);
      const { email, password, firstName, lastName, organizationName } = body;

      if (!email || !password) {
        return jsonResponse(res, 400, {
          success: false,
          message: 'Email and password are required'
        });
      }

      // Create initial super admin user
      const userId = 'user_' + Date.now();
      const orgId = 'org_' + Date.now();
      
      const newUser = {
        id: userId,
        email,
        firstName: firstName || 'Admin',
        lastName: lastName || 'User',
        role: 'super_admin',
        organizationId: orgId,
        organizationName: organizationName || 'CallTracker Pro Organization',
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // Store in memory (in production, this would go to database)
      initialUsers[email] = { ...newUser, password };

      return jsonResponse(res, 201, {
        success: true,
        message: 'Initial user created successfully',
        data: {
          user: newUser,
          organization: {
            id: orgId,
            name: organizationName || 'CallTracker Pro Organization',
            plan: 'enterprise',
            users: 1,
            isActive: true
          }
        }
      });
    }

    if (method === 'GET' && pathname === '/api/setup/test-connection') {
      return jsonResponse(res, 200, {
        success: true,
        message: 'Backend connection successful',
        data: {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          version: '2.0.0',
          features: ['call-logs', 'tickets', 'real-time-updates', 'analytics'],
          endpoints: [
            'POST /api/auth/login',
            'POST /api/setup/initial-user',
            'GET /api/setup/test-connection',
            'GET /api/call-logs',
            'GET /api/tickets',
            'GET /api/organizations'
          ]
        }
      });
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await parseBody(req);
      const { email, password } = body;

      // Check Supabase database first for actual user data
      if (supabase) {
        try {
          // Check if user exists in Supabase (your actual app data)
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

          if (!userError && userData) {
            // For your actual account, check the password (in production, use proper password hashing)
            if (email === 'anas@anas.com' && password === 'Anas@1234') {
              const token = jwt.sign(
                {
                  userId: userData.id,
                  email: userData.email,
                  role: userData.role || 'super_admin',
                  organizationId: userData.organization_id || 'calltrackerpro-org'
                },
                process.env.JWT_SECRET || 'fallback-secret',
                { expiresIn: '24h' }
              );

              return jsonResponse(res, 200, {
                success: true,
                token,
                user: {
                  id: userData.id,
                  email: userData.email,
                  firstName: userData.first_name || 'Anas',
                  lastName: userData.last_name || 'Ahmed',
                  role: userData.role || 'super_admin',
                  organizationId: userData.organization_id || 'calltrackerpro-org',
                  organizationName: 'CallTracker Pro'
                },
                message: 'Login successful - Connected to your actual app data'
              });
            }
          }
        } catch (error) {
          console.error('Supabase login error:', error);
        }
      }

      // Check initial users (from setup endpoint)
      if (initialUsers[email] && initialUsers[email].password === password) {
        const user = initialUsers[email];
        const token = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );

        return jsonResponse(res, 200, {
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            organizationId: user.organizationId,
            organizationName: user.organizationName
          },
          message: 'Login successful'
        });
      }

      // Fallback to demo credentials (for testing only)
      const demoCredentials = [
        // Your actual CallTrackerPro app admin account (fallback if not in Supabase)
        { email: 'anas@anas.com', password: 'Anas@1234', role: 'super_admin', isActualUser: true },
        // Demo accounts for testing
        { email: 'admin@calltrackerpro.com', password: 'Admin@123', role: 'super_admin' },
        { email: 'manager@demo.com', password: 'Manager@123', role: 'manager' },
        { email: 'agent@demo.com', password: 'Agent@123', role: 'agent' }
      ];

      const demoUser = demoCredentials.find(cred => cred.email === email && cred.password === password);
      
      if (demoUser) {
        const orgId = demoUser.isActualUser ? 'calltrackerpro-org' : 'demo-org-id';
        const orgName = demoUser.isActualUser ? 'CallTracker Pro' : 'Demo Organization';
        
        const token = jwt.sign(
          {
            userId: demoUser.isActualUser ? 'anas-user-id' : 'demo_' + demoUser.role,
            email: demoUser.email,
            role: demoUser.role,
            organizationId: orgId
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );

        return jsonResponse(res, 200, {
          success: true,
          token,
          user: {
            email: demoUser.email,
            role: demoUser.role,
            organizationId: orgId,
            firstName: demoUser.isActualUser ? 'Anas' : demoUser.role.charAt(0).toUpperCase() + demoUser.role.slice(1),
            lastName: demoUser.isActualUser ? 'Ahmed' : 'User',
            organizationName: orgName
          },
          message: demoUser.isActualUser ? 'Login successful - Your actual account' : 'Demo login successful'
        });
      }

      return jsonResponse(res, 401, {
        success: false,
        message: 'Invalid credentials. Use your actual account: anas@anas.com / Anas@1234',
        availableCredentials: [
          'anas@anas.com / Anas@1234 (Your actual account)',
          'admin@calltrackerpro.com / Admin@123 (Demo Super Admin)',
          'manager@demo.com / Manager@123 (Demo Manager)',
          'agent@demo.com / Agent@123 (Demo Agent)'
        ]
      });
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
      const query = parsedUrl.query;
      const { organizationId, teamId, callType, status, hasTicket, dateFrom, dateTo, page = 1, limit = 50 } = query;

      // Try to fetch from Supabase first (your actual app data)
      if (supabase) {
        try {
          let supabaseQuery = supabase
            .from('call_logs')
            .select('*')
            .order('created_at', { ascending: false });

          // Apply filters
          if (organizationId && organizationId !== 'demo-org-id') {
            supabaseQuery = supabaseQuery.eq('organization_id', organizationId);
          }
          if (teamId) {
            supabaseQuery = supabaseQuery.eq('team_id', teamId);
          }
          if (callType) {
            supabaseQuery = supabaseQuery.eq('call_type', callType);
          }
          if (status) {
            supabaseQuery = supabaseQuery.eq('status', status);
          }
          if (hasTicket === 'true') {
            supabaseQuery = supabaseQuery.not('ticket_id', 'is', null);
          }
          if (dateFrom) {
            supabaseQuery = supabaseQuery.gte('created_at', dateFrom);
          }
          if (dateTo) {
            supabaseQuery = supabaseQuery.lte('created_at', dateTo);
          }

          // Pagination
          const offset = (page - 1) * limit;
          supabaseQuery = supabaseQuery.range(offset, offset + parseInt(limit) - 1);

          const { data: callLogsData, error: callLogsError, count } = await supabaseQuery;

          if (!callLogsError && callLogsData && callLogsData.length > 0) {
            // Transform Supabase data to match frontend format
            const formattedCallLogs = callLogsData.map(log => ({
              _id: log.id,
              callId: log.call_id || `CALL-${new Date(log.created_at).getFullYear()}-${String(log.id).padStart(3, '0')}`,
              phoneNumber: log.phone_number,
              contactName: log.contact_name || 'Unknown Contact',
              company: log.company || '',
              callType: log.call_type || 'incoming',
              callDate: log.created_at,
              duration: log.duration || 0,
              status: log.status || 'answered',
              callQuality: log.call_quality || 3,
              organizationId: log.organization_id,
              teamId: log.team_id,
              userId: log.user_id,
              ticketId: log.ticket_id,
              ticketCreated: !!log.ticket_id,
              autoTicketCreation: log.auto_ticket_creation || false,
              createdAt: log.created_at,
              notes: log.notes || ''
            }));

            return jsonResponse(res, 200, {
              success: true,
              data: formattedCallLogs,
              pagination: {
                total: count || formattedCallLogs.length,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((count || formattedCallLogs.length) / parseInt(limit))
              },
              filters: query,
              message: 'Call logs from your actual CallTrackerPro app'
            });
          }
        } catch (error) {
          console.error('Supabase call logs error:', error);
        }
      }

      // Fallback to demo data if Supabase fails or for demo org
      return jsonResponse(res, 200, {
        success: true,
        data: [
          {
            _id: 'demo_call_001',
            callId: 'CALL-2024-08-001',
            phoneNumber: '+1 (555) 123-4567',
            contactName: 'John Doe',
            company: 'Demo Corp',
            callType: 'incoming',
            callDate: new Date(Date.now() - 3600000).toISOString(),
            duration: 323,
            status: 'answered',
            callQuality: 4,
            organizationId: organizationId || 'demo-org-id',
            teamId: teamId || 'demo-team',
            userId: 'demo-user',
            ticketId: 'demo-ticket-001',
            ticketCreated: true,
            autoTicketCreation: true,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            notes: 'Demo call from dashboard testing'
          },
          {
            _id: 'demo_call_002',
            callId: 'CALL-2024-08-002', 
            phoneNumber: '+1 (555) 987-6543',
            contactName: 'Jane Smith',
            company: 'Another Corp',
            callType: 'outgoing',
            callDate: new Date(Date.now() - 7200000).toISOString(),
            duration: 156,
            status: 'missed',
            callQuality: 2,
            organizationId: organizationId || 'demo-org-id',
            teamId: teamId || 'demo-team',
            userId: 'demo-user',
            ticketId: null,
            ticketCreated: false,
            autoTicketCreation: false,
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            notes: 'Missed call - need follow up'
          }
        ],
        pagination: {
          total: 2,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 1
        },
        filters: query,
        message: organizationId === 'demo-org-id' ? 'Demo call logs for testing' : 'Fallback demo data - check Supabase connection'
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

    // Get call logs with enhanced filtering
    if (method === 'GET' && pathname === '/api/call-logs') {
      const query = parsedUrl.query;
      const result = getCallLogs(query);
      
      return jsonResponse(res, 200, {
        success: true,
        data: {
          callLogs: result.data,
          pagination: result.pagination,
          aggregations: result.aggregations,
          filters: result.filters
        },
        message: 'Call logs retrieved successfully'
      });
    }

    // Get call history for specific phone number
    if (method === 'GET' && pathname.match(/^\/api\/call-logs\/history\/(.+)$/)) {
      const phoneNumber = decodeURIComponent(pathname.split('/')[4]);
      const query = parsedUrl.query;
      const history = getCallHistory(phoneNumber, query);
      
      return jsonResponse(res, 200, {
        success: true,
        data: history
      });
    }

    // Get call analytics and statistics
    if (method === 'GET' && pathname === '/api/call-logs/analytics/stats') {
      const query = parsedUrl.query;
      const analytics = getCallAnalytics(query);
      
      return jsonResponse(res, 200, {
        success: true,
        data: analytics
      });
    }

    // Real-time call logs stream via SSE
    if (method === 'GET' && pathname === '/api/call-logs/stream') {
      const query = parsedUrl.query;
      const { organizationId, teamId, userId } = query;
      
      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization'
      });
      
      // Send initial connection message
      res.write('data: {"type":"connected","message":"Call logs SSE connected","organizationId":"' + organizationId + '"}\n\n');
      
      // Send sample call log events (in production, these would be real events)
      setTimeout(() => {
        res.write('event: CALL_LOG_CREATED\n');
        res.write('data: {"type":"CALL_LOG_CREATED","timestamp":"' + new Date().toISOString() + '","data":{"callLog":{"_id":"new_call_001","phoneNumber":"+1555123456","callType":"incoming","status":"answered","organizationId":"' + organizationId + '"}}}\n\n');
      }, 5000);
      
      setTimeout(() => {
        res.write('event: CALL_ANALYTICS_UPDATED\n');
        res.write('data: {"type":"CALL_ANALYTICS_UPDATED","timestamp":"' + new Date().toISOString() + '","data":{"organizationId":"' + organizationId + '","stats":{"todaysCalls":45,"answeredToday":38,"missedToday":7}}}\n\n');
      }, 10000);
      
      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write('data: {"type":"heartbeat","timestamp":"' + new Date().toISOString() + '"}\n\n');
      }, 30000);
      
      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        console.log('Call logs SSE client disconnected');
      });
      
      return; // Don't call jsonResponse for SSE
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

    // Super Admin Endpoints
    if (method === 'GET' && pathname === '/api/super-admin/organizations') {
      return jsonResponse(res, 200, {
        success: true,
        data: [
          {
            id: 'demo-org-id',
            name: 'Demo Organization',
            plan: 'enterprise',
            users: 5,
            status: 'active',
            createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
            isActive: true,
            subscription: {
              plan: 'enterprise',
              status: 'active',
              billingCycle: 'monthly'
            },
            settings: {
              callLogging: true,
              realTimeUpdates: true,
              analytics: true
            }
          },
          {
            id: 'org_12345',
            name: 'CallTracker Pro Organization',
            plan: 'pro',
            users: 12,
            status: 'active',
            createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
            isActive: true,
            subscription: {
              plan: 'pro',
              status: 'active',
              billingCycle: 'yearly'
            },
            settings: {
              callLogging: true,
              realTimeUpdates: true,
              analytics: false
            }
          }
        ],
        total: 2,
        message: 'All organizations retrieved successfully'
      });
    }

    if (method === 'GET' && pathname === '/api/super-admin/users') {
      return jsonResponse(res, 200, {
        success: true,
        data: [
          {
            id: 'demo_super_admin',
            firstName: 'Super',
            lastName: 'Admin',
            email: 'admin@calltrackerpro.com',
            role: 'super_admin',
            organizationId: 'demo-org-id',
            organizationName: 'Demo Organization',
            isActive: true,
            lastLogin: new Date(Date.now() - 3600000).toISOString(),
            createdAt: new Date(Date.now() - 86400000 * 30).toISOString()
          },
          {
            id: 'demo_manager',
            firstName: 'Manager',
            lastName: 'User',
            email: 'manager@demo.com',
            role: 'manager',
            organizationId: 'demo-org-id',
            organizationName: 'Demo Organization',
            isActive: true,
            lastLogin: new Date(Date.now() - 7200000).toISOString(),
            createdAt: new Date(Date.now() - 86400000 * 25).toISOString()
          },
          {
            id: 'demo_agent',
            firstName: 'Agent',
            lastName: 'User',
            email: 'agent@demo.com',
            role: 'agent',
            organizationId: 'demo-org-id',
            organizationName: 'Demo Organization',
            isActive: true,
            lastLogin: new Date(Date.now() - 1800000).toISOString(),
            createdAt: new Date(Date.now() - 86400000 * 20).toISOString()
          },
          {
            id: 'org_admin_001',
            firstName: 'John',
            lastName: 'Smith',
            email: 'john@calltrackerpro.com',
            role: 'org_admin',
            organizationId: 'org_12345',
            organizationName: 'CallTracker Pro Organization',
            isActive: true,
            lastLogin: new Date(Date.now() - 14400000).toISOString(),
            createdAt: new Date(Date.now() - 86400000 * 50).toISOString()
          }
        ],
        total: 4,
        message: 'All users retrieved successfully'
      });
    }

    if (method === 'GET' && pathname === '/api/super-admin/stats') {
      return jsonResponse(res, 200, {
        success: true,
        data: {
          platform: {
            totalOrganizations: 2,
            activeOrganizations: 2,
            totalUsers: 4,
            activeUsers: 4,
            totalCallLogs: 1250,
            totalTickets: 450
          },
          performance: {
            averageResponseTime: '145ms',
            uptime: '99.9%',
            errorRate: '0.1%',
            throughput: '2.5K requests/hour'
          },
          growth: {
            newOrganizationsThisMonth: 1,
            newUsersThisMonth: 2,
            callsGrowth: '+15%',
            ticketsGrowth: '+22%'
          },
          revenue: {
            monthlyRecurringRevenue: 5980,
            annualRecurringRevenue: 71760,
            averageRevenuePerUser: 149.50,
            churnRate: '2.5%'
          }
        },
        message: 'Platform statistics retrieved successfully'
      });
    }

    if (method === 'POST' && pathname === '/api/super-admin/organizations') {
      const body = await parseBody(req);
      const { name, plan, adminEmail, adminName } = body;

      const newOrgId = 'org_' + Date.now();
      const newUserId = 'user_' + Date.now();

      return jsonResponse(res, 201, {
        success: true,
        message: 'Organization created successfully',
        data: {
          organization: {
            id: newOrgId,
            name: name || 'New Organization',
            plan: plan || 'pro',
            users: 1,
            status: 'active',
            createdAt: new Date().toISOString(),
            isActive: true
          },
          adminUser: {
            id: newUserId,
            email: adminEmail,
            name: adminName || 'Organization Admin',
            role: 'org_admin',
            organizationId: newOrgId,
            isActive: true,
            createdAt: new Date().toISOString()
          }
        }
      });
    }

    if (method === 'POST' && pathname === '/api/super-admin/users') {
      const body = await parseBody(req);
      const { email, firstName, lastName, role, organizationId } = body;

      const newUserId = 'user_' + Date.now();

      return jsonResponse(res, 201, {
        success: true,
        message: 'User created successfully',
        data: {
          id: newUserId,
          email,
          firstName: firstName || 'New',
          lastName: lastName || 'User',
          role: role || 'agent',
          organizationId,
          isActive: true,
          createdAt: new Date().toISOString()
        }
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