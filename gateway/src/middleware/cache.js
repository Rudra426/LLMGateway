const crypto = require('crypto');
const redis = require('../db/redis');
const { logRequest } = require('../services/logger');
const env = require('../config/env');

function sortKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortKeys(obj[key]);
  });
  return sorted;
}

function buildCacheKey(provider, body) {
  const allowedFields = [
    'model', 'messages', 'temperature', 'max_tokens', 
    'top_p', 'stop', 'presence_penalty', 'frequency_penalty', 
    'seed', 'response_format'
  ];
  
  const extracted = { provider };
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      extracted[field] = body[field];
    }
  }

  const canonicalObj = sortKeys(extracted);
  const canonicalStr = JSON.stringify(canonicalObj);
  const hash = crypto.createHash('sha256').update(canonicalStr).digest('hex');
  return `cache:${hash}`;
}

function isCacheable(body) {
  if (!body) return false;
  if (body.tools || body.functions || body.tool_choice || body.function_call) {
    return false;
  }
  if (body.stream === true) {
    return false;
  }
  if (typeof body.temperature !== 'number' || body.temperature > 0.5) {
    return false;
  }
  return true;
}

async function cacheMiddleware(req, res, next) {
  const startTime = Date.now();
  
  if (!isCacheable(req.body)) {
    req.cacheKey = null;
    res.setHeader('X-Cache', 'BYPASS');
    return next();
  }

  let provider = env.DEFAULT_PROVIDER;
  const requestedProvider = req.headers['x-llmgate-provider'];
  const providersConfig = require('../config/providers.json');
  
  if (requestedProvider) {
    if (providersConfig.providers[requestedProvider]) {
      provider = requestedProvider;
    }
  }

  const key = buildCacheKey(provider, req.body);

  try {
    const cachedData = await redis.get(key);
    
    if (cachedData) {
      let parsed;
      try {
        parsed = JSON.parse(cachedData);
      } catch (parseErr) {
        console.warn(`[Cache] Invalid JSON found for key ${key}, deleting it.`);
        await redis.del(key);
        req.cacheKey = key;
        res.setHeader('X-Cache', 'MISS');
        return next();
      }

      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-LLMGate-Cost-INR', '0');
      res.status(200).json(parsed);

      let promptTokens = null;
      let completionTokens = null;
      if (parsed && parsed.usage) {
        promptTokens = parsed.usage.prompt_tokens;
        completionTokens = parsed.usage.completion_tokens;
      }

      const model = req.body && req.body.model ? req.body.model : 'unknown';
      
      logRequest({
        keyId: req.apiKey._id,
        model,
        promptTokens,
        completionTokens,
        costINR: 0,
        latencyMs: Date.now() - startTime,
        status: 200,
        cacheHit: true,
        provider
      });

      return; // Do not call next() nor addSpend
    } else {
      req.cacheKey = key;
      res.setHeader('X-Cache', 'MISS');
      return next();
    }
  } catch (error) {
    console.warn('[Cache] Redis error, bypassing cache:', error.message);
    req.cacheKey = null;
    return next();
  }
}

async function setCache(key, body) {
  if (!key || !body) return;
  try {
    const serialized = JSON.stringify(body);
    const sizeInBytes = Buffer.byteLength(serialized, 'utf8');
    
    if (sizeInBytes > 256 * 1024) { // 256 KB
      return;
    }

    await redis.set(key, serialized, 'EX', env.CACHE_TTL_SECONDS);
  } catch (error) {
    console.warn('[Cache] Failed to set cache:', error.message);
  }
}

module.exports = {
  buildCacheKey,
  isCacheable,
  cacheMiddleware,
  setCache
};
