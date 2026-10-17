const express = require('express');
const router = express.Router();
const env = require('../config/env');
const { logRequest } = require('../services/logger');
const rateLimit = require('../middleware/rateLimit');
const { budget, addSpend, getKolkataDateString } = require('../middleware/budget');
const { cacheMiddleware, setCache } = require('../middleware/cache');
const { calculateCostPaise, estimateCostPaise } = require('../services/cost');
const providersConfig = require('../config/providers.json');
const { callProvider } = require('../providers/index');
const redis = require('../db/redis');

router.post('/v1/chat/completions', rateLimit, budget, cacheMiddleware, async (req, res, next) => {
  const startTime = Date.now();
  const model = req.body && req.body.model;

  try {
    let provider = env.DEFAULT_PROVIDER;
    const requestedProvider = req.headers['x-llmgate-provider'];
    
    if (requestedProvider) {
      if (!providersConfig.providers[requestedProvider]) {
        return res.status(400).json({ error: 'unknown provider' });
      }
      provider = requestedProvider;
    }

    // Validate request body
    if (!req.body || !Array.isArray(req.body.messages) || req.body.messages.length === 0) {
      const status = 400;
      res.status(status).json({ error: 'messages array is required' });
      logRequest({
        keyId: req.apiKey._id,
        model: model || 'unknown',
        promptTokens: null,
        completionTokens: null,
        costINR: null,
        latencyMs: Date.now() - startTime,
        status,
        provider,
        cacheHit: false
      });
      return;
    }

    // Validate model
    if (!model || typeof model !== 'string' || !providersConfig.providers[provider]?.models[model]) {
      const status = 400;
      res.status(status).json({ error: 'unknown or missing model' });
      logRequest({
        keyId: req.apiKey._id,
        model: model || 'unknown',
        promptTokens: null,
        completionTokens: null,
        costINR: null,
        latencyMs: Date.now() - startTime,
        status,
        provider,
        cacheHit: false
      });
      return;
    }

    let reservedPaise = 0;
    let reservationMade = false;
    let actualCostPaise = null;

    if (typeof req.apiKey.dailyBudgetINR === 'number') {
      const estimated = estimateCostPaise(provider, model, req.body);
      if (estimated !== null) {
        reservedPaise = estimated;
        try {
          const dateStr = getKolkataDateString();
          const key = `spend:${req.apiKey._id}:${dateStr}`;
          const currentTotal = await redis.incrby(key, reservedPaise);
          
          const ttl = await redis.ttl(key);
          if (ttl === -1) {
            await redis.expire(key, 2 * 24 * 60 * 60);
          }

          if (currentTotal > req.apiKey.dailyBudgetINR * 100) {
            await redis.incrby(key, -reservedPaise);
            const rollbackTtl = await redis.ttl(key);
            if (rollbackTtl === -1) {
              await redis.expire(key, 2 * 24 * 60 * 60);
            }
            const status = 429;
            res.status(status).json({ error: 'daily budget exceeded' });
            logRequest({
              keyId: req.apiKey._id,
              model,
              promptTokens: null,
              completionTokens: null,
              costINR: null,
              latencyMs: Date.now() - startTime,
              status,
              provider,
              cacheHit: false
            });
            return;
          }
          reservationMade = true;
        } catch (err) {
          console.warn('[Budget] Redis error during INCRBY reservation, fail open:', err.message);
        }
      }
    }

    try {
      let providerResponse;
      try {
        providerResponse = await callProvider(provider, req.body);
      } catch (err) {
        const status = 502;
        res.status(status).json({ error: 'upstream unavailable' });
        logRequest({
          keyId: req.apiKey._id,
          model,
          promptTokens: null,
          completionTokens: null,
          costINR: null,
          latencyMs: Date.now() - startTime,
          status,
          provider,
          cacheHit: false,
          upstreamError: true
        });
        return;
      }

      const { status, body: data, responseHeaders } = providerResponse;
      
      if (status === 429) {
        res.setHeader('X-LLMGate-Source', 'upstream');
        const retryAfter = responseHeaders && responseHeaders.get('retry-after');
        if (retryAfter) {
          res.setHeader('Retry-After', retryAfter);
        }
        res.status(status).json({ error: 'upstream rate limited', source: 'upstream' });
        logRequest({
          keyId: req.apiKey._id,
          model,
          promptTokens: null,
          completionTokens: null,
          costINR: null,
          latencyMs: Date.now() - startTime,
          status,
          provider,
          cacheHit: false,
          upstreamError: true
        });
        return;
      } else if (status >= 500) {
        const finalStatus = 502;
        res.status(finalStatus).json({ error: 'upstream unavailable' });
        logRequest({
          keyId: req.apiKey._id,
          model,
          promptTokens: null,
          completionTokens: null,
          costINR: null,
          latencyMs: Date.now() - startTime,
          status: finalStatus,
          provider,
          cacheHit: false,
          upstreamError: true
        });
        return;
      }

      let promptTokens = null;
      let completionTokens = null;
      let costINR = null;

      if (data && data.usage) {
        promptTokens = data.usage.prompt_tokens;
        completionTokens = data.usage.completion_tokens;
        
        actualCostPaise = calculateCostPaise(provider, model, data.usage);
        if (actualCostPaise !== null) {
          costINR = actualCostPaise / 100;
        }
      }

      if (costINR !== null) {
        res.setHeader('X-LLMGate-Cost-INR', String(costINR));
      }

      res.status(status).json(data);

      logRequest({
        keyId: req.apiKey._id,
        model,
        promptTokens,
        completionTokens,
        costINR,
        latencyMs: Date.now() - startTime,
        status,
        provider,
        cacheHit: false
      });

      if (status === 200 && req.cacheKey) {
        setCache(req.cacheKey, data);
      }
    } finally {
      if (reservationMade) {
        try {
          const dateStr = getKolkataDateString();
          const key = `spend:${req.apiKey._id}:${dateStr}`;
          
          if (actualCostPaise !== null) {
            const diff = actualCostPaise - reservedPaise;
            if (diff !== 0) {
              await redis.incrby(key, diff);
              const ttl = await redis.ttl(key);
              if (ttl === -1) {
                await redis.expire(key, 2 * 24 * 60 * 60);
              }
            }
          } else {
            await redis.incrby(key, -reservedPaise);
            const ttl = await redis.ttl(key);
            if (ttl === -1) {
              await redis.expire(key, 2 * 24 * 60 * 60);
            }
          }
        } catch (err) {
          console.warn('[Budget] Redis error during reservation release:', err.message);
        }
      }
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
