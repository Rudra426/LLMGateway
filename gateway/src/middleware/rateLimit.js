const redis = require('../db/redis');
const { logRequest } = require('../services/logger');

async function rateLimit(req, res, next) {
  const startTime = Date.now();
  const apiKey = req.apiKey;
  
  if (!apiKey || typeof apiKey.rpmLimit !== 'number') {
    return next(); // Fail open if no limit defined
  }

  const limit = apiKey.rpmLimit;
  const minute = Math.floor(startTime / 60000);
  const key = `rl:${apiKey._id}:${minute}`;

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 60);
    } else {
      // Handle edge case where TTL is missing
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        await redis.expire(key, 60);
      }
    }

    if (count <= limit) {
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', limit - count);
      return next();
    }

    // Rate limit exceeded
    const secondsUntilNextMinute = 60 - Math.floor((startTime / 1000) % 60);
    res.setHeader('Retry-After', secondsUntilNextMinute);
    const status = 429;
    res.status(status).json({ error: 'rate limit exceeded' });

    // Log the blocked request
    const model = req.body && req.body.model ? req.body.model : 'unknown';
    logRequest({
      keyId: apiKey._id,
      model,
      promptTokens: null,
      completionTokens: null,
      latencyMs: Date.now() - startTime,
      status,
      provider: 'mock'
    });

  } catch (error) {
    // FAIL OPEN: if Redis throws or times out, log a warning, skip the check
    console.warn('[RateLimit] Redis error, skipping limit check:', error.message);
    return next();
  }
}

module.exports = rateLimit;
