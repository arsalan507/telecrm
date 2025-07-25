const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Import your User model
const User = require('../models/User');

// Debug endpoints
router.get('/simple-test', (req, res) => {
    res.json({
        success: true,
        message: 'Simple auth test working - no database required',
        timestamp: new Date().toISOString()
    });
});

router.get('/debug', async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Auth debug endpoint working',
            environment: {
                nodeEnv: process.env.NODE_ENV,
                mongoConfigured: !!process.env.MONGODB_URI,
                jwtConfigured: !!process.env.JWT_SECRET,
                mongoUriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0
            },
            mongoose: {
                connectionState: require('mongoose').connection.readyState,
                states: {
                    0: 'disconnected',
                    1: 'connected', 
                    2: 'connecting',
                    3: 'disconnecting'
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Debug endpoint error: ' + error.message
        });
    }
});

// @route   POST /api/auth/register
// @desc    Register new user with auto-organization creation
// @access  Public
router.post('/register', async (req, res) => {
    try {
        // Connect to database for this specific route
        const connectDB = require('../config/database');
        await connectDB();

        console.log('📝 Registration request received:', req.body);
        
        const { firstName, lastName, email, phone, organizationName, password } = req.body;

        // Basic validation
        if (!firstName || !lastName || !email || !phone || !organizationName || !password) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('❌ Invalid email format:', email);
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Password validation
        if (password.length < 6) {
            console.log('❌ Password too short');
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('❌ User already exists:', email);
            return res.status(409).json({
                success: false,
                message: 'This email is already registered'
            });
        }

        // Check if organization with similar name exists
        const Organization = require('../models/Organization');
        const existingOrganization = await Organization.findOne({ 
            name: { $regex: new RegExp(`^${organizationName}$`, 'i') }
        });

        let organization;
        if (existingOrganization) {
            // If organization exists, user might be joining an existing org
            console.log('⚠️ Organization already exists:', organizationName);
            return res.status(409).json({
                success: false,
                message: 'Organization with this name already exists. Please use the invitation system to join an existing organization.',
                organizationExists: true
            });
        } else {
            // Create new organization
            console.log('🏢 Creating new organization:', organizationName);
            organization = new Organization({
                name: organizationName,
                owner: null, // Will be set after user creation
                description: `${organizationName} - CallTracker Pro Organization`,
                subscriptionPlan: 'free',
                subscriptionStatus: 'active',
                isActive: true,
                userLimit: 5,
                callLimit: 50,
                contactLimit: 100,
                teamLimit: 1,
                features: {
                    advancedAnalytics: false,
                    customBranding: false,
                    apiAccess: false,
                    prioritySupport: false,
                    dataExport: true,
                    teamManagement: true,
                    callRecording: false,
                    integrations: false
                },
                settings: {
                    timezone: 'UTC',
                    dateFormat: 'YYYY-MM-DD',
                    timeFormat: '24h',
                    currency: 'USD',
                    language: 'en',
                    workingHours: {
                        start: '09:00',
                        end: '17:00',
                        timezone: 'UTC'
                    },
                    callSettings: {
                        autoRecord: false,
                        defaultDuration: 300,
                        enableVoicemail: true
                    },
                    notifications: {
                        email: true,
                        browser: true,
                        mobile: true
                    }
                },
                branding: {
                    primaryColor: '#007bff',
                    secondaryColor: '#6c757d',
                    logo: null,
                    customDomain: null
                },
                billing: {
                    email: email.toLowerCase(),
                    address: null,
                    paymentMethod: null,
                    subscriptionStartDate: new Date(),
                    nextBillingDate: null
                },
                metadata: {
                    signupSource: 'android',
                    ipAddress: req.ip || 'unknown',
                    userAgent: req.get('User-Agent') || 'unknown'
                }
            });

            await organization.save();
            console.log('✅ Organization created successfully:', organization.name);
        }

        // Create user with organization reference
        const userData = {
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone: phone.replace(/\D/g, ''), // Clean phone number
            organizationId: organization._id,
            organizationName: organization.name,
            password, // Will be hashed by pre-save hook
            role: 'org_admin', // First user becomes org admin
            isActive: true,
            signupSource: 'android',
            subscriptionPlan: organization.subscriptionPlan,
            callLimit: organization.callLimit,
            callsUsed: 0
        };

        const user = new User(userData);
        await user.save();

        // Update organization owner
        organization.owner = user._id;
        organization.ownerEmail = user.email;
        await organization.save();

        console.log('✅ User created successfully:', user.email);
        console.log('✅ Organization ownership assigned');

        // Generate token
        const token = user.generateAuthToken();

        // Response
        res.status(201).json({
            success: true,
            message: `Welcome to CallTracker Pro! Your organization "${organization.name}" has been created successfully.`,
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                organizationId: user.organizationId,
                organizationName: user.organizationName,
                role: user.role,
                permissions: user.permissions,
                subscriptionPlan: user.subscriptionPlan,
                callLimit: user.callLimit,
                callsUsed: user.callsUsed,
                isActive: user.isActive,
                createdAt: user.createdAt
            },
            organization: {
                id: organization._id,
                name: organization.name,
                subscriptionPlan: organization.subscriptionPlan,
                subscriptionStatus: organization.subscriptionStatus,
                limits: {
                    users: organization.userLimit,
                    calls: organization.callLimit,
                    contacts: organization.contactLimit,
                    teams: organization.teamLimit
                },
                features: organization.features
            },
            expiresIn: 604800 // 7 days
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'This email is already registered'
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
            message: 'Server error. Please try again later.'
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        console.log('🔐 Login request received:', { email: req.body.email });
        console.log('🔐 JWT_SECRET exists:', !!process.env.JWT_SECRET);
        console.log('🔐 MONGODB_URI exists:', !!process.env.MONGODB_URI);
        
        // Connect to database for this specific route
        const connectDB = require('../config/database');
        console.log('🔐 Attempting database connection...');
        await connectDB();
        console.log('🔐 Database connection successful');
        
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            console.log('❌ Missing email or password');
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        console.log('🔐 Looking for user:', email.toLowerCase());
        // Find user
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        console.log('🔐 User found:', !!user);
        console.log('🔐 User role:', user?.role);
        console.log('🔐 User has password field:', !!user?.password);
        
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        console.log('🔐 Comparing password...');
        // Check password
        const isPasswordValid = await user.comparePassword(password);
        console.log('🔐 Password valid:', isPasswordValid);
        
        if (!isPasswordValid) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        console.log('🔐 Updating last login...');
        // Update last login
        await user.updateLastLogin();
        console.log('🔐 Last login updated');

        console.log('🔐 Generating auth token...');
        // Generate token
        const token = user.generateAuthToken();
        console.log('🔐 Token generated successfully');

        // Response
        res.json({
            success: true,
            message: `Welcome back, ${user.firstName}!`,
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                organizationName: user.organizationName,
                role: user.role,
                permissions: user.permissions,
                subscriptionPlan: user.subscriptionPlan,
                callLimit: user.callLimit,
                callsUsed: user.callsUsed,
                lastLogin: user.lastLogin,
                isActive: user.isActive
            },
            expiresIn: 604800
        });

        console.log('✅ Login successful for:', user.email);

    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        // Check for specific error types
        if (error.message?.includes('JWT_SECRET')) {
            console.error('❌ JWT_SECRET environment variable issue');
        }
        
        if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
            console.error('❌ Database connection error');
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
            debug: process.env.NODE_ENV === 'development' ? {
                error: error.message,
                errorName: error.name,
                jwtSecretExists: !!process.env.JWT_SECRET,
                mongoUriExists: !!process.env.MONGODB_URI
            } : undefined
        });
    }
});

// @route   POST /api/auth/check-email
// @desc    Check if email exists
// @access  Public
router.post('/check-email', async (req, res) => {
    try {
        // Connect to database for this specific route
        const connectDB = require('../config/database');
        await connectDB();

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        res.json({
            success: true,
            exists: !!user,
            message: user ? 'Email is already registered' : 'Email is available'
        });

    } catch (error) {
        console.error('❌ Check email error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/auth/test
// @desc    Test auth routes
// @access  Public
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'CallTracker Pro Auth API is working!',
        version: '1.0.0',
        endpoints: {
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            checkEmail: 'POST /api/auth/check-email',
            debug: 'GET /api/auth/debug'
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;