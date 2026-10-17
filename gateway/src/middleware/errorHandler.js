function errorHandler(err, req, res, next) {
  // Log real error to server console
  console.error('[Global Error]', err);
  
  // Return generic 500 error to client without stack trace
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
