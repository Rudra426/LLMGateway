const env = require('../config/env');
const providersConfig = require('../config/providers.json');

async function callProvider(providerName, body) {
  const providerConfig = providersConfig.providers[providerName];
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  const baseUrlEnvName = providerConfig.baseUrlEnv;
  const baseUrl = env[baseUrlEnvName];
  if (!baseUrl) {
    throw new Error(`Missing environment variable: ${baseUrlEnvName} for provider ${providerName}`);
  }

  const apiKeyEnvName = providerConfig.apiKeyEnv;
  const apiKey = apiKeyEnvName ? env[apiKeyEnvName] : null;
  if (apiKeyEnvName && !apiKey) {
    throw new Error(`Missing environment variable: ${apiKeyEnvName} for provider ${providerName}`);
  }

  const isMock = providerName === 'mock';
  const endpoint = isMock ? `${baseUrl}/v1/chat/completions` : `${baseUrl}/chat/completions`;

  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const attemptFetch = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      let data;
      try {
        data = await response.json();
      } catch (err) {
        data = {}; // Ignore JSON parse errors for non-JSON responses
      }
      return { status: response.status, body: data, responseHeaders: response.headers };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err; // Network error or timeout
    }
  };

  try {
    const res = await attemptFetch();
    
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = res.responseHeaders.get('retry-after');
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds) && seconds > 2) {
          // Do not wait longer than 2 seconds; give up instead
          return res;
        }
      }
      
      // Retry once after ~500ms + jitter
      const jitter = Math.floor(Math.random() * 100);
      await new Promise(r => setTimeout(r, 500 + jitter));
      
      return await attemptFetch();
    }
    
    return res;
  } catch (error) {
    // Network error or timeout. Retry once.
    try {
      const jitter = Math.floor(Math.random() * 100);
      await new Promise(r => setTimeout(r, 500 + jitter));
      return await attemptFetch();
    } catch (retryError) {
      throw new Error('Provider unreachable');
    }
  }
}

module.exports = { callProvider };
