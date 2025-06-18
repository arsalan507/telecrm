const mongoose = require('mongoose');

const connectDB = async () => {
    const connectionStrings = [
        'mongodb://localhost:27017/telecrm',
        'mongodb://127.0.0.1:27017/telecrm',
        'mongodb://0.0.0.0:27017/telecrm'
    ];
    
    for (const uri of connectionStrings) {
        try {
            console.log(`🔍 Trying connection: ${uri}`);
            
            await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 3000,
                socketTimeoutMS: 45000,
                family: 4 // Force IPv4
            });
            
            console.log(`✅ MongoDB connected successfully: ${uri}`);
            console.log('📊 Database:', mongoose.connection.name);
            return;
            
        } catch (error) {
            console.log(`❌ Failed: ${uri} - ${error.message}`);
        }
    }
    
    console.error('❌ All connection attempts failed');
    // Don't exit, continue without database
    console.log('⚠️ Continuing without database...');
};

module.exports = connectDB;