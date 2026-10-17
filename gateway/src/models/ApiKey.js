const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema({
  keyHash: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  label: { type: String },
  rpmLimit: { type: Number, default: 60 },
  dailyBudgetINR: { type: Number, default: 50 },
  revoked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ApiKey', ApiKeySchema);