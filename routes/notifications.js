console.log("🛑 notifications.js is LOADING...");

const express = require('express');
const router = express.Router();
const { validationResult, body, query, param } = require('express-validator');
const Ticket = require('../models/Ticket');
const TicketNote = require('../models/TicketNote');
const User = require('../models/User');
const { auth, checkPermission } = require('../middleware/auth');

console.log("✅ notifications.js setup complete with authentication");

// In-memory notification store (in production, use Redis or database)
const notifications = new Map();
const activeConnections = new Map();

// ==========================================
// GET /api/notifications/test - Test endpoint (PUBLIC)
// ==========================================
router.get('/test', (req, res) => {
    console.log("🎯 notifications router hit!");
    console.log("   URL:", req.url);
    console.log("   Method:", req.method);
    
    res.json({ 
        success: true, 
        message: 'CallTracker Pro Notifications API working!',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: [
            'Real-time Notifications',
            'Ticket Status Updates',
            'Assignment Notifications',
            'Due Date Reminders',
            'SLA Breach Alerts',
            'Customer Communication Updates',
            'Performance Alerts',
            'System Notifications'
        ],
        endpoints: [
            'GET /api/notifications (authenticated)',
            'GET /api/notifications/unread (authenticated)',
            'PUT /api/notifications/:id/read (authenticated)',
            'PUT /api/notifications/mark-all-read (authenticated)',
            'DELETE /api/notifications/:id (authenticated)',
            'GET /api/notifications/stats (authenticated)',
            'GET /api/notifications/stream (Server-Sent Events)',
            'POST /api/notifications/test-notification (admin only)'
        ]
    });
});

// Notification types
const NOTIFICATION_TYPES = {
    TICKET_ASSIGNED: 'ticket_assigned',
    TICKET_STATUS_CHANGED: 'ticket_status_changed',
    TICKET_ESCALATED: 'ticket_escalated',
    TICKET_DUE_SOON: 'ticket_due_soon',
    TICKET_OVERDUE: 'ticket_overdue',
    SLA_BREACH: 'sla_breach',
    NEW_NOTE_ADDED: 'new_note_added',
    MENTION_IN_NOTE: 'mention_in_note',
    CUSTOMER_SATISFACTION: 'customer_satisfaction',
    PERFORMANCE_ALERT: 'performance_alert',
    SYSTEM_ANNOUNCEMENT: 'system_announcement'
};

// Notification priorities
const NOTIFICATION_PRIORITIES = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
};

// ==========================================
// Helper Functions
// ==========================================

/**
 * Create a notification
 */
function createNotification(userId, type, title, message, data = {}, priority = NOTIFICATION_PRIORITIES.MEDIUM) {
    const notification = {
        id: generateNotificationId(),
        userId: userId.toString(),
        type,
        title,
        message,
        data,
        priority,
        isRead: false,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days
    };
    
    // Store notification
    if (!notifications.has(userId.toString())) {
        notifications.set(userId.toString(), []);
    }
    
    const userNotifications = notifications.get(userId.toString());
    userNotifications.unshift(notification);
    
    // Keep only latest 100 notifications per user
    if (userNotifications.length > 100) {
        userNotifications.splice(100);
    }
    
    // Send real-time notification if user is connected
    sendRealTimeNotification(userId.toString(), notification);
    
    return notification;
}

/**
 * Generate unique notification ID
 */
function generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Send real-time notification via Server-Sent Events
 */
function sendRealTimeNotification(userId, notification) {
    const connection = activeConnections.get(userId);
    if (connection && !connection.closed) {
        try {
            connection.write(`data: ${JSON.stringify({
                type: 'notification',
                data: notification
            })}\n\n`);
        } catch (error) {
            console.error('Error sending real-time notification:', error);
            activeConnections.delete(userId);
        }
    }
}

/**
 * Get user's notifications
 */
function getUserNotifications(userId, onlyUnread = false) {
    const userNotifications = notifications.get(userId.toString()) || [];
    
    if (onlyUnread) {
        return userNotifications.filter(notif => !notif.isRead);
    }
    
    return userNotifications;
}

/**
 * Mark notification as read
 */
function markNotificationAsRead(userId, notificationId) {
    const userNotifications = notifications.get(userId.toString()) || [];
    const notification = userNotifications.find(notif => notif.id === notificationId);
    
    if (notification) {
        notification.isRead = true;
        notification.readAt = new Date();
        return true;
    }
    
    return false;
}

// ==========================================
// Notification Trigger Functions
// ==========================================

/**
 * Notify when ticket is assigned
 */
async function notifyTicketAssigned(ticket, assignedTo, assignedBy) {
    if (assignedTo.toString() === assignedBy.toString()) return;
    
    const assignee = await User.findById(assignedTo);
    const assigner = await User.findById(assignedBy);
    
    if (assignee && assigner) {
        createNotification(
            assignedTo,
            NOTIFICATION_TYPES.TICKET_ASSIGNED,
            'New Ticket Assigned',
            `${assigner.fullName} assigned ticket "${ticket.title}" to you`,
            {
                ticketId: ticket._id,
                ticketNumber: ticket.ticketNumber,
                assignedBy: assigner.fullName,
                priority: ticket.priority
            },
            ticket.priority === 'urgent' || ticket.priority === 'critical' 
                ? NOTIFICATION_PRIORITIES.HIGH 
                : NOTIFICATION_PRIORITIES.MEDIUM
        );
    }
}

/**
 * Notify when ticket status changes
 */
async function notifyTicketStatusChanged(ticket, oldStatus, newStatus, changedBy) {
    const users = [];
    
    // Notify assignee if different from who made the change
    if (ticket.assignedTo && ticket.assignedTo.toString() !== changedBy.toString()) {
        users.push(ticket.assignedTo);
    }
    
    // Notify creator if different from assignee and changer
    if (ticket.createdBy && 
        ticket.createdBy.toString() !== changedBy.toString() &&
        ticket.createdBy.toString() !== ticket.assignedTo?.toString()) {
        users.push(ticket.createdBy);
    }
    
    const changer = await User.findById(changedBy);
    
    for (const userId of users) {
        createNotification(
            userId,
            NOTIFICATION_TYPES.TICKET_STATUS_CHANGED,
            'Ticket Status Updated',
            `${changer.fullName} changed ticket "${ticket.title}" status from ${oldStatus} to ${newStatus}`,
            {
                ticketId: ticket._id,
                ticketNumber: ticket.ticketNumber,
                oldStatus,
                newStatus,
                changedBy: changer.fullName
            },
            newStatus === 'resolved' || newStatus === 'closed' 
                ? NOTIFICATION_PRIORITIES.MEDIUM 
                : NOTIFICATION_PRIORITIES.LOW
        );
    }
}

/**
 * Notify when ticket is escalated
 */
async function notifyTicketEscalated(ticket, escalatedTo, escalatedBy) {
    const escalator = await User.findById(escalatedBy);
    const escalatee = await User.findById(escalatedTo);
    
    if (escalatee && escalator) {
        createNotification(
            escalatedTo,
            NOTIFICATION_TYPES.TICKET_ESCALATED,
            'Ticket Escalated to You',
            `${escalator.fullName} escalated ticket "${ticket.title}" to you`,
            {
                ticketId: ticket._id,
                ticketNumber: ticket.ticketNumber,
                escalatedBy: escalator.fullName,
                escalationLevel: ticket.escalationLevel
            },
            NOTIFICATION_PRIORITIES.HIGH
        );
    }
}

/**
 * Notify about due tickets
 */
async function notifyTicketDueSoon(ticket) {
    if (!ticket.assignedTo) return;
    
    createNotification(
        ticket.assignedTo,
        NOTIFICATION_TYPES.TICKET_DUE_SOON,
        'Ticket Due Soon',
        `Ticket "${ticket.title}" is due on ${ticket.dueDate.toLocaleDateString()}`,
        {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            dueDate: ticket.dueDate
        },
        NOTIFICATION_PRIORITIES.MEDIUM
    );
}

/**
 * Notify about overdue tickets
 */
async function notifyTicketOverdue(ticket) {
    if (!ticket.assignedTo) return;
    
    createNotification(
        ticket.assignedTo,
        NOTIFICATION_TYPES.TICKET_OVERDUE,
        'Ticket Overdue',
        `Ticket "${ticket.title}" is now overdue!`,
        {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            dueDate: ticket.dueDate
        },
        NOTIFICATION_PRIORITIES.HIGH
    );
}

/**
 * Notify when new note is added
 */
async function notifyNewNoteAdded(note, ticket) {
    const users = [];
    
    // Notify assignee if different from note author
    if (ticket.assignedTo && ticket.assignedTo.toString() !== note.authorId.toString()) {
        users.push(ticket.assignedTo);
    }
    
    // Notify creator if different from assignee and note author
    if (ticket.createdBy && 
        ticket.createdBy.toString() !== note.authorId.toString() &&
        ticket.createdBy.toString() !== ticket.assignedTo?.toString()) {
        users.push(ticket.createdBy);
    }
    
    for (const userId of users) {
        createNotification(
            userId,
            NOTIFICATION_TYPES.NEW_NOTE_ADDED,
            'New Note Added',
            `${note.authorName} added a note to ticket "${ticket.title}"`,
            {
                ticketId: ticket._id,
                ticketNumber: ticket.ticketNumber,
                noteId: note._id,
                authorName: note.authorName
            },
            NOTIFICATION_PRIORITIES.LOW
        );
    }
}

// ==========================================
// API Routes
// ==========================================

/**
 * GET /api/notifications - Get user's notifications
 */
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
        const userId = req.user._id.toString();
        
        let userNotifications = getUserNotifications(userId, unreadOnly === 'true');
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedNotifications = userNotifications.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            data: {
                notifications: paginatedNotifications,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: userNotifications.length,
                    pages: Math.ceil(userNotifications.length / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        });
    }
});

/**
 * GET /api/notifications/unread - Get unread notifications count
 */
router.get('/unread', auth, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const unreadNotifications = getUserNotifications(userId, true);
        
        res.json({
            success: true,
            data: {
                count: unreadNotifications.length,
                notifications: unreadNotifications.slice(0, 5) // Latest 5 unread
            }
        });
        
    } catch (error) {
        console.error('Error fetching unread notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unread notifications',
            error: error.message
        });
    }
});

/**
 * PUT /api/notifications/:id/read - Mark notification as read
 */
router.put('/:id/read', auth, param('id').notEmpty(), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification ID',
                errors: errors.array()
            });
        }
        
        const userId = req.user._id.toString();
        const notificationId = req.params.id;
        
        const marked = markNotificationAsRead(userId, notificationId);
        
        if (!marked) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Notification marked as read'
        });
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
});

/**
 * PUT /api/notifications/mark-all-read - Mark all notifications as read
 */
router.put('/mark-all-read', auth, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const userNotifications = notifications.get(userId) || [];
        
        let markedCount = 0;
        userNotifications.forEach(notif => {
            if (!notif.isRead) {
                notif.isRead = true;
                notif.readAt = new Date();
                markedCount++;
            }
        });
        
        res.json({
            success: true,
            message: `${markedCount} notifications marked as read`
        });
        
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all notifications as read',
            error: error.message
        });
    }
});

/**
 * DELETE /api/notifications/:id - Delete notification
 */
router.delete('/:id', auth, param('id').notEmpty(), async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const notificationId = req.params.id;
        
        const userNotifications = notifications.get(userId) || [];
        const notificationIndex = userNotifications.findIndex(notif => notif.id === notificationId);
        
        if (notificationIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }
        
        userNotifications.splice(notificationIndex, 1);
        
        res.json({
            success: true,
            message: 'Notification deleted'
        });
        
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification',
            error: error.message
        });
    }
});

/**
 * GET /api/notifications/stats - Get notification statistics
 */
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const userNotifications = notifications.get(userId) || [];
        
        const stats = {
            total: userNotifications.length,
            unread: userNotifications.filter(notif => !notif.isRead).length,
            byType: {},
            byPriority: {}
        };
        
        userNotifications.forEach(notif => {
            // Count by type
            stats.byType[notif.type] = (stats.byType[notif.type] || 0) + 1;
            
            // Count by priority
            stats.byPriority[notif.priority] = (stats.byPriority[notif.priority] || 0) + 1;
        });
        
        res.json({
            success: true,
            data: { stats }
        });
        
    } catch (error) {
        console.error('Error fetching notification stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification statistics',
            error: error.message
        });
    }
});

/**
 * GET /api/notifications/stream - Server-Sent Events stream
 */
router.get('/stream', auth, (req, res) => {
    const userId = req.user._id.toString();
    
    // Set headers for Server-Sent Events
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Store connection
    activeConnections.set(userId, res);
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: 'Notification stream connected'
    })}\n\n`);
    
    // Handle client disconnect
    req.on('close', () => {
        activeConnections.delete(userId);
    });
    
    req.on('aborted', () => {
        activeConnections.delete(userId);
    });
});

/**
 * POST /api/notifications/test-notification - Create test notification (admin only)
 */
router.post('/test-notification', auth, checkPermission('manage_system_settings'), async (req, res) => {
    try {
        const { title, message, type = 'system_announcement', priority = 'medium' } = req.body;
        
        const notification = createNotification(
            req.user._id,
            type,
            title || 'Test Notification',
            message || 'This is a test notification',
            { test: true },
            priority
        );
        
        res.json({
            success: true,
            message: 'Test notification created',
            data: { notification }
        });
        
    } catch (error) {
        console.error('Error creating test notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test notification',
            error: error.message
        });
    }
});

// ==========================================
// Background Tasks
// ==========================================

/**
 * Check for due and overdue tickets (run periodically)
 */
async function checkDueTickets() {
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
        
        // Find tickets due in next 24 hours
        const dueSoonTickets = await Ticket.find({
            dueDate: { $gte: now, $lte: tomorrow },
            status: { $nin: ['resolved', 'closed'] },
            isArchived: false
        });
        
        for (const ticket of dueSoonTickets) {
            await notifyTicketDueSoon(ticket);
        }
        
        // Find overdue tickets
        const overdueTickets = await Ticket.find({
            dueDate: { $lt: now },
            status: { $nin: ['resolved', 'closed'] },
            isArchived: false
        });
        
        for (const ticket of overdueTickets) {
            await notifyTicketOverdue(ticket);
        }
        
        console.log(`Checked ${dueSoonTickets.length} due soon and ${overdueTickets.length} overdue tickets`);
        
    } catch (error) {
        console.error('Error checking due tickets:', error);
    }
}

// Run due ticket check every hour
setInterval(checkDueTickets, 60 * 60 * 1000);

// Export notification functions for use in other modules
module.exports = router;
module.exports.notificationHelpers = {
    createNotification,
    notifyTicketAssigned,
    notifyTicketStatusChanged,
    notifyTicketEscalated,
    notifyTicketDueSoon,
    notifyTicketOverdue,
    notifyNewNoteAdded,
    NOTIFICATION_TYPES,
    NOTIFICATION_PRIORITIES
};