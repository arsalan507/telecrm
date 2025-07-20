// routes/contacts.js - Enhanced Multi-Tenant Contact Management
const express = require('express');
const Contact = require('../models/Contact');
const Team = require('../models/Team');
const User = require('../models/User');
const router = express.Router();
const { 
    authenticate, 
    requirePermission, 
    requireAnyPermission,
    validateOrganizationContext,
    validateTeamContext,
    checkSubscriptionLimits,
    applyDataScope,
    auditLog
} = require('../middleware/multiTenantAuth');

// @route   GET /api/contacts
// @desc    Get contacts with organization/team filtering
// @access  Based on permissions (view_all_contacts, view_team_contacts, view_own_contacts)
router.get('/',
    authenticate,
    applyDataScope,
    requireAnyPermission(['view_all_contacts', 'view_team_contacts', 'view_own_contacts']),
    async (req, res) => {
        try {
            const { 
                status, 
                priority, 
                assignedTo, 
                teamId, 
                search, 
                source,
                page = 1, 
                limit = 20,
                sortBy = 'lastActivityAt',
                sortOrder = 'desc'
            } = req.query;

            // Build base query with data scope
            const query = req.buildScopedQuery();

            // Apply filters
            if (status) query.status = status;
            if (priority) query.priority = priority;
            if (assignedTo) query.assignedTo = assignedTo;
            if (teamId) query.teamId = teamId;
            if (source) query.source = source;

            // Apply search
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { company: { $regex: search, $options: 'i' } }
                ];
            }

            // Ensure active contacts only unless specifically requested
            if (req.query.includeInactive !== 'true') {
                query.isActive = true;
            }

            // Build sort object
            const sort = {};
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

            // Execute query with pagination
            const contacts = await Contact.find(query)
                .populate('assignedTo', 'firstName lastName email')
                .populate('teamId', 'name')
                .populate('createdBy', 'firstName lastName')
                .sort(sort)
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Contact.countDocuments(query);

            // Get contact statistics for dashboard
            const stats = await Contact.aggregate([
                { $match: req.buildScopedQuery() },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalValue: { $sum: '$dealValue' }
                    }
                }
            ]);

            res.json({
                success: true,
                data: {
                    contacts,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(total / limit),
                        totalContacts: total,
                        limit: parseInt(limit)
                    },
                    stats: stats.reduce((acc, stat) => {
                        acc[stat._id] = {
                            count: stat.count,
                            totalValue: stat.totalValue || 0
                        };
                        return acc;
                    }, {}),
                    filters: {
                        status,
                        priority,
                        assignedTo,
                        teamId,
                        search,
                        source
                    }
                }
            });
        } catch (error) {
            console.error('Get contacts error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving contacts'
            });
        }
    }
);

// @route   GET /api/contacts/:id
// @desc    Get single contact
// @access  Based on data scope
router.get('/:id',
    authenticate,
    applyDataScope,
    requireAnyPermission(['view_all_contacts', 'view_team_contacts', 'view_own_contacts']),
    async (req, res) => {
        try {
            const contact = await Contact.findOne({
                _id: req.params.id,
                ...req.buildScopedQuery()
            })
            .populate('assignedTo', 'firstName lastName email phone')
            .populate('teamId', 'name managerId')
            .populate('createdBy', 'firstName lastName email')
            .populate('notes.addedBy', 'firstName lastName');

            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact not found or access denied'
                });
            }

            res.json({
                success: true,
                data: contact
            });
        } catch (error) {
            console.error('Get contact error:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving contact'
            });
        }
    }
);

// @route   POST /api/contacts
// @desc    Create new contact
// @access  Based on permissions (manage_all_contacts, manage_team_contacts, manage_own_contacts)
router.post('/',
    authenticate,
    requireAnyPermission(['manage_all_contacts', 'manage_team_contacts', 'manage_own_contacts']),
    checkSubscriptionLimits('contacts'),
    auditLog('CREATE_CONTACT'),
    async (req, res) => {
        try {
            const {
                name,
                phone,
                email,
                company,
                status = 'new',
                priority = 'medium',
                source = 'manual',
                assignedTo,
                teamId,
                dealValue,
                currency = 'USD',
                description,
                tags = [],
                category,
                preferredContactMethod = 'phone',
                timezone = 'UTC'
            } = req.body;

            // Validate required fields
            if (!name || !phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Name and phone are required'
                });
            }

            // Check for duplicate phone in organization
            const existingContact = await Contact.findOne({
                organizationId: req.organizationId,
                phone: phone.replace(/\D/g, ''),
                isActive: true
            });

            if (existingContact) {
                return res.status(409).json({
                    success: false,
                    message: 'Contact with this phone number already exists'
                });
            }

            // Validate team assignment
            if (teamId) {
                const team = await Team.findById(teamId);
                if (!team || team.organizationId.toString() !== req.organizationId.toString()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid team specified'
                    });
                }
            }

            // Validate user assignment
            if (assignedTo) {
                const assignedUser = await User.findById(assignedTo);
                if (!assignedUser || assignedUser.organizationId.toString() !== req.organizationId.toString()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid assigned user specified'
                    });
                }
            }

            // Create contact
            const contactData = {
                organizationId: req.organizationId,
                teamId: teamId || req.user.teamId,
                name,
                phone: phone.replace(/\D/g, ''),
                email,
                company,
                status,
                priority,
                source,
                createdBy: req.user._id,
                assignedTo: assignedTo || req.user._id,
                dealValue,
                currency,
                description,
                tags,
                category,
                preferredContactMethod,
                timezone,
                isActive: true,
                lastActivityAt: new Date()
            };

            const contact = new Contact(contactData);
            await contact.save();

            // Populate for response
            await contact.populate([
                { path: 'assignedTo', select: 'firstName lastName email' },
                { path: 'teamId', select: 'name' },
                { path: 'createdBy', select: 'firstName lastName' }
            ]);

            res.status(201).json({
                success: true,
                message: 'Contact created successfully',
                data: contact
            });
        } catch (error) {
            console.error('Create contact error:', error);
            
            if (error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: 'Contact with this phone number already exists in your organization'
                });
            }

            if (error.name === 'ValidationError') {
                const validationErrors = Object.values(error.errors).map(err => err.message);
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error creating contact'
            });
        }
    }
);

// @route   PUT /api/contacts/:id
// @desc    Update contact
// @access  Based on data scope and permissions
router.put('/:id',
    authenticate,
    applyDataScope,
    requireAnyPermission(['manage_all_contacts', 'manage_team_contacts', 'manage_own_contacts']),
    auditLog('UPDATE_CONTACT'),
    async (req, res) => {
        try {
            const contact = await Contact.findOne({
                _id: req.params.id,
                ...req.buildScopedQuery()
            });

            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact not found or access denied'
                });
            }

            // Extract update fields
            const allowedUpdates = [
                'name', 'phone', 'email', 'company', 'status', 'priority', 
                'assignedTo', 'teamId', 'dealValue', 'currency', 'description',
                'tags', 'category', 'preferredContactMethod', 'timezone',
                'nextFollowUpDate'
            ];

            const updates = {};
            allowedUpdates.forEach(field => {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            });

            // Clean phone number if updated
            if (updates.phone) {
                updates.phone = updates.phone.replace(/\D/g, '');
            }

            // Validate team assignment if changed
            if (updates.teamId) {
                const team = await Team.findById(updates.teamId);
                if (!team || team.organizationId.toString() !== req.organizationId.toString()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid team specified'
                    });
                }
            }

            // Validate user assignment if changed
            if (updates.assignedTo) {
                const assignedUser = await User.findById(updates.assignedTo);
                if (!assignedUser || assignedUser.organizationId.toString() !== req.organizationId.toString()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid assigned user specified'
                    });
                }
            }

            // Handle status changes
            if (updates.status) {
                if (updates.status === 'converted' && !contact.convertedAt) {
                    updates.convertedAt = new Date();
                } else if (updates.status === 'lost' && !contact.lostAt) {
                    updates.lostAt = new Date();
                }
            }

            // Update contact
            Object.assign(contact, updates);
            contact.lastActivityAt = new Date();
            await contact.save();

            // Populate for response
            await contact.populate([
                { path: 'assignedTo', select: 'firstName lastName email' },
                { path: 'teamId', select: 'name' },
                { path: 'createdBy', select: 'firstName lastName' }
            ]);

            res.json({
                success: true,
                message: 'Contact updated successfully',
                data: contact
            });
        } catch (error) {
            console.error('Update contact error:', error);
            
            if (error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: 'Contact with this phone number already exists in your organization'
                });
            }

            if (error.name === 'ValidationError') {
                const validationErrors = Object.values(error.errors).map(err => err.message);
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error updating contact'
            });
        }
    }
);

// @route   DELETE /api/contacts/:id
// @desc    Delete (deactivate) contact
// @access  Based on data scope and permissions
router.delete('/:id',
    authenticate,
    applyDataScope,
    requireAnyPermission(['manage_all_contacts', 'manage_team_contacts', 'manage_own_contacts']),
    auditLog('DELETE_CONTACT'),
    async (req, res) => {
        try {
            const contact = await Contact.findOne({
                _id: req.params.id,
                ...req.buildScopedQuery()
            });

            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact not found or access denied'
                });
            }

            // Soft delete (deactivate)
            contact.isActive = false;
            contact.lastActivityAt = new Date();
            await contact.save();

            res.json({
                success: true,
                message: 'Contact deleted successfully'
            });
        } catch (error) {
            console.error('Delete contact error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting contact'
            });
        }
    }
);

// @route   POST /api/contacts/:id/notes
// @desc    Add note to contact
// @access  Based on data scope
router.post('/:id/notes',
    authenticate,
    applyDataScope,
    requireAnyPermission(['manage_all_contacts', 'manage_team_contacts', 'manage_own_contacts']),
    async (req, res) => {
        try {
            const { content, type = 'note' } = req.body;

            if (!content) {
                return res.status(400).json({
                    success: false,
                    message: 'Note content is required'
                });
            }

            const contact = await Contact.findOne({
                _id: req.params.id,
                ...req.buildScopedQuery()
            });

            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact not found or access denied'
                });
            }

            await contact.addNote(content, req.user._id, type);

            res.json({
                success: true,
                message: 'Note added successfully',
                data: {
                    noteId: contact.notes[contact.notes.length - 1]._id,
                    contact: contact._id
                }
            });
        } catch (error) {
            console.error('Add note error:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding note'
            });
        }
    }
);

// @route   POST /api/contacts/:id/interactions
// @desc    Record interaction with contact
// @access  Based on data scope
router.post('/:id/interactions',
    authenticate,
    applyDataScope,
    requireAnyPermission(['manage_all_contacts', 'manage_team_contacts', 'manage_own_contacts']),
    async (req, res) => {
        try {
            const { type, notes } = req.body;

            if (!type) {
                return res.status(400).json({
                    success: false,
                    message: 'Interaction type is required'
                });
            }

            const contact = await Contact.findOne({
                _id: req.params.id,
                ...req.buildScopedQuery()
            });

            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact not found or access denied'
                });
            }

            // Record interaction
            await contact.recordInteraction(type);

            // Add note if provided
            if (notes) {
                await contact.addNote(notes, req.user._id, `${type}_summary`);
            }

            res.json({
                success: true,
                message: 'Interaction recorded successfully',
                data: {
                    totalInteractions: contact.totalInteractions,
                    lastContactDate: contact.lastContactDate,
                    lastContactType: contact.lastContactType
                }
            });
        } catch (error) {
            console.error('Record interaction error:', error);
            res.status(500).json({
                success: false,
                message: 'Error recording interaction'
            });
        }
    }
);

// @route   GET /api/contacts/search
// @desc    Search contacts across organization
// @access  Based on permissions
router.get('/search',
    authenticate,
    applyDataScope,
    requireAnyPermission(['view_all_contacts', 'view_team_contacts', 'view_own_contacts']),
    async (req, res) => {
        try {
            const { q, limit = 10 } = req.query;

            if (!q) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query is required'
                });
            }

            const query = {
                ...req.buildScopedQuery(),
                isActive: true,
                $or: [
                    { name: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                    { phone: { $regex: q, $options: 'i' } },
                    { company: { $regex: q, $options: 'i' } }
                ]
            };

            const contacts = await Contact.find(query)
                .populate('assignedTo', 'firstName lastName')
                .select('name phone email company status priority assignedTo')
                .limit(parseInt(limit));

            res.json({
                success: true,
                data: contacts
            });
        } catch (error) {
            console.error('Search contacts error:', error);
            res.status(500).json({
                success: false,
                message: 'Error searching contacts'
            });
        }
    }
);

module.exports = router;