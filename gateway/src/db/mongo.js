const mongoose = require('mongoose');
const env = require('../config/env');
if (process.env.DNS_SERVERS) {
  const dns = require('dns');
  dns.setServers(process.env.DNS_SERVERS.split(',').map(s => s.trim()));
}

async function connectMongo() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
}

module.exports = connectMongo;
