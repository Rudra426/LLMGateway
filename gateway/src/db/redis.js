const Redis = require('ioredis');
const env = require('../config/env');

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  commandTimeout: 1000 // 1 second timeout to fail fast
});

redis.on('error', (err) => {
  // Log warning but don't crash process
  let details = `code: ${err.code || 'undefined'}, name: ${err.name || 'Error'}, message: ${err.message || 'empty'}`;
  if (err.name === 'AggregateError' || Array.isArray(err.errors)) {
    const inners = (err.errors || []).map(e => `[code: ${e.code || 'undefined'}, address: ${e.address || e.target?.address || 'undefined'}]`).join(', ');
    details += `, innerErrors: [${inners}]`;
  }
  console.warn(`[Redis] Connection Error: ${details}`);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

module.exports = redis;
