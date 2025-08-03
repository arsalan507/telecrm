// config/supabase.js - Supabase Database Configuration
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Server-side key with full access

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with service role key for backend operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database connection status
let isConnected = false;

// Test connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist (expected initially)
      console.error('❌ Supabase connection failed:', error.message);
      isConnected = false;
      return false;
    }
    
    console.log('✅ Supabase connected successfully');
    isConnected = true;
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    isConnected = false;
    return false;
  }
};

// Initialize connection
testConnection();

module.exports = {
  supabase,
  isConnected: () => isConnected,
  testConnection
};