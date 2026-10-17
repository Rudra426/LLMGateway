  const redis = require('../db/redis');
  const { logRequest } = require('../services/logger');

  function getKolkataDateString() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date()).replace(/-/g, '');
  }

  async function budget(req, res, next) {
    const apiKey = req.apiKey;
    if (!apiKey || typeof apiKey.dailyBudgetINR !== 'number') {
      return next();
    }

    const budgetPaise = apiKey.dailyBudgetINR * 100;
    const dateStr = getKolkataDateString();
    const key = `spend:${apiKey._id}:${dateStr}`;

    try {
      const spendStr = await redis.get(key);
      const spend = spendStr ? parseInt(spendStr, 10) : 0;

      if (spend >= budgetPaise) {
        const status = 429;
        res.status(status).json({ error: 'daily budget exceeded' });
        
        const model = req.body && req.body.model ? req.body.model : 'unknown';
        logRequest({
          keyId: apiKey._id,
          model,
          promptTokens: null,
          completionTokens: null,
          latencyMs: 0,
          status,
          provider: 'mock'
        });
        return;
      }

      return next();
    } catch (error) {
      console.warn('[Budget] Redis error during GET, skipping budget check:', error.message);
      return next();
    }
  }

  async function addSpend(keyId, paise) {
    if (typeof paise !== 'number' || paise <= 0) return;

    const dateStr = getKolkataDateString();
    const key = `spend:${keyId}:${dateStr}`;

    try {
      await redis.incrby(key, paise);
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        await redis.expire(key, 2 * 24 * 60 * 60); // 2 days
      }
    } catch (error) {
      console.warn('[Budget] Failed to add spend:', error.message);
    }
  }

  module.exports = {
    budget,
    addSpend,
    getKolkataDateString
  };
