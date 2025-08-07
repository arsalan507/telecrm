// routes/supabaseAuth.js - Authentication routes using Supabase
const express = require('express');
const router = express.Router();
const SupabaseUser = require('../models/SupabaseUser');
const SupabaseOrganization = require('../models/SupabaseOrganization');
const { supabase, isConnected } = require('../config/supabase');

// Explicit CORS middleware for auth routes
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
                supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
                jwtConfigured: !!process.env.JWT_SECRET,
                supabaseUrlLength: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.length : 0
            },
            supabase: {
                connectionState: isConnected() ? 1 : 0,
                states: {
                    0: 'disconnected',
                    1: 'connected'
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
        const existingUser = await SupabaseUser.findByEmail(email);
        if (existingUser) {
            console.log('❌ User already exists:', email);
            return res.status(409).json({
                success: false,
                message: 'This email is already registered'
            });
        }

        // Check if organization with similar name exists
        const existingOrganization = await SupabaseOrganization.findByName(organizationName);

        let organization;
        if (existingOrganization) {
            console.log('⚠️ Organization already exists:', organizationName);
            return res.status(409).json({
                success: false,
                message: 'Organization with this name already exists. Please use the invitation system to join an existing organization.',
                organizationExists: true
            });
        } else {
            // Create new organization
            console.log('🏢 Creating new organization:', organizationName);
            organization = await SupabaseOrganization.create({
                name: organizationName,
                description: `${organizationName} - CallTracker Pro Organization`,
                subscriptionPlan: 'free',
                subscriptionStatus: 'active',
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

            console.log('✅ Organization created successfully:', organization.name);
        }

        // Create user with organization reference
        const user = await SupabaseUser.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone: phone.replace(/\D/g, ''), // Clean phone number
            organizationId: organization.id,
            organizationName: organization.name,
            password, // Will be hashed by create method
            role: 'org_admin', // First user becomes org admin
            subscriptionPlan: organization.subscription_plan,
            callLimit: organization.call_limit,
            callsUsed: 0,
            signupSource: 'android'
        });

        // Update organization owner
        organization.owner_id = user.id;
        organization.owner_email = user.email;
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
            user: user.toJSON(),
            organization: organization.toJSON(),
            expiresIn: 604800 // 7 days
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        
        if (error.code === '23505') { // PostgreSQL unique violation
            return res.status(409).json({
                success: false,
                message: 'This email is already registered'
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
        const user = await SupabaseUser.findByEmail(email);
        console.log('🔐 User found:', !!user);
        console.log('🔐 User role:', user?.role);
        
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
        
        // Update last login with IP and user agent tracking
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        await user.updateLastLogin(ipAddress, userAgent);
        console.log('🔐 Last login updated with tracking');

        console.log('🔐 Generating auth token...');
        
        // Generate token
        const token = user.generateAuthToken();
        console.log('🔐 Token generated successfully');

        // Response
        res.json({
            success: true,
            message: `Welcome back, ${user.first_name}!`,
            token,
            user: user.toJSON(),
            expiresIn: 604800
        });

        console.log('✅ Login successful for:', user.email);

    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
            debug: process.env.NODE_ENV === 'development' ? {
                error: error.message,
                errorName: error.name
            } : undefined
        });
    }
});

// @route   POST /api/auth/check-email
// @desc    Check if email exists
// @access  Public
router.post('/check-email', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await SupabaseUser.findByEmail(email);

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
        message: 'CallTracker Pro Auth API with Supabase is working!',
        version: '2.0.0',
        database: 'Supabase/PostgreSQL',
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