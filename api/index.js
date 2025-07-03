module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Simple test response
  if (req.url.includes('/test')) {
    res.status(200).json({
      success: true,
      message: "CallTracker Pro API working!",
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
    return;
  }

  // Handle call logs endpoints
  if (req.url.includes('/call-logs') && req.method === 'GET') {
    res.status(200).json({
      success: true,
      data: [],
      message: "Call logs endpoint working"
    });
    return;
  }

  if (req.url.includes('/call-logs') && req.method === 'POST') {
    res.status(201).json({
      success: true,
      data: {
        id: "test-" + Date.now(),
        createdAt: new Date().toISOString()
      },
      message: "Call log created successfully"
    });
    return;
  }

  // Default response
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    availableRoutes: [
      "/api/call-logs/test",
      "/api/call-logs"
    ]
  });
};
