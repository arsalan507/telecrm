// routes/demoRequests.js - Demo Requests with Psychological Profiling
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

// Lead scoring algorithm based on psychological profiling
const calculateLeadScore = (data) => {
  let score = 0;
  
  // Trigger Event Urgency (0-40 points)
  const triggerUrgency = {
    'roi-questioned': 40,
    'lost-deal': 35,
    'competitor-stealing': 30,
    'wasted-ads': 25,
    'lead-quality': 20,
    'scaling-chaos': 15,
    'exploring': 5
  };
  score += triggerUrgency[data.triggerEvent] || 0;
  
  // Cost of Inaction Weight (0-30 points)
  const inactionWeight = {
    'client-relationships': 30,
    'missed-revenue': 25,
    'reputation': 20,
    'competitive-advantage': 15,
    'wasted-spend': 10,
    'hard-to-quantify': 5
  };
  score += inactionWeight[data.costOfInaction] || 0;
  
  // Current Tracking Sophistication (0-15 points)
  const trackingComplexity = data.currentTrackingMethod?.length || 0;
  if (trackingComplexity >= 4) score += 15;
  else if (trackingComplexity >= 2) score += 10;
  else score += 5;
  
  // Victory Priorities Clarity (0-10 points)
  const priorityCount = data.victoryPriorities?.length || 0;
  if (priorityCount >= 3) score += 10;
  else if (priorityCount >= 2) score += 7;
  else score += 3;
  
  // Decision Style Confidence (0-5 points)
  const decisionConfidence = Math.abs(50 - (data.decisionStyle || 50));
  score += Math.round(decisionConfidence / 10);
  
  return Math.min(score, 100); // Cap at 100
};

// Determine intent level based on score and psychological indicators
const determineIntentLevel = (score, data) => {
  // Urgent indicators
  const urgentTriggers = ['roi-questioned', 'lost-deal', 'competitor-stealing'];
  const urgentCosts = ['client-relationships', 'missed-revenue', 'reputation'];
  const urgentStakeholders = data.stakeholders?.includes('External clients') || 
                            data.stakeholders?.includes("I'll be presenting to skeptics");
  
  if (score >= 80 || (urgentTriggers.includes(data.triggerEvent) && urgentCosts.includes(data.costOfInaction))) {
    return 'urgent';
  } else if (score >= 60 || urgentStakeholders) {
    return 'high';
  } else if (score >= 40) {
    return 'medium';
  } else {
    return 'low';
  }
};

// Generate personalized email content based on psychological profile
const generateEmailContent = (data, leadScore, intentLevel) => {
  const triggerMessages = {
    'roi-questioned': 'We understand the pressure of proving ROI on your marketing spend.',
    'lost-deal': 'Losing deals due to attribution gaps is frustrating - let\'s fix that.',
    'competitor-stealing': 'Stay ahead of competitors with better call tracking intelligence.',
    'wasted-ads': 'Stop wasting ad spend on sources that don\'t convert.',
    'lead-quality': 'Get crystal clear visibility into your highest-quality lead sources.',
    'scaling-chaos': 'Scale your marketing with organized, automated call tracking.',
    'exploring': 'Great timing to explore how call tracking can transform your business.'
  };

  const personalWinMessages = {
    'prove-strategic': 'We\'ll help you demonstrate the strategic value of proper attribution.',
    'confidence': 'Gain the confidence that comes from having complete marketing visibility.',
    'recognition': 'Position yourself as the data-driven marketing hero your team needs.',
    'push-back': 'Arm yourself with bulletproof data to handle any attribution questions.',
    'hero': 'Become the person who finally solved your company\'s attribution mystery.',
    'sleep-better': 'Sleep soundly knowing exactly which marketing efforts are working.'
  };

  return {
    subject: intentLevel === 'urgent' ? 
      '🚨 Urgent: Your CallTracker Pro Demo is Confirmed' :
      '✅ Your CallTracker Pro Demo is Confirmed',
    greeting: triggerMessages[data.triggerEvent] || 'Thanks for your interest in CallTracker Pro!',
    personalNote: personalWinMessages[data.personalWin] || 'We\'re excited to show you how CallTracker Pro can help.',
    urgencyNote: intentLevel === 'urgent' ? 
      'Given the urgency of your situation, we\'ve prioritized your demo request.' : null
  };
};

// @route   POST /api/demo-requests
// @desc    Handle psychologically-profiled demo booking requests
// @access  Public
router.post('/', async (req, res) => {
  try {
    console.log('📋 Demo request received:', req.body);
    
    const {
      // Step 1: The Moment of Truth
      triggerEvent,
      costOfInaction,
      
      // Step 2: The Attribution Detective
      currentTrackingMethod,
      magicWandInsight,
      mustHaveIntegrations,
      
      // Step 3: The Success Scenario
      victoryPriorities,
      decisionStyle,
      
      // Step 4: The Connection
      stakeholders,
      personalWin,
      name,
      email,
      bestDemoTime,
      preferredDemoLength
    } = req.body;

    // Validation
    if (!name || !email || !triggerEvent || !costOfInaction) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, email, triggerEvent, costOfInaction'
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

    // Calculate lead intelligence
    const urgencyScore = calculateLeadScore(req.body);
    const intentLevel = determineIntentLevel(urgencyScore, req.body);
    
    console.log('🧠 Psychological analysis:', { urgencyScore, intentLevel });

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
        trigger_event: triggerEvent,
        cost_of_inaction: costOfInaction,
        current_tracking_method: currentTrackingMethod || [],
        magic_wand_insight: magicWandInsight?.trim(),
        must_have_integrations: mustHaveIntegrations || [],
        victory_priorities: victoryPriorities || [],
        decision_style: decisionStyle,
        stakeholders: stakeholders || [],
        personal_win: personalWin,
        best_demo_time: bestDemoTime,
        preferred_demo_length: preferredDemoLength,
        urgency_score: urgencyScore,
        intent_level: intentLevel,
        lead_source: 'demo-form',
        status: 'new',
        ...metadata
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    console.log('✅ Demo request created:', demoRequest.id);

    // Generate personalized email content
    const emailContent = generateEmailContent(req.body, urgencyScore, intentLevel);
    
    // Send confirmation email if available
    if (emailService) {
      try {
        await emailService.sendDemoConfirmation(email, emailContent, req.body);
        
        // Send internal sales alert for high-intent leads
        if (intentLevel === 'urgent' || intentLevel === 'high') {
          await emailService.sendInternalAlert(req.body, urgencyScore, intentLevel);
        }
      } catch (emailError) {
        console.error('📧 Email sending failed:', emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.log('📧 Email service not available - skipping email notifications');
    }

    // Response with psychological insights for sales team
    res.status(201).json({
      success: true,
      message: 'Demo request submitted successfully! Check your email for confirmation.',
      data: {
        id: demoRequest.id,
        urgencyScore,
        intentLevel,
        emailContent: emailContent.subject,
        salesIntelligence: {
          keyMotivator: req.body.triggerEvent,
          riskFactor: req.body.costOfInaction,
          decisionStyle: req.body.decisionStyle,
          personalWin: req.body.personalWin,
          stakeholderComplexity: req.body.stakeholders?.length || 0
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
// @desc    Get demo requests (admin/sales access)
// @access  Admin/Sales
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      intentLevel,
      search
    } = req.query;

    let query = supabase
      .from('demo_requests')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (intentLevel && intentLevel !== 'all') {
      query = query.eq('intent_level', intentLevel);
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Pagination and sorting
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order('urgency_score', { ascending: false })
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
// @desc    Get demo request analytics and insights
// @access  Admin/Sales
router.get('/analytics', async (req, res) => {
  try {
    // Get overall statistics
    const { data: allRequests } = await supabase
      .from('demo_requests')
      .select('trigger_event, intent_level, urgency_score, status, created_at');

    const analytics = {
      totalRequests: allRequests?.length || 0,
      intentLevels: {
        urgent: allRequests?.filter(r => r.intent_level === 'urgent').length || 0,
        high: allRequests?.filter(r => r.intent_level === 'high').length || 0,
        medium: allRequests?.filter(r => r.intent_level === 'medium').length || 0,
        low: allRequests?.filter(r => r.intent_level === 'low').length || 0
      },
      topTriggers: {},
      averageUrgencyScore: 0,
      conversionRate: 0
    };

    if (allRequests?.length > 0) {
      // Calculate top triggers
      allRequests.forEach(req => {
        analytics.topTriggers[req.trigger_event] = (analytics.topTriggers[req.trigger_event] || 0) + 1;
      });

      // Calculate average urgency score
      const totalScore = allRequests.reduce((sum, req) => sum + (req.urgency_score || 0), 0);
      analytics.averageUrgencyScore = Math.round(totalScore / allRequests.length);

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
// @desc    Health check for demo requests system
// @access  Public
router.get('/health', async (req, res) => {
  try {
    // Check if demo_requests table exists
    const { data, error } = await supabase
      .from('demo_requests')
      .select('count', { count: 'exact', head: true });

    if (error && error.code === '42P01') {
      return res.status(503).json({
        success: false,
        message: 'Demo requests table not found. Please run migration first.',
        setup_required: true,
        migration_file: 'migrations/002_demo_requests.sql'
      });
    }

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Demo requests system is healthy',
      table_exists: true,
      total_requests: data || 0,
      endpoints: [
        'POST /api/demo-requests - Submit demo request',
        'GET /api/demo-requests - List requests',
        'GET /api/demo-requests/analytics - Analytics',
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