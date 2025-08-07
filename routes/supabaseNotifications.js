// routes/supabaseNotifications.js - Notifications with Supabase
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SupabaseUser = require('../models/SupabaseUser');

// Explicit CORS middleware
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

// Simple authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await SupabaseUser.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Notifications auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

// @route   GET /api/notifications/unread
// @desc    Get unread notifications
// @access  Private
router.get('/unread', authenticate, async (req, res) => {
  try {
    console.log('📨 Getting unread notifications for user:', req.user.email);
    
    // For now, return mock data since we don't have a notifications table yet
    const mockNotifications = [
      {
        id: '1',
        title: 'Welcome to CallTracker Pro!',
        message: 'Your account has been successfully created.',
        type: 'info',
        read: false,
        createdAt: new Date().toISOString(),
        organizationId: req.user.organization_id
      },
      {
        id: '2', 
        title: 'New Demo Request',
        message: 'A new demo request has been submitted.',
        type: 'notification',
        read: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        organizationId: req.user.organization_id
      }
    ];

    console.log('✅ Returning mock notifications:', mockNotifications.length);

    res.json({
      success: true,
      data: mockNotifications,
      count: mockNotifications.length
    });
  } catch (error) {
    console.error('❌ Get unread notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving notifications'
    });
  }
});

// @route   GET /api/notifications
// @desc    Get all notifications with pagination
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    console.log('📨 Getting all notifications for user:', req.user.email);
    
    const { page = 1, limit = 20 } = req.query;
    
    // Mock data for now
    const mockNotifications = [
      {
        id: '1',
        title: 'Welcome to CallTracker Pro!',
        message: 'Your account has been successfully created.',
        type: 'info',
        read: true,
        createdAt: new Date().toISOString(),
        organizationId: req.user.organization_id
      },
      {
        id: '2',
        title: 'New Demo Request', 
        message: 'A new demo request has been submitted.',
        type: 'notification',
        read: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        organizationId: req.user.organization_id
      },
      {
        id: '3',
        title: 'System Update',
        message: 'CallTracker Pro has been updated with new features.',
        type: 'system',
        read: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        organizationId: req.user.organization_id
      }
    ];

    res.json({
      success: true,
      data: mockNotifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: 1,
        totalNotifications: mockNotifications.length,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving notifications'
    });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📖 Marking notification as read:', id);
    
    // Mock response - in real implementation, update the database
    res.json({
      success: true,
      message: 'Notification marked as read',
      data: {
        id: id,
        read: true,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification'
    });
  }
});

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private
router.put('/mark-all-read', authenticate, async (req, res) => {
  try {
    console.log('📖 Marking all notifications as read for user:', req.user.email);
    
    // Mock response - in real implementation, update the database
    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        updatedCount: 2,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notifications'
    });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Supabase Notifications API working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;