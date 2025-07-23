console.log("🛑 tickets.js is LOADING...");

const express = require('express');
const router = express.Router();
const { validationResult, body, query, param } = require('express-validator');
const Ticket = require('../models/Ticket');
const TicketNote = require('../models/TicketNote');
const TicketHistory = require('../models/TicketHistory');
const CallLog = require('../models/CallLog');
const User = require('../models/User');
const { auth, checkPermission } = require('../middleware/auth');

console.log("✅ tickets.js setup complete with authentication");

// ==========================================
// GET /api/tickets/test - Test endpoint (PUBLIC)
// ==========================================
router.get('/test', (req, res) => {
    console.log("🎯 tickets router hit!");
    console.log("   URL:", req.url);
    console.log("   Method:", req.method);
    
    res.json({ 
        success: true, 
        message: 'CallTracker Pro Tickets API working!',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: [
            'Ticket Management',
            'Role-based Access Control',
            'Ticket History & Audit Trail',
            'Notes & Comments',
            'SLA Management',
            'Customer Satisfaction Tracking',
            'Integration with Call Logs',
            'Advanced Search & Filtering'
        ],
        endpoints: [
            'GET /api/tickets (authenticated)',
            'POST /api/tickets (authenticated)',
            'GET /api/tickets/:id (authenticated)',
            'PUT /api/tickets/:id (authenticated)',
            'DELETE /api/tickets/:id (authenticated)',
            'GET /api/tickets/:id/history (authenticated)',
            'GET /api/tickets/:id/notes (authenticated)',
            'POST /api/tickets/:id/notes (authenticated)',
            'GET /api/tickets/stats (authenticated)',
            'GET /api/tickets/my (authenticated)',
            'GET /api/tickets/overdue (authenticated)',
            'POST /api/tickets/bulk-update (authenticated)'
        ]
    });
});

// Validation middleware
const validateTicketCreation = [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be between 1-200 characters'),
    body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required and must be between 1-2000 characters'),
    body('customerName').trim().isLength({ min: 1, max: 100 }).withMessage('Customer name is required'),
    body('customerPhone').trim().isLength({ min: 10 }).withMessage('Customer phone is required and must be at least 10 digits'),
    body('customerEmail').optional().isEmail().withMessage('Customer email must be valid'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent', 'critical']).withMessage('Invalid priority'),
    body('category').optional().isIn(['technical_support', 'billing', 'feature_request', 'bug_report', 'account_issue', 'sales_inquiry', 'complaint', 'general_inquiry', 'other']).withMessage('Invalid category'),
    body('assignedTo').optional().isMongoId().withMessage('Invalid assigned user ID'),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
    body('callLogIds').optional().isArray().withMessage('Call log IDs must be an array'),
    body('tags').optional().isArray().withMessage('Tags must be an array')
];

const validateTicketUpdate = [
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1-200 characters'),
    body('description').optional().trim().isLength({ min: 1, max: 2000 }).withMessage('Description must be between 1-2000 characters'),
    body('status').optional().isIn(['open', 'in_progress', 'pending_customer', 'resolved', 'closed', 'cancelled']).withMessage('Invalid status'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent', 'critical']).withMessage('Invalid priority'),
    body('category').optional().isIn(['technical_support', 'billing', 'feature_request', 'bug_report', 'account_issue', 'sales_inquiry', 'complaint', 'general_inquiry', 'other']).withMessage('Invalid category'),
    body('assignedTo').optional().isMongoId().withMessage('Invalid assigned user ID'),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
    body('tags').optional().isArray().withMessage('Tags must be an array')
];

const validateNoteCreation = [
    body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Note content is required and must be between 1-5000 characters'),
    body('type').optional().isIn(['note', 'status_update', 'resolution', 'escalation', 'customer_communication', 'internal_memo']).withMessage('Invalid note type'),
    body('isInternal').optional().isBoolean().withMessage('isInternal must be boolean'),
    body('requiresFollowUp').optional().isBoolean().withMessage('requiresFollowUp must be boolean'),
    body('followUpDate').optional().isISO8601().withMessage('Follow up date must be valid'),
    body('timeSpent').optional().isNumeric().withMessage('Time spent must be numeric')
];

// ==========================================
// GET /api/tickets - Get tickets with filtering
// ==========================================
router.get('/', auth, async (req, res) => {
    try {
        const user = req.user;
        const userScope = user.getAccessScope();
        
        // Build query based on user permissions and filters
        let query = { organizationId: user.organizationId, isArchived: false };
        
        // Apply role-based filtering
        if (!userScope.canViewAll) {
            if (userScope.canViewTeam) {
                query.$or = [
                    { assignedTo: user._id },
                    { createdBy: user._id },
                    { teamId: { $in: userScope.teamIds } }
                ];
            } else {
                query.$or = [
                    { assignedTo: user._id },
                    { createdBy: user._id }
                ];
            }
        }
        
        // Apply filters from query parameters
        const { status, priority, category, assignedTo, createdBy, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        
        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (category) query.category = category;
        if (assignedTo) query.assignedTo = assignedTo;
        if (createdBy) query.createdBy = createdBy;
        
        // Search functionality
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { ticketNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Pagination
        const skip = (page - 1) * limit;
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        const tickets = await Ticket.find(query)
            .populate('assignedTo', 'firstName lastName email role')
            .populate('createdBy', 'firstName lastName email role')
            .populate('customerId', 'name phone email')
            .populate('teamId', 'name')
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Ticket.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                tickets,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tickets',
            error: error.message
        });
    }
});

// ==========================================
// POST /api/tickets - Create new ticket
// ==========================================
router.post('/', auth, validateTicketCreation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }
        
        const user = req.user;
        const ticketData = {
            ...req.body,
            organizationId: user.organizationId,
            createdBy: user._id,
            teamId: user.teamId || req.body.teamId
        };
        
        // Set default assignee to creator if not specified
        if (!ticketData.assignedTo) {
            ticketData.assignedTo = user._id;
        }
        
        const ticket = await Ticket.create(ticketData);
        
        // Create history entry
        await TicketHistory.createEntry(ticket._id, 'created', user);
        
        // Update assignee stats if different from creator
        if (ticket.assignedTo.toString() !== user._id.toString()) {
            const assignee = await User.findById(ticket.assignedTo);
            if (assignee) {
                await assignee.incrementTicketStat('totalAssigned');
                await assignee.incrementTicketStat('currentActiveTickets');
            }
        } else {
            await user.incrementTicketStat('totalAssigned');
            await user.incrementTicketStat('currentActiveTickets');
        }
        
        // Populate response
        const populatedTicket = await Ticket.findById(ticket._id)
            .populate('assignedTo', 'firstName lastName email role')
            .populate('createdBy', 'firstName lastName email role')
            .populate('customerId', 'name phone email');
        
        res.status(201).json({
            success: true,
            message: 'Ticket created successfully',
            data: { ticket: populatedTicket }
        });
        
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create ticket',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/tickets/:id - Get single ticket
// ==========================================
router.get('/:id', auth, param('id').isMongoId(), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ticket ID',
                errors: errors.array()
            });
        }
        
        const user = req.user;
        const userScope = user.getAccessScope();
        
        let query = { _id: req.params.id, organizationId: user.organizationId };
        
        // Apply role-based filtering
        if (!userScope.canViewAll) {
            if (userScope.canViewTeam) {
                query.$or = [
                    { assignedTo: user._id },
                    { createdBy: user._id },
                    { teamId: { $in: userScope.teamIds } }
                ];
            } else {
                query.$or = [
                    { assignedTo: user._id },
                    { createdBy: user._id }
                ];
            }
        }
        
        const ticket = await Ticket.findOne(query)
            .populate('assignedTo', 'firstName lastName email role avatar')
            .populate('createdBy', 'firstName lastName email role avatar')
            .populate('customerId', 'name phone email')
            .populate('teamId', 'name')
            .populate('callLogIds', 'phoneNumber contactName duration callType timestamp');
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found or access denied'
            });
        }
        
        res.json({
            success: true,
            data: { ticket }
        });
        
    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket',
            error: error.message
        });
    }
});

// ==========================================
// PUT /api/tickets/:id - Update ticket
// ==========================================
router.put('/:id', auth, param('id').isMongoId(), validateTicketUpdate, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }
        
        const user = req.user;
        const userScope = user.getAccessScope();
        const updateData = req.body;
        
        // Find existing ticket with permission check
        let query = { _id: req.params.id, organizationId: user.organizationId };
        
        if (!userScope.canViewAll) {
            if (userScope.canViewTeam) {
                query.$or = [
                    { assignedTo: user._id },
                    { createdBy: user._id },
                    { teamId: { $in: userScope.teamIds } }
                ];
            } else {
                query.$or = [
                    { assignedTo: user._id },
                    { createdBy: user._id }
                ];
            }
        }
        
        const existingTicket = await Ticket.findOne(query);
        if (!existingTicket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found or access denied'
            });
        }
        
        // Track changes for history
        const changes = [];
        for (const [key, newValue] of Object.entries(updateData)) {
            const oldValue = existingTicket[key];
            if (oldValue !== newValue) {
                changes.push({
                    fieldName: key,
                    oldValue: oldValue,
                    newValue: newValue
                });
            }
        }
        
        // Update ticket
        const updatedTicket = await Ticket.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('assignedTo', 'firstName lastName email role')
         .populate('createdBy', 'firstName lastName email role')
         .populate('customerId', 'name phone email');
        
        // Create history entries for changes
        for (const change of changes) {
            await TicketHistory.createEntry(
                updatedTicket._id,
                change.fieldName === 'status' ? 'status_changed' : 'updated',
                user,
                change
            );
        }
        
        // Update user stats based on changes
        if (updateData.status) {
            const assignee = await User.findById(updatedTicket.assignedTo);
            if (assignee) {
                if (updateData.status === 'resolved') {
                    await assignee.incrementTicketStat('totalResolved');
                    await assignee.decrementTicketStat('currentActiveTickets');
                    
                    // Calculate resolution time
                    const resolutionTime = (Date.now() - updatedTicket.createdAt) / (1000 * 60 * 60); // hours
                    await assignee.updateResolutionTime(resolutionTime);
                } else if (updateData.status === 'closed') {
                    await assignee.incrementTicketStat('totalClosed');
                    if (existingTicket.status !== 'resolved') {
                        await assignee.decrementTicketStat('currentActiveTickets');
                    }
                }
            }
        }
        
        res.json({
            success: true,
            message: 'Ticket updated successfully',
            data: { ticket: updatedTicket }
        });
        
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update ticket',
            error: error.message
        });
    }
});

// ==========================================
// DELETE /api/tickets/:id - Delete/Archive ticket
// ==========================================
router.delete('/:id', auth, checkPermission('manage_leads'), param('id').isMongoId(), async (req, res) => {
    try {
        const user = req.user;
        
        const ticket = await Ticket.findOneAndUpdate(
            { _id: req.params.id, organizationId: user.organizationId },
            { 
                isArchived: true,
                archivedAt: Date.now(),
                archivedBy: user._id
            },
            { new: true }
        );
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found or access denied'
            });
        }
        
        // Create history entry
        await TicketHistory.createEntry(ticket._id, 'archived', user);
        
        res.json({
            success: true,
            message: 'Ticket archived successfully'
        });
        
    } catch (error) {
        console.error('Error archiving ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to archive ticket',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/tickets/:id/history - Get ticket history
// ==========================================
router.get('/:id/history', auth, param('id').isMongoId(), async (req, res) => {
    try {
        const user = req.user;
        
        // Verify access to ticket
        const ticket = await Ticket.findOne({
            _id: req.params.id,
            organizationId: user.organizationId
        });
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found or access denied'
            });
        }
        
        const history = await TicketHistory.findByTicket(req.params.id);
        
        res.json({
            success: true,
            data: { history }
        });
        
    } catch (error) {
        console.error('Error fetching ticket history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket history',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/tickets/:id/notes - Get ticket notes
// ==========================================
router.get('/:id/notes', auth, param('id').isMongoId(), async (req, res) => {
    try {
        const user = req.user;
        const { includeInternal = 'false' } = req.query;
        
        // Verify access to ticket
        const ticket = await Ticket.findOne({
            _id: req.params.id,
            organizationId: user.organizationId
        });
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found or access denied'
            });
        }
        
        const notes = await TicketNote.findByTicket(
            req.params.id,
            includeInternal === 'true'
        );
        
        res.json({
            success: true,
            data: { notes }
        });
        
    } catch (error) {
        console.error('Error fetching ticket notes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket notes',
            error: error.message
        });
    }
});

// ==========================================
// POST /api/tickets/:id/notes - Add note to ticket
// ==========================================
router.post('/:id/notes', auth, param('id').isMongoId(), validateNoteCreation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }
        
        const user = req.user;
        
        // Verify access to ticket
        const ticket = await Ticket.findOne({
            _id: req.params.id,
            organizationId: user.organizationId
        });
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found or access denied'
            });
        }
        
        const noteData = {
            ...req.body,
            ticketId: req.params.id,
            authorId: user._id,
            authorName: user.fullName,
            authorRole: user.role,
            organizationId: user.organizationId,
            teamId: user.teamId
        };
        
        const note = await TicketNote.create(noteData);
        
        // Create history entry
        await TicketHistory.createEntry(ticket._id, 'note_added', user, {
            relatedEntityType: 'TicketNote',
            relatedEntityId: note._id
        });
        
        // Update first response time if this is the first response
        if (!ticket.firstResponseTime && ticket.assignedTo.toString() === user._id.toString()) {
            const responseTime = (Date.now() - ticket.createdAt) / (1000 * 60); // minutes
            await Ticket.findByIdAndUpdate(ticket._id, {
                firstResponseTime: Date.now()
            });
            
            const assignee = await User.findById(user._id);
            await assignee.updateFirstResponseTime(responseTime);
        }
        
        const populatedNote = await TicketNote.findById(note._id)
            .populate('authorId', 'firstName lastName email role avatar');
        
        res.status(201).json({
            success: true,
            message: 'Note added successfully',
            data: { note: populatedNote }
        });
        
    } catch (error) {
        console.error('Error adding note to ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add note to ticket',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/tickets/stats - Get ticket statistics
// ==========================================
router.get('/stats', auth, checkPermission('view_analytics'), async (req, res) => {
    try {
        const user = req.user;
        const stats = await Ticket.getTicketStats(user.organizationId);
        
        res.json({
            success: true,
            data: { stats: stats[0] || {} }
        });
        
    } catch (error) {
        console.error('Error fetching ticket stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket statistics',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/tickets/my - Get current user's tickets
// ==========================================
router.get('/my', auth, async (req, res) => {
    try {
        const user = req.user;
        const { status } = req.query;
        
        let query = {
            organizationId: user.organizationId,
            assignedTo: user._id,
            isArchived: false
        };
        
        if (status) {
            query.status = status;
        }
        
        const tickets = await Ticket.find(query)
            .populate('customerId', 'name phone email')
            .sort({ priority: -1, createdAt: -1 })
            .limit(50);
        
        res.json({
            success: true,
            data: { tickets }
        });
        
    } catch (error) {
        console.error('Error fetching user tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your tickets',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/tickets/overdue - Get overdue tickets
// ==========================================
router.get('/overdue', auth, async (req, res) => {
    try {
        const user = req.user;
        const userScope = user.getAccessScope();
        
        let query = { organizationId: user.organizationId };
        
        // Apply role-based filtering
        if (!userScope.canViewAll) {
            if (userScope.canViewTeam) {
                query.$or = [
                    { assignedTo: user._id },
                    { teamId: { $in: userScope.teamIds } }
                ];
            } else {
                query.assignedTo = user._id;
            }
        }
        
        const overdueTickets = await Ticket.getOverdueTickets(user.organizationId);
        
        // Filter based on user permissions
        const filteredTickets = overdueTickets.filter(ticket => {
            if (userScope.canViewAll) return true;
            if (userScope.canViewTeam) {
                return ticket.assignedTo._id.toString() === user._id.toString() ||
                       userScope.teamIds.includes(ticket.teamId?._id.toString());
            }
            return ticket.assignedTo._id.toString() === user._id.toString();
        });
        
        res.json({
            success: true,
            data: { tickets: filteredTickets }
        });
        
    } catch (error) {
        console.error('Error fetching overdue tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch overdue tickets',
            error: error.message
        });
    }
});

module.exports = router;