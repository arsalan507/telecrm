// api/index.js
const app = require('../app');

module.exports = (req, res) => {
  // Let Express handle the request
  app(req, res);
};