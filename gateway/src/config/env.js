const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const PORT = process.env.PORT || 3000;
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || 'mock';
const MOCK_LLM_URL = process.env.MOCK_LLM_URL;
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGO_URI = process.env.MONGO_URI;
const REDIS_URL = process.env.REDIS_URL;
const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS, 10) || 3600;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN || 'http://localhost:5173';
const RESERVE_DEFAULT_MAX_TOKENS = parseInt(process.env.RESERVE_DEFAULT_MAX_TOKENS, 10) || 1024;

const providersConfig = require('./providers.json');
const defaultProviderConfig = providersConfig.providers[DEFAULT_PROVIDER];

if (!defaultProviderConfig) {
  console.error(`Startup failed: missing provider config for ${DEFAULT_PROVIDER}`);
  process.exit(1);
}

const baseUrlEnvName = defaultProviderConfig.baseUrlEnv;
if (!process.env[baseUrlEnvName]) {
  console.error(`Startup failed: missing required variable ${baseUrlEnvName}`);
  process.exit(1);
}

const apiKeyEnvName = defaultProviderConfig.apiKeyEnv;
if (apiKeyEnvName !== null && !process.env[apiKeyEnvName]) {
  console.error(`Startup failed: missing required variable ${apiKeyEnvName}`);
  process.exit(1);
}

// Throw an error if MongoDB URI is missing
if (!MONGO_URI) {
  throw new Error("MONGO_URI is missing. Please set it in your environment variables or .env file.");
}

if (!REDIS_URL) {
  throw new Error("REDIS_URL is missing. Please set it in your environment variables or .env file.");
}

if (!ADMIN_TOKEN) {
  console.error('Startup failed: missing required variable ADMIN_TOKEN');
  process.exit(1);
}

module.exports = {
  PORT,
  DEFAULT_PROVIDER,
  MOCK_LLM_URL,
  GEMINI_BASE_URL,
  GEMINI_API_KEY,
  MONGO_URI,
  REDIS_URL,
  CACHE_TTL_SECONDS,
  ADMIN_TOKEN,
  DASHBOARD_ORIGIN,
  RESERVE_DEFAULT_MAX_TOKENS
};
