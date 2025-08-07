// routes/demoRequestsSimplified.js - Simplified Demo Requests for CallTracker Pro
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

// Load email service with error handling
let emailService;
try {
  emailService = require('../services/emailService');
} catch (error) {
  console.warn('⚠️ Email service disabled:', error.message);
}

// Explicit CORS middleware for demo requests routes
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

// Simplified lead scoring algorithm
const calculateLeadScore = (data) => {
  let score = 50; // Base score
  
  // Urgency scoring (primary factor)
  const urgencyPoints = {
    'urgent': 30,
    'planned': 15,
    'exploring': 0
  };
  score += urgencyPoints[data.urgency] || 0;
  
  // Timeline boost
  const timelinePoints = {
    'this-week': 20,
    'this-month': 10,
    'next-month': 5,
    'next-quarter': 0,
    'flexible': -5
  };
  score += timelinePoints[data.timeline] || 0;
  
  // Budget indicator
  const budgetPoints = {
    '10k-plus': 15,
    '5k-10k': 10,
    '1k-5k': 5,
    'under-1k': 0,
    'not-sure': -5
  };
  score += budgetPoints[data.budget] || 0;
  
  // Pain point urgency
  const painPoints = {
    'wasted-ad-spend': 10,
    'poor-roi-tracking': 8,
    'missed-opportunities': 12,
    'manual-tracking': 5,
    'competitor-advantage': 10,
    'other': 3
  };
  score += painPoints[data.currentPain] || 0;
  
  // Company presence adds credibility
  if (data.company && data.company.length > 0) {
    score += 5;
  }
  
  // Phone number indicates serious intent
  if (data.phone && data.phone.length > 0) {
    score += 5;
  }
  
  return Math.min(Math.max(score, 0), 100); // Clamp between 0-100
};

// Determine priority and segment
const calculatePriorityAndSegment = (data, leadScore) => {
  // Priority based on urgency and timeline
  let priority = data.urgency === 'urgent' ? 'high' :
                 data.urgency === 'planned' ? 'medium' : 'low';
  
  // Timeline boost
  if (data.timeline === 'this-week' || data.timeline === 'this-month') {
    priority = priority === 'low' ? 'medium' : 
               priority === 'medium' ? 'high' : priority;
  }
  
  // Segment based on budget
  const segment = data.budget === '10k-plus' || data.budget === '5k-10k' ? 'enterprise' :
                  data.budget === '1k-5k' ? 'mid-market' : 'small-business';
  
  return { priority, segment };
};

// Generate follow-up actions
const getFollowUpActions = (urgency, priority) => {
  if (urgency === 'urgent') {
    return {
      followUpHours: 2,
      actions: ['Send immediate sales alert', 'Call within 2 hours', 'Priority demo scheduling'],
      emailTemplate: 'urgent-lead'
    };
  } else if (urgency === 'planned') {
    return {
      followUpHours: 24,
      actions: ['Add to CRM with high priority', 'Email within 4 hours', 'Call within 24 hours'],
      emailTemplate: 'qualified-lead'
    };
  } else {
    return {
      followUpHours: 72,
      actions: ['Add to nurture campaign', 'Send resource email', 'Follow up in 3 days'],
      emailTemplate: 'exploring-lead'
    };
  }
};

// @route   POST /api/demo-requests
// @desc    Handle simplified demo booking requests
// @access  Public
router.post('/', async (req, res) => {
  try {
    console.log('📋 Simplified demo request received:', req.body);
    
    const {
      name,
      email,
      company,
      phone,
      urgency,
      currentPain,
      budget,
      timeline,
      message
    } = req.body;

    // Validation - Required fields
    if (!name || !email || !urgency) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, email, urgency'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Urgency validation
    const validUrgencies = ['urgent', 'planned', 'exploring'];
    if (!validUrgencies.includes(urgency)) {
      return res.status(400).json({
        success: false,
        message: 'Urgency must be one of: urgent, planned, exploring'
      });
    }

    // Calculate lead intelligence
    const leadScore = calculateLeadScore(req.body);
    const { priority, segment } = calculatePriorityAndSegment(req.body, leadScore);
    const followUpActions = getFollowUpActions(urgency, priority);
    
    console.log('🧠 Lead analysis:', { leadScore, priority, segment, urgency });

    // Collect metadata
    const metadata = {
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      referrer_url: req.get('Referer'),
      utm_source: req.query.utm_source,
      utm_medium: req.query.utm_medium,
      utm_campaign: req.query.utm_campaign
    };

    // Check for existing demo request
    const { data: existingRequest } = await supabase
      .from('demo_requests')
      .select('id, status, created_at')
      .eq('email', email.toLowerCase())
      .single();

    if (existingRequest && existingRequest.status !== 'lost') {
      return res.status(409).json({
        success: false,
        message: 'A demo request already exists for this email address',
        existingRequest: {
          id: existingRequest.id,
          status: existingRequest.status,
          createdAt: existingRequest.created_at
        }
      });
    }

    // Insert demo request
    const { data: demoRequest, error } = await supabase
      .from('demo_requests')
      .insert([{
        name: name.trim(),
        email: email.toLowerCase().trim(),
        company: company?.trim(),
        phone: phone?.trim(),
        urgency: urgency,
        current_pain: currentPain,
        budget: budget,
        timeline: timeline,
        message: message?.trim(),
        priority: priority,
        segment: segment, 
        lead_score: leadScore,
        status: 'new',
        lead_source: 'demo-form',
        ...metadata
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log('✅ Demo request created:', demoRequest.id);

    // Send notifications if email service is available
    if (emailService && priority === 'high') {
      try {
        // Send internal sales alert for high-priority leads
        await emailService.sendInternalAlert({
          ...req.body,
          leadScore,
          priority,
          segment,
          followUpActions: followUpActions.actions
        }, leadScore, priority);
      } catch (emailError) {
        console.error('📧 Email notification failed:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Response with sales intelligence
    res.status(201).json({
      success: true,
      message: 'Demo request received successfully',
      leadId: demoRequest.id,
      priority: priority,
      data: {
        leadScore,
        segment,
        urgency,
        followUpActions: followUpActions.actions,
        followUpDeadline: followUpActions.followUpHours + ' hours',
        salesIntelligence: {
          primaryMotivator: currentPain || 'general-interest',
          budgetSegment: segment,
          timeline: timeline || 'not-specified',
          urgencyLevel: urgency,
          contactPreference: phone ? 'phone-and-email' : 'email-only'
        }
      }
    });

  } catch (error) {
    console.error('❌ Demo request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process demo request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/demo-requests
// @desc    Get demo requests with filters
// @access  Admin/Sales
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      urgency,
      priority,
      timeline,
      search
    } = req.query;

    let query = supabase
      .from('demo_requests')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (urgency && urgency !== 'all') {
      query = query.eq('urgency', urgency);
    }
    
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }
    
    if (timeline && timeline !== 'all') {
      query = query.eq('timeline', timeline);
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
    }

    // Pagination and sorting
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order('priority', { ascending: false }) // High priority first
      .order('lead_score', { ascending: false })
      .order('created_at', { ascending: false });

    const { data: requests, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get demo requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch demo requests'
    });
  }
});

// @route   GET /api/demo-requests/analytics
// @desc    Get simplified analytics
// @access  Admin/Sales
router.get('/analytics', async (req, res) => {
  try {
    // Get overall statistics
    const { data: allRequests } = await supabase
      .from('demo_requests')
      .select('urgency, priority, budget, timeline, status, current_pain, created_at, lead_score');

    const analytics = {
      totalRequests: allRequests?.length || 0,
      urgencyBreakdown: {
        urgent: allRequests?.filter(r => r.urgency === 'urgent').length || 0,
        planned: allRequests?.filter(r => r.urgency === 'planned').length || 0,
        exploring: allRequests?.filter(r => r.urgency === 'exploring').length || 0
      },
      priorityDistribution: {
        high: allRequests?.filter(r => r.priority === 'high').length || 0,
        medium: allRequests?.filter(r => r.priority === 'medium').length || 0,
        low: allRequests?.filter(r => r.priority === 'low').length || 0
      },
      topPainPoints: {},
      budgetSegments: {},
      averageLeadScore: 0,
      conversionRate: 0
    };

    if (allRequests?.length > 0) {
      // Calculate top pain points
      allRequests.forEach(req => {
        if (req.current_pain) {
          analytics.topPainPoints[req.current_pain] = (analytics.topPainPoints[req.current_pain] || 0) + 1;
        }
      });

      // Calculate budget segments
      allRequests.forEach(req => {
        if (req.budget) {
          analytics.budgetSegments[req.budget] = (analytics.budgetSegments[req.budget] || 0) + 1;
        }
      });

      // Calculate average lead score
      const totalScore = allRequests.reduce((sum, req) => sum + (req.lead_score || 0), 0);
      analytics.averageLeadScore = Math.round(totalScore / allRequests.length);

      // Calculate conversion rate
      const convertedCount = allRequests.filter(r => r.status === 'converted').length;
      analytics.conversionRate = Math.round((convertedCount / allRequests.length) * 100);
    }

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

// @route   GET /api/demo-requests/health
// @desc    Health check for simplified demo requests
// @access  Public
router.get('/health', async (req, res) => {
  try {
    // Check if demo_requests table exists and get count
    console.log('🔍 Checking demo_requests table...');
    const { count, error } = await supabase
      .from('demo_requests')
      .select('*', { count: 'exact', head: true });
      
    console.log('🔍 Table check result:', { count, error });

    if (error && error.code === '42P01') {
      return res.status(503).json({
        success: false,
        message: 'Demo requests table not found. Please run migration first.',
        setup_required: true,
        migration_file: 'migrations/003_simplified_demo_requests.sql'
      });
    }

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Simplified demo requests system is healthy',
      table_exists: true,
      total_requests: count || 0,
      version: 'simplified-v2',
      endpoints: [
        'POST /api/demo-requests - Submit demo request',
        'GET /api/demo-requests - List requests with filters',
        'GET /api/demo-requests/analytics - Simplified analytics',
        'GET /api/demo-requests/health - Health check'
      ]
    });

  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

module.exports = router;