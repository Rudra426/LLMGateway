const mongoose = require('mongoose');

const RequestLogSchema = new mongoose.Schema({
  keyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  ts: { type: Date, default: Date.now },
  provider: { type: String },
  model: { type: String },
  promptTokens: { type: Number },
  completionTokens: { type: Number },
  costINR: { type: Number, default: null },
  latencyMs: { type: Number },
  cacheHit: { type: Boolean, default: false },
  status: { type: Number },
  upstreamError: { type: Boolean, default: false }
});

RequestLogSchema.index({ keyId: 1, ts: -1 });

module.exports = mongoose.model('RequestLog', RequestLogSchema);
