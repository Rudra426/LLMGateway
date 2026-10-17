const express = require('express');
const router = express.Router();
const cors = require('cors');
const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');
const RequestLog = require('../models/RequestLog');
const redisClient = require('../db/redis');
const adminAuth = require('../middleware/adminAuth');
const env = require('../config/env');
const { getStats } = require('../services/stats');
const { getKolkataDateString } = require('../middleware/budget');

router.use(cors({ origin: env.DASHBOARD_ORIGIN }));
router.use(adminAuth);

router.get('/keys', async (req, res, next) => {
  try {
    const keys = await ApiKey.find({}).lean();
    const today = getKolkataDateString();
    
    const spendPromises = keys.map(k => {
      if (!redisClient || redisClient.status !== 'ready') return Promise.resolve(0);
      return redisClient.get(`spend:${k._id.toString()}:${today}`)
        .then(val => val ? parseInt(val, 10) / 100 : 0)
        .catch(() => 0);
    });
    
    const spends = await Promise.all(spendPromises);
    
    const response = keys.map((k, i) => ({
      _id: k._id,
      label: k.label,
      userId: k.userId,
      rpmLimit: k.rpmLimit,
      dailyBudgetINR: k.dailyBudgetINR,
      revoked: k.revoked,
      createdAt: k.createdAt,
      todaySpendINR: spends[i]
    }));
    
    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/keys', async (req, res, next) => {
  try {
    const { label, userId, rpmLimit, dailyBudgetINR } = req.body;
    
    if (!label || typeof label !== 'string' || label.trim() === '') return res.status(400).json({error: 'invalid label'});
    if (!userId || typeof userId !== 'string' || userId.trim() === '') return res.status(400).json({error: 'invalid userId'});
    if (rpmLimit !== undefined && (typeof rpmLimit !== 'number' || rpmLimit <= 0 || rpmLimit > 10000)) return res.status(400).json({error: 'invalid rpmLimit'});
    if (dailyBudgetINR !== undefined && (typeof dailyBudgetINR !== 'number' || dailyBudgetINR <= 0 || dailyBudgetINR > 1000000)) return res.status(400).json({error: 'invalid dailyBudgetINR'});
    
    const rawKey = 'gw_' + crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    
    const doc = { keyHash, label, userId };
    if (rpmLimit) doc.rpmLimit = rpmLimit;
    if (dailyBudgetINR) doc.dailyBudgetINR = dailyBudgetINR;
    
    const keyDoc = await ApiKey.create(doc);
    
    res.json({ key: rawKey, _id: keyDoc._id });
  } catch (err) {
    next(err);
  }
});

router.delete('/keys/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) return res.status(400).json({error: 'invalid id'});
    
    const doc = await ApiKey.findByIdAndUpdate(id, { revoked: true }, { new: true });
    if (!doc) return res.status(404).json({error: 'not found'});
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit <= 0) limit = 50;
    if (limit > 200) return res.status(400).json({error: 'limit above cap'});
    
    const keyId = req.query.keyId;
    const query = {};
    if (keyId) {
      if (!keyId.match(/^[0-9a-fA-F]{24}$/)) return res.status(400).json({error: 'invalid keyId'});
      query.keyId = keyId;
    }
    
    const logs = await RequestLog.find(query).sort({ ts: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const allowedRanges = { '1d': 1, '7d': 7, '30d': 30 };
    const range = req.query.range || '7d';
    if (!allowedRanges[range]) return res.status(400).json({error: 'invalid range'});
    
    const days = allowedRanges[range];
    const stats = await getStats(days);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
