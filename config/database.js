// config/database.js - Production & Local MongoDB connection
const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
  // If we have a cached connection, return it
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('📊 Using cached MongoDB connection');
    return cachedConnection;
  }

  try {
    // Check if we're in production (Vercel) or local development
    const isProduction = process.env.NODE_ENV === 'production';
    const mongoURI = process.env.MONGODB_URI;

    let connectionString;
    let options;

    if (isProduction && mongoURI) {
      // Production: Use MongoDB Atlas
      console.log('🌐 Production mode: Connecting to MongoDB Atlas...');
      connectionString = mongoURI;
      options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // Serverless optimizations
        maxPoolSize: 8,
        minPoolSize: 2,
        maxIdleTimeMS: 10000,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        bufferMaxEntries: 0,
        // Additional optimizations for multi-tenant SaaS
        retryWrites: true,
        w: 'majority',
        readPreference: 'primary',
        heartbeatFrequencyMS: 10000
      };
    } else {
      // Local development: Try localhost connections
      console.log('🏠 Development mode: Connecting to local MongoDB...');
      const localConnections = [
        'mongodb://localhost:27017/telecrm',
        'mongodb://127.0.0.1:27017/telecrm',
        'mongodb://0.0.0.0:27017/telecrm'
      ];

      // Try each local connection
      for (const uri of localConnections) {
        try {
          console.log(`🔍 Trying connection: ${uri}`);
          
          const connection = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 3000,
            socketTimeoutMS: 45000,
            family: 4
          });
          
          console.log(`✅ MongoDB connected successfully: ${uri}`);
          console.log('📊 Database:', mongoose.connection.name);
          cachedConnection = connection;
          return connection;
          
        } catch (error) {
          console.log(`❌ Failed: ${uri} - ${error.message}`);
        }
      }
      
      console.error('❌ All local connection attempts failed');
      console.log('⚠️ Continuing without database...');
      return null;
    }

    // Connect with the determined configuration
    const connection = await mongoose.connect(connectionString, options);
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${connection.connection.name}`);
    
    // Cache the connection
    cachedConnection = connection;
    
    return connection;
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    if (process.env.NODE_ENV === 'production') {
      // In production, throw the error
      throw error;
    } else {
      // In development, continue without database
      console.log('⚠️ Continuing without database...');
      return null;
    }
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('📊 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📊 Mongoose disconnected from MongoDB');
  cachedConnection = null;
});

module.exports = connectDB;