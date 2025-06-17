// simple-test.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    console.log('Root route accessed');
    res.send('Root works');
});

app.get('/test', (req, res) => {
    console.log('Test route accessed');
    res.send('Test works');
});

const PORT = 5001; // Different port to avoid conflicts

app.listen(PORT, () => {
    console.log(`Simple server running on port ${PORT}`);
});