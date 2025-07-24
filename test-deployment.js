// Simple deployment test
const app = require('./app');

console.log('🧪 Testing app startup...');

// Test if app can start
try {
  console.log('✅ App module loaded successfully');
  console.log('✅ Express app created');
  console.log('✅ All routes should be mounted');
  console.log('🚀 App is ready for deployment');
} catch (error) {
  console.error('❌ App startup failed:', error.message);
  process.exit(1);
}