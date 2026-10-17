const providersConfig = require('../config/providers.json');

function calculateCostPaise(providerName, modelName, usage) {
  if (!usage || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') {
    console.warn('[Cost] Missing or invalid usage data');
    return null;
  }

  const provider = providersConfig.providers[providerName];
  if (!provider) {
    console.warn(`[Cost] Provider not found in config: ${providerName}`);
    return null;
  }

  const model = provider.models[modelName];
  if (!model) {
    console.warn(`[Cost] Model not found in config: ${modelName} for provider ${providerName}`);
    return null;
  }

  const inputCostINR = (usage.prompt_tokens / 1000000) * model.inputPerMillionINR;
  const outputCostINR = (usage.completion_tokens / 1000000) * model.outputPerMillionINR;
  const totalCostINR = inputCostINR + outputCostINR;
  
  return Math.ceil(totalCostINR * 100);
}

const env = require('../config/env');

function estimateCostPaise(providerName, modelName, body) {
  const provider = providersConfig.providers[providerName];
  if (!provider) {
    return null;
  }
  const model = provider.models[modelName];
  if (!model) {
    console.warn(`[Cost] Model not found in config: ${modelName} for provider ${providerName}. Skipping reservation.`);
    return null;
  }

  const messagesStr = JSON.stringify(body.messages || []);
  const inputTokens = Math.ceil(messagesStr.length / 4);
  
  let outputTokens = env.RESERVE_DEFAULT_MAX_TOKENS;
  if (body.max_tokens && typeof body.max_tokens === 'number' && body.max_tokens > 0) {
    outputTokens = body.max_tokens;
  }

  const inputCostINR = (inputTokens / 1000000) * model.inputPerMillionINR;
  const outputCostINR = (outputTokens / 1000000) * model.outputPerMillionINR;
  const totalCostINR = inputCostINR + outputCostINR;

  return Math.ceil(totalCostINR * 100);
}

module.exports = { calculateCostPaise, estimateCostPaise };
