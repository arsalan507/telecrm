console.log("🛑 callLogs.js is LOADING...");

const express = require('express');
const router = express.Router();

// Add logging middleware for this router
router.use((req, res, next) => {
    console.log("🎯 callLogs router hit!");
    console.log("   URL:", req.url);
    console.log("   Method:", req.method);
    next();
});

router.get('/test', (req, res) => {
    console.log("✅ /test route handler executed!");
    res.json({ success: true, message: 'Call logs working' });
});

console.log("✅ callLogs.js setup complete");
module.exports = router;