console.log("🛑 callLogs.js is LOADING...");

const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');

console.log("✅ callLogs.js setup complete");

// ==========================================
// GET /api/call-logs/test - Test endpoint
// ==========================================
router.get('/test', (req, res) => {
    console.log("🎯 callLogs router hit!");
    console.log("   URL:", req.url);
    console.log("   Method:", req.method);
    
    console.log("✅ /test route handler executed!");
    res.json({ 
        success: true, 
        message: 'Call logs API working',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /api/call-logs/test',
            'POST /api/call-logs',
            'GET /api/call-logs',
            'GET /api/call-logs/:id',
            'PUT /api/call-logs/:id',
            'DELETE /api/call-logs/:id'
        ]
    });
});

// ==========================================
// POST /api/call-logs - Create new call log
// ==========================================
router.post('/', async (req, res) => {
    console.log("📞 POST /api/call-logs - Creating new call log");
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
            notes
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

        // Create call log
        const callLog = new CallLog({
            phoneNumber: phoneNumber.trim(),
            contactName: contactName || 'Unknown',
            duration: parseInt(duration),
            callType,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            simSlot: simSlot || 1,
            deviceInfo: deviceInfo || {},
            tags: tags || [],
            callQuality: {
                notes: notes || ''
            }
        });

        const savedCallLog = await callLog.save();
        
        console.log("✅ Call log saved successfully:", savedCallLog._id);
        
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
// GET /api/call-logs - Get all call logs
// ==========================================
router.get('/', async (req, res) => {
    console.log("📋 GET /api/call-logs - Fetching call logs");
    
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

        // Build filter object
        const filter = { isDeleted: false };
        
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

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [callLogs, totalCount] = await Promise.all([
            CallLog.find(filter)
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
// GET /api/call-logs/:id - Get single call log
// ==========================================
router.get('/:id', async (req, res) => {
    console.log(`🔍 GET /api/call-logs/${req.params.id} - Fetching single call log`);
    
    try {
        const callLog = await CallLog.findById(req.params.id);
        
        if (!callLog || callLog.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Call log not found'
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
// PUT /api/call-logs/:id - Update call log
// ==========================================
router.put('/:id', async (req, res) => {
    console.log(`✏️ PUT /api/call-logs/${req.params.id} - Updating call log`);
    
    try {
        const allowedUpdates = [
            'contactName', 'tags', 'callQuality', 'leadStatus', 
            'followUpDate', 'priority', 'transcription', 'sentiment'
        ];
        
        const updates = {};
        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        const callLog = await CallLog.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!callLog || callLog.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Call log not found'
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
// DELETE /api/call-logs/:id - Soft delete call log
// ==========================================
router.delete('/:id', async (req, res) => {
    console.log(`🗑️ DELETE /api/call-logs/${req.params.id} - Deleting call log`);
    
    try {
        const callLog = await CallLog.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true },
            { new: true }
        );

        if (!callLog) {
            return res.status(404).json({
                success: false,
                message: 'Call log not found'
            });
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
// GET /api/call-logs/analytics/stats - Call statistics
// ==========================================
router.get('/analytics/stats', async (req, res) => {
    console.log("📊 GET /api/call-logs/analytics/stats - Fetching analytics");
    
    try {
        const { days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const stats = await CallLog.getCallStats({
            start: startDate,
            end: new Date()
        });

        const sentimentTrends = await CallLog.getSentimentTrends();

        // Total counts
        const totalCalls = await CallLog.countDocuments({ 
            isDeleted: false,
            timestamp: { $gte: startDate }
        });

        const avgDuration = await CallLog.aggregate([
            {
                $match: {
                    isDeleted: false,
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    avgDuration: { $avg: '$duration' }
                }
            }
        ]);

        console.log("✅ Analytics calculated successfully");

        res.json({
            success: true,
            data: {
                totalCalls,
                averageDuration: avgDuration[0]?.avgDuration || 0,
                callTypeBreakdown: stats,
                sentimentTrends,
                period: `${days} days`,
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
// POST /api/call-logs/bulk - Bulk import
// ==========================================
router.post('/bulk', async (req, res) => {
    console.log("📦 POST /api/call-logs/bulk - Bulk importing call logs");
    
    try {
        const { callLogs } = req.body;

        if (!Array.isArray(callLogs) || callLogs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'callLogs array is required and cannot be empty'
            });
        }

        // Validate each call log
        const validatedLogs = callLogs.map((log, index) => {
            if (!log.phoneNumber || !log.callType || log.duration === undefined) {
                throw new Error(`Invalid call log at index ${index}: missing required fields`);
            }
            return {
                ...log,
                timestamp: log.timestamp ? new Date(log.timestamp) : new Date()
            };
        });

        const savedLogs = await CallLog.insertMany(validatedLogs);

        console.log(`✅ Bulk imported ${savedLogs.length} call logs`);

        res.status(201).json({
            success: true,
            message: `Successfully imported ${savedLogs.length} call logs`,
            data: {
                importedCount: savedLogs.length,
                firstId: savedLogs[0]._id,
                lastId: savedLogs[savedLogs.length - 1]._id
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

module.exports = router;