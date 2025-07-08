const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Import your existing User model
const User = require('../models/User');

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        console.log('📝 Registration request received:', req.body);
        
        const { firstName, lastName, email, phone, organizationName, password } = req.body;

        // Validation
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

        // Password length validation
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

        // Create user using your existing model structure
        const userData = {
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            password, // Will be hashed by your User model's pre-save hook
            role: 'admin', // First user becomes admin
            isActive: true,
            permissions: ['manage_team', 'view_all_calls', 'manage_leads', 'export_data', 'manage_settings', 'view_analytics']
        };

        const user = new User(userData);
        await user.save();

        console.log('✅ User created successfully:', user.email);

        // Generate token using your User model's method
        const token = user.generateAuthToken();

        // Prepare response to match your Android app's expected format
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`,
                email: user.email,
                role: user.role,
                permissions: user.permissions
            },
            expiresIn: 604800 // 7 days in seconds
        });

        console.log('✅ Registration successful for:', user.email);

    } catch (error) {
        console.error('❌ Registration error:', error);
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'This email is already registered'
            });
        }

        // Handle validation errors
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
        
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            console.log('❌ Missing email or password');
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            console.log('❌ User is inactive:', email);
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact your administrator.'
            });
        }

        // Check password using your User model's method
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last login using your User model's method
        await user.updateLastLogin();

        // Generate token using your User model's method
        const token = user.generateAuthToken();

        // Prepare response to match your Android app's expected format
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
                lastLogin: user.lastLogin
            },
            expiresIn: 604800 // 7 days in seconds
        });

        console.log('✅ Login successful for:', user.email);

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private (add auth middleware later)
router.get('/profile', async (req, res) => {
    try {
        // For now, return a success message
        // You can add authentication middleware later
        res.json({
            success: true,
            message: 'Profile endpoint working'
        });
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Test endpoint
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Auth routes are working!',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;