const { hashKey } = require('../utils/hash');
const ApiKey = require('../models/ApiKey');

async function auth(req, res, next) {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'invalid or missing API key' });
    }

    const rawKey = authHeader.split(' ')[1];
    if (!rawKey) {
      return res.status(401).json({ error: 'invalid or missing API key' });
    }

    const keyHash = hashKey(rawKey);
    const apiKey = await ApiKey.findOne({ keyHash });

    if (!apiKey || apiKey.revoked) {
      return res.status(401).json({ error: 'invalid or missing API key' });
    }

    req.apiKey = apiKey;
    next();
  } catch (error) {
    // Log real error internally, return generic 500
    console.error('[Auth Error]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = auth;
