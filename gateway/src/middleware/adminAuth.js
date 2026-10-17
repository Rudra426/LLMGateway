const crypto = require('crypto');
const env = require('../config/env');

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  const tokenBuffer = Buffer.from(token, 'utf8');
  const expectedBuffer = Buffer.from(env.ADMIN_TOKEN, 'utf8');
  
  if (tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  next();
}

module.exports = adminAuth;
