// Test JWT token generation
require('dotenv').config();
const jwt = require('jsonwebtoken');

const testPayload = {
  userId: '688115143af310e2396d7d41',
  email: 'adminpro@ctp.com',
  role: 'super_admin',
  organizationId: null,
  organizationName: null
};

console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('🔑 JWT_SECRET length:', process.env.JWT_SECRET?.length);

if (process.env.JWT_SECRET) {
  try {
    const token = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ Test token generated successfully');
    console.log('🎫 Test token:', token.substring(0, 50) + '...');
    
    // Verify it can be decoded
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verification successful');
    console.log('📋 Decoded payload:', decoded);
  } catch (error) {
    console.error('❌ JWT test failed:', error.message);
  }
} else {
  console.error('❌ JWT_SECRET not found in environment');
}