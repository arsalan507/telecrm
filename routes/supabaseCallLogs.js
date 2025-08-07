// routes/supabaseCallLogs.js - Call Logs with Automatic Ticket Creation using Supabase
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const SupabaseUser = require('../models/SupabaseUser');

// Explicit CORS middleware for call logs routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-organization-id, Accept, Origin, X-Requested-With, Cache-Control');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '0');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Supabase Authentication Middleware
const supabaseAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await SupabaseUser.findById(decoded.userId);
    
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or inactive user.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// @route   POST /api/call-logs
// @desc    Record incoming call and auto-create ticket
// @access  Authenticated
router.post('/', supabaseAuth, async (req, res) => {
  try {
    console.log('📞 Recording incoming call:', req.body);
    
    const {
      phone_number,
      type = 'inbound',
      duration = 0,
      status = 'completed',
      caller_name,
      notes,
      auto_create_ticket = true
    } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if contact exists, if not create one
    let contact = null;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', phone_number.replace(/\D/g, ''))
      .eq('organization_id', req.user.organization_id)
      .single();

    if (existingContact) {
      contact = existingContact;
      console.log('📞 Found existing contact:', contact.id);
    } else {
      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert([{
          first_name: caller_name || 'Unknown',
          last_name: 'Caller',
          phone: phone_number.replace(/\D/g, ''),
          email: null,
          organization_id: req.user.organization_id,
          status: 'new',
          lead_source: 'phone_call',
          assigned_to: req.user.id,
          created_by: req.user.id
        }])
        .select()
        .single();

      if (contactError) throw contactError;
      contact = newContact;
      console.log('📞 Created new contact:', contact.id);
    }

    // Create call log
    const { data: callLog, error: callError } = await supabase
      .from('call_logs')
      .insert([{
        organization_id: req.user.organization_id,
        user_id: req.user.id,
        contact_id: contact.id,
        phone_number: phone_number.replace(/\D/g, ''),
        type,
        status,
        duration,
        summary: notes || `${type === 'inbound' ? 'Incoming' : 'Outgoing'} call from ${phone_number}`,
        notes: notes || '',
        follow_up_required: auto_create_ticket
      }])
      .select()
      .single();

    if (callError) throw callError;

    let ticket = null;
    if (auto_create_ticket) {
      // Generate unique ticket ID
      const ticketId = `CTP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      // Create ticket automatically
      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert([{
          organization_id: req.user.organization_id,
          ticket_id: ticketId,
          title: `Call Follow-up: ${phone_number}`,
          description: `Automatic ticket created for ${type} call.\n\nCall Details:\n- Phone: ${phone_number}\n- Duration: ${duration} seconds\n- Status: ${status}\n- Notes: ${notes || 'No notes provided'}`,
          priority: 'medium',
          status: 'open',
          assigned_to: req.user.id,
          created_by: req.user.id,
          customer_id: contact.id,
          customer_email: contact.email,
          customer_phone: contact.phone,
          tags: ['call_followup', 'auto_created'],
          custom_fields: {
            call_log_id: callLog.id,
            call_duration: duration,
            call_type: type,
            original_phone: phone_number
          }
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;
      ticket = newTicket;
      console.log('🎫 Created automatic ticket:', ticket.ticket_id);

      // Update call log with ticket reference
      await supabase
        .from('call_logs')
        .update({ 
          metadata: { 
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_id
          }
        })
        .eq('id', callLog.id);
    }

    // Get call history for this phone number
    const { data: callHistory } = await supabase
      .from('call_logs')
      .select(`
        *,
        users!inner(first_name, last_name, email)
      `)
      .eq('phone_number', phone_number.replace(/\D/g, ''))
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.status(201).json({
      success: true,
      message: 'Call recorded successfully',
      data: {
        call_log: {
          id: callLog.id,
          phone_number: callLog.phone_number,
          type: callLog.type,
          status: callLog.status,
          duration: callLog.duration,
          summary: callLog.summary,
          notes: callLog.notes,
          created_at: callLog.created_at,
          follow_up_required: callLog.follow_up_required
        },
        contact: {
          id: contact.id,
          name: `${contact.first_name} ${contact.last_name}`,
          phone: contact.phone,
          email: contact.email,
          status: contact.status
        },
        ticket: ticket ? {
          id: ticket.id,
          ticket_id: ticket.ticket_id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          created_at: ticket.created_at
        } : null,
        call_history: callHistory?.map(call => ({
          id: call.id,
          type: call.type,
          status: call.status,
          duration: call.duration,
          summary: call.summary,
          created_at: call.created_at,
          handled_by: call.users ? `${call.users.first_name} ${call.users.last_name}` : 'Unknown'
        })) || []
      }
    });

  } catch (error) {
    console.error('❌ Error recording call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record call',
      error: error.message
    });
  }
});

// @route   GET /api/call-logs
// @desc    Get call logs with filtering and pagination
// @access  Authenticated
router.get('/', supabaseAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      phone_number,
      type,
      status,
      start_date,
      end_date
    } = req.query;

    console.log('📞 Fetching call logs for user:', req.user.role);

    let query = supabase
      .from('call_logs')
      .select(`
        *,
        contacts!inner(first_name, last_name, email, phone),
        users!inner(first_name, last_name, email)
      `, { count: 'exact' });

    // Apply organization filter (skip for super_admin)
    if (req.user.role !== 'super_admin' && req.user.organization_id) {
      query = query.eq('organization_id', req.user.organization_id);
    }

    // Role-based access control
    if (req.user.role === 'agent' || req.user.role === 'viewer') {
      query = query.eq('user_id', req.user.id);
    }

    // Apply filters
    if (phone_number) {
      query = query.eq('phone_number', phone_number.replace(/\D/g, ''));
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply pagination and sorting
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: callLogs, error, count } = await query;

    if (error) throw error;

    // Format response
    const formattedCalls = callLogs.map(call => ({
      id: call.id,
      phone_number: call.phone_number,
      type: call.type,
      status: call.status,
      duration: call.duration,
      summary: call.summary,
      notes: call.notes,
      follow_up_required: call.follow_up_required,
      created_at: call.created_at,
      contact: {
        id: call.contacts.id,
        name: `${call.contacts.first_name} ${call.contacts.last_name}`,
        phone: call.contacts.phone,
        email: call.contacts.email
      },
      handled_by: {
        name: `${call.users.first_name} ${call.users.last_name}`,
        email: call.users.email
      },
      metadata: call.metadata
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: formattedCalls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Error fetching call logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call logs',
      error: error.message
    });
  }
});

// @route   GET /api/call-logs/history/:phone
// @desc    Get call history for specific phone number
// @access  Authenticated
router.get('/history/:phone', supabaseAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const cleanPhone = phone.replace(/\D/g, '');

    console.log('📞 Fetching call history for phone:', cleanPhone);

    const { data: callHistory, error } = await supabase
      .from('call_logs')
      .select(`
        *,
        contacts!inner(first_name, last_name, email),
        users!inner(first_name, last_name, email)
      `)
      .eq('phone_number', cleanPhone)
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get contact info
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('organization_id', req.user.organization_id)
      .single();

    // Get related tickets
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .eq('customer_phone', cleanPhone)
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false });

    res.json({
      success: true,
      data: {
        contact: contact ? {
          id: contact.id,
          name: `${contact.first_name} ${contact.last_name}`,
          phone: contact.phone,
          email: contact.email,
          status: contact.status,
          created_at: contact.created_at
        } : null,
        call_history: callHistory.map(call => ({
          id: call.id,
          type: call.type,
          status: call.status,
          duration: call.duration,
          summary: call.summary,
          notes: call.notes,
          created_at: call.created_at,
          handled_by: `${call.users.first_name} ${call.users.last_name}`,
          metadata: call.metadata
        })),
        related_tickets: tickets?.map(ticket => ({
          id: ticket.id,
          ticket_id: ticket.ticket_id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          created_at: ticket.created_at
        })) || []
      }
    });

  } catch (error) {
    console.error('❌ Error fetching call history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call history',
      error: error.message
    });
  }
});

// @route   PUT /api/call-logs/:id
// @desc    Update call log
// @access  Authenticated
router.put('/:id', supabaseAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, summary, follow_up_required } = req.body;

    console.log('📞 Updating call log:', id);

    const { data: callLog, error } = await supabase
      .from('call_logs')
      .update({
        notes,
        summary,
        follow_up_required,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Call log updated successfully',
      data: callLog
    });

  } catch (error) {
    console.error('❌ Error updating call log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update call log',
      error: error.message
    });
  }
});

// @route   GET /api/call-logs/analytics/stats
// @desc    Get call analytics and statistics
// @access  Authenticated
router.get('/analytics/stats', supabaseAuth, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    let startDate = new Date();
    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Base query filters
    let baseQuery = supabase
      .from('call_logs')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .gte('created_at', startDate.toISOString());

    // Role-based filtering
    if (req.user.role === 'agent' || req.user.role === 'viewer') {
      baseQuery = baseQuery.eq('user_id', req.user.id);
    }

    const { data: calls, error } = await baseQuery;
    if (error) throw error;

    // Calculate statistics
    const stats = {
      total_calls: calls.length,
      inbound_calls: calls.filter(c => c.type === 'inbound').length,
      outbound_calls: calls.filter(c => c.type === 'outbound').length,
      completed_calls: calls.filter(c => c.status === 'completed').length,
      missed_calls: calls.filter(c => c.status === 'missed').length,
      total_duration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
      average_duration: calls.length > 0 ? Math.round(calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length) : 0,
      follow_ups_required: calls.filter(c => c.follow_up_required).length
    };

    res.json({
      success: true,
      data: stats,
      timeRange
    });

  } catch (error) {
    console.error('❌ Error fetching call analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call analytics',
      error: error.message
    });
  }
});

// @route   GET /api/call-logs/test
// @desc    Test endpoint
// @access  Public
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'CallTracker Pro Call Logs API with Supabase is working!',
    version: '2.0.0',
    features: [
      'Automatic Ticket Creation',
      'Call History Tracking',
      'Contact Management Integration',
      'Role-based Access Control',
      'Real-time Analytics',
      'Phone Number Deduplication'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;