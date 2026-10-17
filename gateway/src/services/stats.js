const RequestLog = require('../models/RequestLog');
const mongoose = require('mongoose');

async function getStats(rangeDays) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);

  const pipeline = [
    { $match: { ts: { $gte: cutoff } } },
    {
      $group: {
        _id: null,
        requests: { $sum: 1 },
        cacheHits: { $sum: { $cond: [{ $eq: ["$cacheHit", true] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $and: [{ $eq: ["$status", 429] }, { $ne: ["$upstreamError", true] }] }, 1, 0] } },
        upstreamErrors: { $sum: { $cond: [{ $eq: ["$upstreamError", true] }, 1, 0] } },
        costINR: { $sum: "$costINR" }
      }
    }
  ];

  const nonHitsAvgPipeline = [
    { $match: { ts: { $gte: cutoff }, cacheHit: false, costINR: { $ne: null } } },
    {
      $group: {
        _id: { provider: "$provider", model: "$model" },
        avgCost: { $avg: "$costINR" }
      }
    }
  ];

  const hitsPipeline = [
    { $match: { ts: { $gte: cutoff }, cacheHit: true, provider: { $ne: null }, model: { $ne: null } } },
    {
      $group: {
        _id: { provider: "$provider", model: "$model" },
        count: { $sum: 1 }
      }
    }
  ];

  const dailyPipeline = [
    { $match: { ts: { $gte: cutoff } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$ts",
            timezone: "Asia/Kolkata"
          }
        },
        requests: { $sum: 1 },
        costINR: { $sum: { $ifNull: ["$costINR", 0] } },
        cacheHits: { $sum: { $cond: [{ $eq: ["$cacheHit", true] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",
        requests: 1,
        costINR: 1,
        cacheHits: 1
      }
    }
  ];

  const [totalsResult, nonHitsAvgResult, hitsResult, daily, latencyLogs] = await Promise.all([
    RequestLog.aggregate(pipeline),
    RequestLog.aggregate(nonHitsAvgPipeline),
    RequestLog.aggregate(hitsPipeline),
    RequestLog.aggregate(dailyPipeline),
    RequestLog.find({
      ts: { $gte: cutoff },
      $or: [
        { status: { $ne: 429 } },
        { upstreamError: true }
      ]
    })
    .sort({ ts: -1 })
    .limit(10000)
    .select('latencyMs -_id')
    .lean()
  ]);

  const t = totalsResult[0] || { requests: 0, cacheHits: 0, blocked: 0, upstreamErrors: 0, costINR: 0 };
  t.costINR = t.costINR || 0;
  
  let estimatedSavedINR = 0;
  const avgCosts = {};
  for (const item of nonHitsAvgResult) {
    if (item._id && item._id.provider && item._id.model) {
      avgCosts[`${item._id.provider}:${item._id.model}`] = item.avgCost;
    }
  }
  for (const item of hitsResult) {
    if (item._id && item._id.provider && item._id.model) {
      const avg = avgCosts[`${item._id.provider}:${item._id.model}`] || 0;
      estimatedSavedINR += avg * item.count;
    }
  }

  const hitRate = t.requests > 0 ? t.cacheHits / t.requests : 0;

  let p50 = 0;
  let p95 = 0;
  if (latencyLogs.length > 0) {
    const latencies = latencyLogs.map(l => l.latencyMs).filter(l => typeof l === 'number');
    latencies.sort((a, b) => a - b);
    if (latencies.length > 0) {
      p50 = latencies[Math.floor(latencies.length * 0.5)];
      p95 = latencies[Math.floor(latencies.length * 0.95)];
    }
  }

  return {
    totals: {
      requests: t.requests,
      cacheHits: t.cacheHits,
      hitRate,
      blocked: t.blocked,
      upstreamErrors: t.upstreamErrors,
      costINR: t.costINR,
      estimatedSavedINR
    },
    daily,
    latency: { p50, p95 }
  };
}

module.exports = { getStats };
