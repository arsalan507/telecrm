const mongoose = require('mongoose');

async function testConnection() {
    try {
        console.log('🔍 Testing MongoDB connection...');
        
        // Test the exact connection string your app uses
        await mongoose.connect('mongodb://localhost:27017/telecrm', {
            serverSelectionTimeoutMS: 5000 // 5 second timeout
        });
        
        console.log('✅ MongoDB connection successful!');
        console.log('📊 Database name:', mongoose.connection.name);
        
        // Test creating a simple document
        const testSchema = new mongoose.Schema({ test: String });
        const TestModel = mongoose.model('Test', testSchema);
        
        const doc = new TestModel({ test: 'connection works' });
        await doc.save();
        console.log('✅ Test document saved successfully!');
        
        await TestModel.deleteMany({}); // Clean up
        mongoose.disconnect();
        console.log('🔌 Test completed successfully');
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.error('🔍 Full error:', error);
    }
}

testConnection();