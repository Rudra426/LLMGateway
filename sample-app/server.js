const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4100;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const SAMPLE_APP_API_KEY = process.env.SAMPLE_APP_API_KEY || 'default-sample-key';
const SAMPLE_APP_MODEL = process.env.SAMPLE_APP_MODEL || 'mock-model';

app.post('/ask', async (req, res) => {
  try {
    const { question, provider = 'mock' } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const isGemini = provider === 'gemini';
    const targetModel = isGemini ? 'gemini-3.5-flash-lite' : (process.env.SAMPLE_APP_MODEL || 'mock-model');
    const targetProvider = isGemini ? 'gemini' : 'mock';

    const startTime = Date.now();
    const gatewayRes = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SAMPLE_APP_API_KEY}`,
        'x-llmgate-provider': targetProvider
      },
      body: JSON.stringify({
        model: targetModel,
        temperature: 0,
        messages: [{ role: 'user', content: question }]
      })
    });

    const costHeader = gatewayRes.headers.get('X-LLMGate-Cost-INR');
    const cacheHeader = gatewayRes.headers.get('X-Cache');
    const latency = Date.now() - startTime;

    if (gatewayRes.status === 429) {
      const data = await gatewayRes.json().catch(() => ({}));
      if (data.error === 'daily budget exceeded') {
        return res.status(429).json({ error: 'Daily budget exceeded. Please try again later.' });
      } else {
        return res.status(429).json({ error: 'Rate limit exceeded or upstream provider timed out. Please try again.' });
      }
    }

    if (!gatewayRes.ok) {
      return res.status(gatewayRes.status).json({ error: `Upstream gateway error: Status ${gatewayRes.status}` });
    }

    const data = await gatewayRes.json();
    const answer = data.choices?.[0]?.message?.content || 'No response';

    let cost = '0.00';
    if (costHeader !== null && costHeader !== undefined) {
      cost = parseFloat(costHeader).toFixed(2);
    }

    res.json({
      answer,
      source: cacheHeader === 'HIT' ? 'Cache' : 'Upstream',
      cost,
      latency,
      provider: targetProvider,
      model: targetModel
    });
  } catch (error) {
    console.error('Error in /ask:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Sample app running on port ${PORT}`);
});
