console.log("🚀 server.js starting...");

const app = require('./app');
console.log("📱 app.js loaded successfully");

const PORT = 5000;

console.log("🔧 About to start server...");

const server = app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`🔗 Visit: http://localhost:${PORT}/`);
    
    // Keep logging to see when it stops
   // let counter = 0;
    //const keepAlive = setInterval(() => {
   //     counter++;
   //     console.log(`⏰ Server alive check #${counter} - ${new Date().toLocaleTimeString()}`);
   // }, 2000); // Every 2 seconds
});

// Log when server closes
server.on('close', () => {
    console.log("❌ Server closed!");
});

server.on('error', (error) => {
    console.error("❌ Server error:", error);
});

process.on('exit', (code) => {
    console.log(`❌ Process exiting with code: ${code}`);
});

process.on('SIGINT', () => {
    console.log("❌ Received SIGINT");
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log("❌ Received SIGTERM");
    process.exit(0);
});

console.log("✅ server.js setup complete");module.exports = app;

module.exports = app;
