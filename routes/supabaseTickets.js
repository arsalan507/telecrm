// routes/supabaseTickets.js - Ticket Management using Supabase
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const SupabaseUser = require('../models/SupabaseUser');

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

// @route   GET /api/tickets
// @desc    Get tickets with filtering and pagination
// @access  Authenticated
router.get('/', supabaseAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assigned_to,
      created_by,
      search
    } = req.query;

    console.log('🎫 Fetching tickets for user:', req.user.role);

    let query = supabase
      .from('tickets')
      .select(`
        *,
        assigned_user:users!tickets_assigned_to_fkey(first_name, last_name, email),
        created_user:users!tickets_created_by_fkey(first_name, last_name, email),
        contacts(first_name, last_name, email, phone)
      `, { count: 'exact' });

    // Apply organization filter
    query = query.eq('organization_id', req.user.organization_id);

    // Role-based access control
    if (req.user.role === 'agent') {
      query = query.eq('assigned_to', req.user.id);
    } else if (req.user.role === 'viewer') {
      query = query.eq('created_by', req.user.id);
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }
    if (created_by) {
      query = query.eq('created_by', created_by);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,ticket_id.ilike.%${search}%`);
    }

    // Apply pagination and sorting
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: tickets, error, count } = await query;

    if (error) throw error;

    // Format response
    const formattedTickets = tickets.map(ticket => ({
      id: ticket.id,
      ticket_id: ticket.ticket_id,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      due_date: ticket.due_date,
      resolved_at: ticket.resolved_at,
      customer: ticket.contacts ? {
        name: `${ticket.contacts.first_name} ${ticket.contacts.last_name}`,
        email: ticket.contacts.email,
        phone: ticket.contacts.phone
      } : {
        email: ticket.customer_email,
        phone: ticket.customer_phone
      },
      assigned_to: ticket.assigned_user ? {
        name: `${ticket.assigned_user.first_name} ${ticket.assigned_user.last_name}`,
        email: ticket.assigned_user.email
      } : null,
      created_by: ticket.created_user ? {
        name: `${ticket.created_user.first_name} ${ticket.created_user.last_name}`,
        email: ticket.created_user.email
      } : null,
      tags: ticket.tags,
      custom_fields: ticket.custom_fields
    }));

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: formattedTickets,
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
    console.error('❌ Error fetching tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
});

// @route   POST /api/tickets
// @desc    Create new ticket
// @access  Authenticated
router.post('/', supabaseAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      priority = 'medium',
      assigned_to,
      customer_email,
      customer_phone,
      due_date,
      tags = [],
      custom_fields = {}
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    // Generate unique ticket ID
    const ticketId = `CTP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Find customer if email/phone provided
    let customer_id = null;
    if (customer_email || customer_phone) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', req.user.organization_id)
        .or(`email.eq.${customer_email},phone.eq.${customer_phone?.replace(/\D/g, '')}`)
        .single();
      
      customer_id = contact?.id;
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert([{
        organization_id: req.user.organization_id,
        ticket_id: ticketId,
        title,
        description,
        priority,
        status: 'open',
        assigned_to: assigned_to || req.user.id,
        created_by: req.user.id,
        customer_id,
        customer_email,
        customer_phone: customer_phone?.replace(/\D/g, ''),
        due_date,
        tags,
        custom_fields
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: {
        id: ticket.id,
        ticket_id: ticket.ticket_id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error creating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket',
      error: error.message
    });
  }
});

// @route   PUT /api/tickets/:id
// @desc    Update ticket
// @access  Authenticated
router.put('/:id', supabaseAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Add resolution timestamp if status is being changed to resolved
    if (updateData.status === 'resolved' && updateData.status !== 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    updateData.updated_at = new Date().toISOString();

    const { data: ticket, error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', req.user.organization_id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: ticket
    });

  } catch (error) {
    console.error('❌ Error updating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket',
      error: error.message
    });
  }
});

// @route   GET /api/tickets/stats
// @desc    Get ticket statistics
// @access  Authenticated
router.get('/stats', supabaseAuth, async (req, res) => {
  try {
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('organization_id', req.user.organization_id);

    // Role-based filtering
    if (req.user.role === 'agent') {
      query = query.eq('assigned_to', req.user.id);
    } else if (req.user.role === 'viewer') {
      query = query.eq('created_by', req.user.id);
    }

    const { data: tickets, error } = await query;
    if (error) throw error;

    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length,
      high_priority: tickets.filter(t => t.priority === 'high').length,
      urgent_priority: tickets.filter(t => t.priority === 'urgent').length,
      overdue: tickets.filter(t => t.due_date && new Date(t.due_date) < new Date() && !['resolved', 'closed'].includes(t.status)).length
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching ticket stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket statistics',
      error: error.message
    });
  }
});

// @route   GET /api/tickets/test
// @desc    Test endpoint
// @access  Public
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'CallTracker Pro Tickets API with Supabase is working!',
    version: '2.0.0',
    features: [
      'Automatic Ticket Creation from Calls',
      'Role-based Access Control',
      'Priority Management',
      'Customer Integration',
      'Real-time Updates',
      'Advanced Search and Filtering'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;