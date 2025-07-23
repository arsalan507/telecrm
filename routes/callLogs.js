console.log("🛑 callLogs.js is LOADING...");

const express = require('express');
const router = express.Router();
const { validationResult, body, param } = require('express-validator');
const CallLog = require('../models/CallLog');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { auth, checkCallLimit, checkPermission, optionalAuth } = require('../middleware/auth');

console.log("✅ callLogs.js setup complete with authentication");

// ==========================================
// GET /api/call-logs/test - Test endpoint (PUBLIC)
// ==========================================
router.get('/test', (req, res) => {
    console.log("🎯 callLogs router hit!");
    console.log("   URL:", req.url);
    console.log("   Method:", req.method);
    
    console.log("✅ /test route handler executed!");
    res.json({ 
        success: true, 
        message: 'CallTracker Pro Call Logs API working!',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        features: [
            'User Authentication',
            'Organization Isolation', 
            'Call Limits Enforcement',
            'Role-based Access Control',
            'Real-time Analytics',
            'Bulk Import/Export',
            'Advanced Search',
            'Ticket Integration',
            'Auto-Ticket Creation'
        ],
        endpoints: [
            'GET /api/call-logs/test (public)',
            'POST /api/call-logs (authenticated, call limit)',
            'GET /api/call-logs (authenticated)',
            'GET /api/call-logs/:id (authenticated)',
            'PUT /api/call-logs/:id (authenticated)',
            'DELETE /api/call-logs/:id (authenticated, requires manage_leads)',
            'GET /api/call-logs/analytics/stats (authenticated, requires view_analytics)',
            'GET /api/call-logs/my/summary (authenticated)',
            'GET /api/call-logs/recent (authenticated)',
            'GET /api/call-logs/search (authenticated)',
            'GET /api/call-logs/export (authenticated, requires view_analytics)',
            'POST /api/call-logs/bulk (authenticated, requires manage_leads)',
            'POST /api/call-logs/:id/create-ticket (authenticated)',
            'PUT /api/call-logs/:id/link-ticket (authenticated)',
            'DELETE /api/call-logs/:id/unlink-ticket (authenticated)',
            'GET /api/call-logs/without-tickets (authenticated)',
            'GET /api/call-logs/ticket-stats (authenticated, requires view_analytics)'
        ]
    });
});

// ==========================================
// GET /api/call-logs/analytics/stats - Analytics (REQUIRES PERMISSION)
// ==========================================
router.get('/analytics/stats', auth, checkPermission('view_analytics'), async (req, res) => {
    console.log("📊 GET /api/call-logs/analytics/stats - Fetching analytics");
    console.log("👤 User:", req.user.userId, "Organization:", req.user.organizationId);
    
    try {
        const { days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Build filter based on user permissions
        let matchFilter = {
            timestamp: { $gte: startDate, $lte: new Date() }
        };
        
        if (!req.user.permissions.includes('view_all_calls')) {
            matchFilter.userId = req.user.userId;
        } else {
            matchFilter.organizationId = req.user.organizationId;
        }

        // Analytics aggregation
        const analytics = await CallLog.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: null,
                    totalCalls: { $sum: 1 },
                    totalDuration: { $sum: '$duration' },
                    avgDuration: { $avg: '$duration' },
                    incomingCalls: {
                        $sum: { $cond: [{ $eq: ['$callType', 'incoming'] }, 1, 0] }
                    },
                    outgoingCalls: {
                        $sum: { $cond: [{ $eq: ['$callType', 'outgoing'] }, 1, 0] }
                    },
                    missedCalls: {
                        $sum: { $cond: [{ $eq: ['$callType', 'missed'] }, 1, 0] }
                    },
                    successfulCalls: {
                        $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] }
                    }
                }
            }
        ]);

        // Call type breakdown
        const callTypeBreakdown = await CallLog.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: '$callType',
                    count: { $sum: 1 },
                    totalDuration: { $sum: '$duration' },
                    avgDuration: { $avg: '$duration' }
                }
            }
        ]);

        // Daily call trends
        const dailyTrends = await CallLog.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    },
                    calls: { $sum: 1 },
                    duration: { $sum: '$duration' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        // Top contacts by call frequency
        const topContacts = await CallLog.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: { 
                        phoneNumber: '$phoneNumber',
                        contactName: '$contactName'
                    },
                    callCount: { $sum: 1 },
                    totalDuration: { $sum: '$duration' },
                    lastCall: { $max: '$timestamp' }
                }
            },
            { $sort: { callCount: -1 } },
            { $limit: 10 }
        ]);

        const summary = analytics[0] || {
            totalCalls: 0,
            totalDuration: 0,
            avgDuration: 0,
            incomingCalls: 0,
            outgoingCalls: 0,
            missedCalls: 0,
            successfulCalls: 0
        };

        console.log("✅ Analytics calculated successfully");
        console.log("📈 Summary:", summary);

        res.json({
            success: true,
            data: {
                summary,
                callTypeBreakdown,
                dailyTrends,
                topContacts,
                period: `${days} days`,
                scope: req.user.permissions.includes('view_all_calls') ? 'organization' : 'personal',
                generated: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("❌ Error generating analytics:", error);
        res.status(500).json({
            success: false,
            message: 'Error generating analytics',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/call-logs/my/summary - Personal call summary
// ==========================================
router.get('/my/summary', auth, async (req, res) => {
    console.log("👤 GET /api/call-logs/my/summary - Personal call summary");
    
    try {
        const { days = 7 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const summary = await CallLog.aggregate([
            {
                $match: {
                    userId: req.user.userId,
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCalls: { $sum: 1 },
                    totalDuration: { $sum: '$duration' },
                    avgDuration: { $avg: '$duration' },
                    incomingCalls: {
                        $sum: { $cond: [{ $eq: ['$callType', 'incoming'] }, 1, 0] }
                    },
                    outgoingCalls: {
                        $sum: { $cond: [{ $eq: ['$callType', 'outgoing'] }, 1, 0] }
                    },
                    missedCalls: {
                        $sum: { $cond: [{ $eq: ['$callType', 'missed'] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get user's current usage
        const currentUser = await User.findById(req.user.userId);

        // Get recent activity
        const recentCalls = await CallLog.find({
            userId: req.user.userId,
            timestamp: { $gte: startDate }
        })
        .sort({ timestamp: -1 })
        .limit(5)
        .lean();

        res.json({
            success: true,
            data: {
                period: `${days} days`,
                summary: summary[0] || {
                    totalCalls: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    incomingCalls: 0,
                    outgoingCalls: 0,
                    missedCalls: 0
                },
                usage: {
                    callsUsed: currentUser.callsUsed,
                    callLimit: currentUser.callLimit,
                    remainingCalls: currentUser.callLimit - currentUser.callsUsed,
                    usagePercentage: Math.round((currentUser.callsUsed / currentUser.callLimit) * 100)
                },
                recentActivity: recentCalls
            }
        });

    } catch (error) {
        console.error("❌ Error fetching personal summary:", error);
        res.status(500).json({
            success: false,
            message: 'Error fetching personal summary',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/call-logs/recent - Recent call logs
// ==========================================
router.get('/recent', auth, async (req, res) => {
    console.log("🕒 GET /api/call-logs/recent - Recent call logs");
    
    try {
        const { limit = 5 } = req.query;
        
        let filter = {};
        
        // Apply user/org filter
        if (!req.user.permissions.includes('view_all_calls')) {
            filter.userId = req.user.userId;
        } else {
            filter.organizationId = req.user.organizationId;
        }
        
        const recentCalls = await CallLog.find(filter)
            .populate('userId', 'firstName lastName')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();
        
        res.json({
            success: true,
            data: recentCalls,
            count: recentCalls.length
        });
        
    } catch (error) {
        console.error("❌ Error fetching recent calls:", error);
        res.status(500).json({
            success: false,
            message: 'Error fetching recent calls',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/call-logs/search - Search call logs
// ==========================================
router.get('/search', auth, async (req, res) => {
    console.log("🔍 GET /api/call-logs/search - Search call logs");
    
    try {
        const { q, limit = 10 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }
        
        let filter = {
            $or: [
                { phoneNumber: { $regex: q, $options: 'i' } },
                { contactName: { $regex: q, $options: 'i' } },
                { notes: { $regex: q, $options: 'i' } }
            ]
        };
        
        // Apply user/org filter
        if (!req.user.permissions.includes('view_all_calls')) {
            filter.userId = req.user.userId;
        } else {
            filter.organizationId = req.user.organizationId;
        }
        
        const results = await CallLog.find(filter)
            .populate('userId', 'firstName lastName')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();
        
        res.json({
            success: true,
            data: results,
            query: q,
            count: results.length
        });
        
    } catch (error) {
        console.error("❌ Error searching call logs:", error);
        res.status(500).json({
            success: false,
            message: 'Error searching call logs',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/call-logs/export - Export call logs
// ==========================================
router.get('/export', auth, checkPermission('view_analytics'), async (req, res) => {
    console.log("📤 GET /api/call-logs/export - Export call logs");
    
    try {
        const { format = 'json', startDate, endDate } = req.query;
        
        let filter = {};
        
        // Date range filter
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        // Apply user/org filter
        if (!req.user.permissions.includes('view_all_calls')) {
            filter.userId = req.user.userId;
        } else {
            filter.organizationId = req.user.organizationId;
        }
        
        const callLogs = await CallLog.find(filter)
            .populate('userId', 'firstName lastName email')
            .sort({ timestamp: -1 })
            .lean();
        
        if (format === 'csv') {
            // Convert to CSV format
            const csvHeader = 'Date,Phone Number,Contact Name,Call Type,Duration (seconds),Notes,User\n';
            const csvRows = callLogs.map(log => 
                `"${log.timestamp}","${log.phoneNumber}","${log.contactName}","${log.callType}","${log.duration}","${log.notes || ''}","${log.userId?.firstName || ''} ${log.userId?.lastName || ''}"`
            ).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="call-logs.csv"');
            res.send(csvHeader + csvRows);
        } else {
            // JSON format
            res.json({
                success: true,
                data: callLogs,
                exportInfo: {
                    count: callLogs.length,
                    dateRange: { startDate, endDate },
                    exportedAt: new Date().toISOString(),
                    exportedBy: req.user.email
                }
            });
        }
        
    } catch (error) {
        console.error("❌ Error exporting call logs:", error);
        res.status(500).json({
            success: false,
            message: 'Error exporting call logs',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/call-logs/stats/realtime - Real-time stats
// ==========================================
router.get('/stats/realtime', auth, async (req, res) => {
    console.log("⚡ GET /api/call-logs/stats/realtime - Real-time stats");
    
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let filter = { timestamp: { $gte: today } };
        
        // Apply user/org filter
        if (!req.user.permissions.includes('view_all_calls')) {
            filter.userId = req.user.userId;
        } else {
            filter.organizationId = req.user.organizationId;
        }
        
        const todayStats = await CallLog.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalCalls: { $sum: 1 },
                    totalDuration: { $sum: '$duration' },
                    lastCallTime: { $max: '$timestamp' },
                    incomingCalls: {
                        $sum: { $cond: [{ $eq: ['$callType', 'incoming'] }, 1, 0] }
                    },
                    outgoingCalls: {
                        $sum: { $cond: [{ $eq: ['$callType', 'outgoing'] }, 1, 0] }
                    },
                    missedCalls: {
                        $sum: { $cond: [{ $eq: ['$callType', 'missed'] }, 1, 0] }
                    }
                }
            }
        ]);
        
        const stats = todayStats[0] || {
            totalCalls: 0,
            totalDuration: 0,
            lastCallTime: null,
            incomingCalls: 0,
            outgoingCalls: 0,
            missedCalls: 0
        };
        
        res.json({
            success: true,
            data: {
                today: stats,
                timestamp: new Date().toISOString(),
                scope: req.user.permissions.includes('view_all_calls') ? 'organization' : 'personal'
            }
        });
        
    } catch (error) {
        console.error("❌ Error fetching real-time stats:", error);
        res.status(500).json({
            success: false,
            message: 'Error fetching real-time stats',
            error: error.message
        });
    }
});

// ==========================================
// POST /api/call-logs - Create new call log (AUTHENTICATED + CALL LIMIT)
// ==========================================
router.post('/', auth, checkCallLimit, async (req, res) => {
    console.log("📞 POST /api/call-logs - Creating new call log");
    console.log("👤 User:", req.user.userId, req.user.email);
    console.log("🏢 Organization:", req.user.organizationId);
    console.log("📊 Request body:", req.body);
    
    try {
        const {
            phoneNumber,
            contactName,
            duration,
            callType,
            timestamp,
            simSlot,
            deviceInfo,
            tags,
            notes,
            callPurpose,
            callOutcome,
            followUpRequired,
            followUpDate
        } = req.body;

        // Validation
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        if (!duration && duration !== 0) {
            return res.status(400).json({
                success: false,
                message: 'Call duration is required'
            });
        }

        if (!callType || !['incoming', 'outgoing', 'missed'].includes(callType)) {
            return res.status(400).json({
                success: false,
                message: 'Valid call type is required (incoming, outgoing, missed)'
            });
        }

        // Create call log with user and organization info
        const callLog = new CallLog({
            // User & Organization
            userId: req.user.userId,
            organizationId: req.user.organizationId,
            
            // Call Information
            phoneNumber: phoneNumber.trim(),
            contactName: contactName || 'Unknown',
            duration: parseInt(duration),
            callType,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            
            // Additional Information
            notes: notes || '',
            tags: tags || [],
            
            // Business Context
            callPurpose: callPurpose || 'other',
            callOutcome: callOutcome || null,
            
            // Follow-up
            followUpRequired: followUpRequired || false,
            followUpDate: followUpDate ? new Date(followUpDate) : null,
            
            // Device Information
            deviceInfo: typeof deviceInfo === 'string' ? deviceInfo : 'Android Device',
            simCard: simSlot ? `SIM ${simSlot}` : 'SIM 1',
            
            // Set call status based on duration
            callStatus: duration > 0 ? 'answered' : 'missed'
        });

        const savedCallLog = await callLog.save();
        
        // Update user's call count
        await User.findByIdAndUpdate(
            req.user.userId,
            { $inc: { callsUsed: 1 } }
        );
        
        // Populate user info for response
        await savedCallLog.populate('userId', 'firstName lastName email');
        
        console.log("✅ Call log saved successfully:", savedCallLog._id);
        console.log("📈 User call count incremented");
        
        res.status(201).json({
            success: true,
            message: 'Call log created successfully',
            data: savedCallLog
        });

    } catch (error) {
        console.error("❌ Error creating call log:", error);
        res.status(500).json({
            success: false,
            message: 'Error creating call log',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/call-logs - Get call logs (USER/ORG SPECIFIC)
// ==========================================
router.get('/', auth, async (req, res) => {
    console.log("📋 GET /api/call-logs - Fetching call logs");
    console.log("👤 User:", req.user.userId, "Role:", req.user.role);
    console.log("🔑 Permissions:", req.user.permissions);
    
    try {
        const {
            page = 1,
            limit = 20,
            callType,
            phoneNumber,
            startDate,
            endDate,
            sortBy = 'timestamp',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object based on user permissions
        let filter = {};
        
        // If user doesn't have view_all_calls permission, only show their calls
        if (!req.user.permissions.includes('view_all_calls')) {
            filter.userId = req.user.userId;
        } else {
            // Admin/Manager can see all calls in their organization
            filter.organizationId = req.user.organizationId;
        }
        
        // Additional filters
        if (callType) {
            filter.callType = callType;
        }
        
        if (phoneNumber) {
            filter.phoneNumber = { $regex: phoneNumber, $options: 'i' };
        }
        
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        console.log("🔍 Filter applied:", filter);

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [callLogs, totalCount] = await Promise.all([
            CallLog.find(filter)
                   .populate('userId', 'firstName lastName email')
                   .sort(sort)
                   .skip(skip)
                   .limit(parseInt(limit))
                   .lean(),
            CallLog.countDocuments(filter)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        console.log(`✅ Found ${callLogs.length} call logs (${totalCount} total)`);

        res.json({
            success: true,
            data: callLogs,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount,
                hasNextPage,
                hasPrevPage,
                limit: parseInt(limit)
            },
            user: {
                canViewAll: req.user.permissions.includes('view_all_calls'),
                role: req.user.role
            }
        });

    } catch (error) {
        console.error("❌ Error fetching call logs:", error);
        res.status(500).json({
            success: false,
            message: 'Error fetching call logs',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/call-logs/:id - Get single call log (USER/ORG SPECIFIC)
// ==========================================
router.get('/:id', auth, async (req, res) => {
    console.log(`🔍 GET /api/call-logs/${req.params.id} - Fetching single call log`);
    console.log("👤 User:", req.user.userId);
    
    try {
        // Build query based on user permissions
        let query = { _id: req.params.id };
        
        if (!req.user.permissions.includes('view_all_calls')) {
            query.userId = req.user.userId;
        } else {
            query.organizationId = req.user.organizationId;
        }
        
        const callLog = await CallLog.findOne(query)
            .populate('userId', 'firstName lastName email');
        
        if (!callLog) {
            return res.status(404).json({
                success: false,
                message: 'Call log not found or access denied'
            });
        }

        console.log("✅ Call log found:", callLog._id);

        res.json({
            success: true,
            data: callLog
        });

    } catch (error) {
        console.error("❌ Error fetching call log:", error);
        res.status(500).json({
            success: false,
            message: 'Error fetching call log',
            error: error.message
        });
    }
});

// ==========================================
// PUT /api/call-logs/:id - Update call log (USER/ORG SPECIFIC)
// ==========================================
router.put('/:id', auth, async (req, res) => {
    console.log(`✏️ PUT /api/call-logs/${req.params.id} - Updating call log`);
    console.log("👤 User:", req.user.userId);
    
    try {
        const allowedUpdates = [
            'contactName', 'tags', 'notes', 'callPurpose', 'callOutcome',
            'followUpRequired', 'followUpDate', 'callQuality'
        ];
        
        const updates = {};
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        // Build query based on user permissions
        let query = { _id: req.params.id };
        
        if (!req.user.permissions.includes('view_all_calls')) {
            query.userId = req.user.userId;
        } else {
            query.organizationId = req.user.organizationId;
        }

        const callLog = await CallLog.findOneAndUpdate(
            query,
            { $set: { ...updates, updatedAt: new Date() } },
            { new: true, runValidators: true }
        ).populate('userId', 'firstName lastName email');

        if (!callLog) {
            return res.status(404).json({
                success: false,
                message: 'Call log not found or access denied'
            });
        }

        console.log("✅ Call log updated successfully:", callLog._id);

        res.json({
            success: true,
            message: 'Call log updated successfully',
            data: callLog
        });

    } catch (error) {
        console.error("❌ Error updating call log:", error);
        res.status(500).json({
            success: false,
            message: 'Error updating call log',
            error: error.message
        });
    }
});

// ==========================================
// DELETE /api/call-logs/:id - Delete call log (REQUIRES PERMISSION)
// ==========================================
router.delete('/:id', auth, checkPermission('manage_leads'), async (req, res) => {
    console.log(`🗑️ DELETE /api/call-logs/${req.params.id} - Deleting call log`);
    console.log("👤 User:", req.user.userId, "has manage_leads permission");
    
    try {
        // Build query based on user permissions
        let query = { _id: req.params.id };
        
        if (!req.user.permissions.includes('view_all_calls')) {
            query.userId = req.user.userId;
        } else {
            query.organizationId = req.user.organizationId;
        }

        const callLog = await CallLog.findOneAndDelete(query);

        if (!callLog) {
            return res.status(404).json({
                success: false,
                message: 'Call log not found or access denied'
            });
        }

        // Decrease user's call count if it was their call
        if (callLog.userId.toString() === req.user.userId.toString()) {
            await User.findByIdAndUpdate(
                req.user.userId,
                { $inc: { callsUsed: -1 } }
            );
            console.log("📉 User call count decremented");
        }

        console.log("✅ Call log deleted successfully:", callLog._id);

        res.json({
            success: true,
            message: 'Call log deleted successfully'
        });

    } catch (error) {
        console.error("❌ Error deleting call log:", error);
        res.status(500).json({
            success: false,
            message: 'Error deleting call log',
            error: error.message
        });
    }
});

// ==========================================
// POST /api/call-logs/bulk - Bulk import (REQUIRES PERMISSION)
// ==========================================
router.post('/bulk', auth, checkPermission('manage_leads'), async (req, res) => {
    console.log("📦 POST /api/call-logs/bulk - Bulk importing call logs");
    console.log("👤 User:", req.user.userId, "Organization:", req.user.organizationId);
    
    try {
        const { callLogs } = req.body;

        if (!Array.isArray(callLogs) || callLogs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'callLogs array is required and cannot be empty'
            });
        }

        // Check if user has enough call limit
        const currentUser = await User.findById(req.user.userId);
        const remainingCalls = currentUser.callLimit - currentUser.callsUsed;
        
        if (callLogs.length > remainingCalls) {
            return res.status(403).json({
                success: false,
                message: `Bulk import would exceed your call limit. You have ${remainingCalls} calls remaining, but trying to import ${callLogs.length} calls.`,
                data: {
                    callsToImport: callLogs.length,
                    remainingCalls,
                    upgradeRequired: true
                }
            });
        }

        // Validate and prepare each call log
        const validatedLogs = callLogs.map((log, index) => {
            if (!log.phoneNumber || !log.callType || log.duration === undefined) {
                throw new Error(`Invalid call log at index ${index}: missing required fields`);
            }
            return {
                ...log,
                userId: req.user.userId,
                organizationId: req.user.organizationId,
                timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
                contactName: log.contactName || 'Unknown',
                notes: log.notes || '',
                syncStatus: 'synced'
            };
        });

        const savedLogs = await CallLog.insertMany(validatedLogs);

        // Update user's call count
        await User.findByIdAndUpdate(
            req.user.userId,
            { $inc: { callsUsed: savedLogs.length } }
        );

        console.log(`✅ Bulk imported ${savedLogs.length} call logs`);
        console.log(`📈 User call count increased by ${savedLogs.length}`);

        res.status(201).json({
            success: true,
            message: `Successfully imported ${savedLogs.length} call logs`,
            data: {
                importedCount: savedLogs.length,
                firstId: savedLogs[0]._id,
                lastId: savedLogs[savedLogs.length - 1]._id,
                callsUsedAfterImport: currentUser.callsUsed + savedLogs.length,
                callLimit: currentUser.callLimit
            }
        });

    } catch (error) {
        console.error("❌ Error bulk importing call logs:", error);
        res.status(500).json({
            success: false,
            message: 'Error bulk importing call logs',
            error: error.message
        });
    }
});

// ==========================================
// TICKET INTEGRATION ENDPOINTS
// ==========================================

// ==========================================
// POST /api/call-logs/:id/create-ticket - Create ticket from call log
// ==========================================
router.post('/:id/create-ticket', auth, param('id').isMongoId(), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid call log ID',
                errors: errors.array()
            });
        }
        
        const user = req.user;
        const userScope = user.getAccessScope();
        
        // Find call log with permission check
        let query = { _id: req.params.id, organizationId: user.organizationId };
        
        if (!userScope.canViewAll && !userScope.canViewTeam) {
            query.userId = user._id;
        }
        
        const callLog = await CallLog.findOne(query);
        if (!callLog) {
            return res.status(404).json({
                success: false,
                message: 'Call log not found or access denied'
            });
        }
        
        // Check if call already has a ticket
        if (callLog.hasTicket) {
            return res.status(400).json({
                success: false,
                message: 'Call log already has an associated ticket',
                data: { existingTicketId: callLog.ticketId }
            });
        }
        
        // Create ticket from call log
        const ticketData = req.body || {};
        const ticket = await callLog.createTicketFromCall(ticketData);
        
        const populatedTicket = await Ticket.findById(ticket._id)
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email');
        
        console.log(`✅ Created ticket ${ticket.ticketNumber} from call log ${callLog._id}`);
        
        res.status(201).json({
            success: true,
            message: 'Ticket created successfully from call log',
            data: { 
                ticket: populatedTicket,
                callLog: {
                    id: callLog._id,
                    phoneNumber: callLog.phoneNumber,
                    contactName: callLog.contactName,
                    hasTicket: true
                }
            }
        });
        
    } catch (error) {
        console.error('Error creating ticket from call log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create ticket from call log',
            error: error.message
        });
    }
});

// ==========================================
// PUT /api/call-logs/:id/link-ticket - Link call log to existing ticket
// ==========================================
router.put('/:id/link-ticket', auth, [
    param('id').isMongoId(),
    body('ticketId').isMongoId().withMessage('Valid ticket ID is required')
], async (req, res) => {
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
        const { ticketId } = req.body;
        
        // Find call log with permission check
        let callLogQuery = { _id: req.params.id, organizationId: user.organizationId };
        
        if (!userScope.canViewAll && !userScope.canViewTeam) {
            callLogQuery.userId = user._id;
        }
        
        const callLog = await CallLog.findOne(callLogQuery);
        if (!callLog) {
            return res.status(404).json({
                success: false,
                message: 'Call log not found or access denied'
            });
        }
        
        // Find ticket with permission check
        let ticketQuery = { _id: ticketId, organizationId: user.organizationId };
        
        if (!userScope.canViewAll) {
            if (userScope.canViewTeam) {
                ticketQuery.$or = [
                    { assignedTo: user._id },
                    { createdBy: user._id },
                    { teamId: { $in: userScope.teamIds } }
                ];
            } else {
                ticketQuery.$or = [
                    { assignedTo: user._id },
                    { createdBy: user._id }
                ];
            }
        }
        
        const ticket = await Ticket.findOne(ticketQuery);
        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found or access denied'
            });
        }
        
        // Link call log to ticket
        await callLog.linkToTicket(ticketId);
        
        // Add call log to ticket's call log IDs if not already present
        if (!ticket.callLogIds.includes(callLog._id)) {
            ticket.callLogIds.push(callLog._id);
            await ticket.save();
        }
        
        console.log(`✅ Linked call log ${callLog._id} to ticket ${ticket.ticketNumber}`);
        
        res.json({
            success: true,
            message: 'Call log linked to ticket successfully',
            data: {
                callLogId: callLog._id,
                ticketId: ticket._id,
                ticketNumber: ticket.ticketNumber
            }
        });
        
    } catch (error) {
        console.error('Error linking call log to ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to link call log to ticket',
            error: error.message
        });
    }
});

// ==========================================
// DELETE /api/call-logs/:id/unlink-ticket - Unlink call log from ticket
// ==========================================
router.delete('/:id/unlink-ticket', auth, param('id').isMongoId(), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid call log ID',
                errors: errors.array()
            });
        }
        
        const user = req.user;
        const userScope = user.getAccessScope();
        
        // Find call log with permission check
        let query = { _id: req.params.id, organizationId: user.organizationId };
        
        if (!userScope.canViewAll && !userScope.canViewTeam) {
            query.userId = user._id;
        }
        
        const callLog = await CallLog.findOne(query);
        if (!callLog) {
            return res.status(404).json({
                success: false,
                message: 'Call log not found or access denied'
            });
        }
        
        if (!callLog.hasTicket) {
            return res.status(400).json({
                success: false,
                message: 'Call log is not linked to any ticket'
            });
        }
        
        const ticketId = callLog.ticketId;
        
        // Unlink call log from ticket
        await callLog.unlinkFromTicket();
        
        // Remove call log from ticket's call log IDs
        if (ticketId) {
            await Ticket.findByIdAndUpdate(ticketId, {
                $pull: { callLogIds: callLog._id }
            });
        }
        
        console.log(`✅ Unlinked call log ${callLog._id} from ticket ${ticketId}`);
        
        res.json({
            success: true,
            message: 'Call log unlinked from ticket successfully',
            data: {
                callLogId: callLog._id,
                previousTicketId: ticketId
            }
        });
        
    } catch (error) {
        console.error('Error unlinking call log from ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unlink call log from ticket',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/call-logs/without-tickets - Get call logs without tickets
// ==========================================
router.get('/without-tickets', auth, async (req, res) => {
    try {
        const user = req.user;
        const { page = 1, limit = 20, days = 30 } = req.query;
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        
        const dateRange = { start: startDate, end: new Date() };
        
        // Get calls without tickets using the model method
        const callLogs = await CallLog.findCallsWithoutTickets(user.organizationId, dateRange);
        
        // Apply user permission filtering if needed
        const userScope = user.getAccessScope();
        let filteredCallLogs = callLogs;
        
        if (!userScope.canViewAll) {
            if (userScope.canViewTeam) {
                filteredCallLogs = callLogs.filter(call => 
                    call.userId.toString() === user._id.toString() ||
                    userScope.teamIds.includes(call.teamId?.toString())
                );
            } else {
                filteredCallLogs = callLogs.filter(call => 
                    call.userId.toString() === user._id.toString()
                );
            }
        }
        
        // Pagination
        const skip = (page - 1) * limit;
        const paginatedCallLogs = filteredCallLogs.slice(skip, skip + parseInt(limit));
        
        res.json({
            success: true,
            data: {
                callLogs: paginatedCallLogs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: filteredCallLogs.length,
                    pages: Math.ceil(filteredCallLogs.length / limit)
                },
                summary: {
                    totalCallsWithoutTickets: filteredCallLogs.length,
                    dateRange: `${days} days`,
                    scope: userScope.canViewAll ? 'organization' : 
                           userScope.canViewTeam ? 'team' : 'personal'
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching call logs without tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch call logs without tickets',
            error: error.message
        });
    }
});

// ==========================================
// GET /api/call-logs/ticket-stats - Get ticket creation statistics
// ==========================================
router.get('/ticket-stats', auth, checkPermission('view_analytics'), async (req, res) => {
    try {
        const user = req.user;
        const { days = 30 } = req.query;
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        
        const dateRange = { start: startDate, end: new Date() };
        
        // Get ticket creation stats
        const stats = await CallLog.getTicketCreationStats(user.organizationId, dateRange);
        
        // Get additional breakdown
        const breakdown = await CallLog.aggregate([
            {
                $match: {
                    organizationId: user.organizationId,
                    timestamp: { $gte: startDate, $lte: new Date() },
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: {
                        callType: '$callType',
                        hasTicket: '$hasTicket'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: '$_id.callType',
                    total: { $sum: '$count' },
                    withTickets: {
                        $sum: {
                            $cond: [{ $eq: ['$_id.hasTicket', true] }, '$count', 0]
                        }
                    },
                    withoutTickets: {
                        $sum: {
                            $cond: [{ $eq: ['$_id.hasTicket', false] }, '$count', 0]
                        }
                    }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                summary: stats[0] || {
                    totalCalls: 0,
                    callsWithTickets: 0,
                    autoCreatedTickets: 0,
                    ticketConversionRate: 0
                },
                breakdown,
                period: `${days} days`,
                generatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error fetching ticket statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ticket statistics',
            error: error.message
        });
    }
});

console.log("✅ callLogs.js routes setup complete - All endpoints ready with ticket integration!");

module.exports = router;