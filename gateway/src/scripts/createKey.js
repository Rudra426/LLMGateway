const crypto = require('crypto');
const mongoose = require('mongoose');
const connectMongo = require('../db/mongo');
const ApiKey = require('../models/ApiKey');
const { hashKey } = require('../utils/hash');

async function main() {
  const label = process.argv[2];
  const userId = process.argv[3];

  if (!label || !userId) {
    console.error('Usage: node src/scripts/createKey.js <label> <userId>');
    process.exit(1);
  }

  await connectMongo();

  // Generate random key: "gw_" + 32 random hex bytes
  const rawKey = 'gw_' + crypto.randomBytes(32).toString('hex');
  const keyHash = hashKey(rawKey);

  const apiKeyDoc = new ApiKey({
    keyHash,
    label,
    userId
  });

  await apiKeyDoc.save();

  console.log('\n--- API KEY CREATED ---');
  console.log('Raw Key:', rawKey);
  console.log('WARNING: This key cannot be shown again. Save it securely.');
  console.log('-----------------------\n');

  await mongoose.disconnect();
  process.exit(0);
}

main();
