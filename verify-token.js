// Test the actual frontend token with your JWT secret
const jwt = require('jsonwebtoken');

const JWT_SECRET = '4f8b9e2a5c7d1f6b3e8a9c2d5f7b4e9a1c6d8f2b5e7a3c9d1f4b8e6a2c5d7f9b1e3a6c8d';

// This is a sample token from your frontend (first 50 chars you showed)
// Replace with the actual full token from your frontend console
const frontendToken = 'eyJhbGciOi...'; // You'll need to paste the full token here

console.log('🔍 Testing frontend token with your JWT secret...');
console.log('🔑 JWT_SECRET:', JWT_SECRET.substring(0, 20) + '...');

try {
  // Try to decode the token
  const decoded = jwt.verify(frontendToken, JWT_SECRET);
  console.log('✅ Token decoded successfully!');
  console.log('📋 Decoded payload:', decoded);
  console.log('👤 User ID field:', decoded.userId || decoded.id);
  console.log('🎭 User role:', decoded.role);
} catch (error) {
  console.error('❌ Token verification failed:', error.message);
  console.log('🤔 This suggests the frontend token was created with a different JWT secret');
}

// Also test creating a new token
console.log('\n🔨 Creating a new test token...');
const testPayload = {
  userId: '688115143af310e2396d7d41',
  email: 'adminpro@ctp.com', 
  role: 'super_admin'
};

const newToken = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '7d' });
console.log('✅ New token created:', newToken.substring(0, 50) + '...');
console.log('📝 Use this token for testing if the frontend token fails');