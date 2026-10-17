const express = require('express');

const app = express();
const PORT = process.env.MOCK_PORT || 4000;

app.use(express.json());

let controlState = { status: null, count: 0, retryAfter: null };

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/__control', (req, res) => {
  if (req.body.reset) {
    controlState = { status: null, count: 0, retryAfter: null };
  } else {
    controlState.status = req.body.status || 500;
    controlState.count = req.body.count || 1;
    controlState.retryAfter = req.body.retryAfter || null;
  }
  res.json({ success: true, controlState });
});

app.post('/v1/chat/completions', (req, res) => {
  if (controlState.count > 0 && controlState.status) {
    controlState.count--;
    const status = controlState.status;
    if (controlState.retryAfter) {
      res.setHeader('Retry-After', controlState.retryAfter.toString());
    }

    // Clear status if count hits 0
    if (controlState.count === 0) {
      controlState.status = null;
      controlState.retryAfter = null;
    }

    return res.status(status).json({ error: 'mock simulated failure' });
  }

  // Hardcoded 500ms delay to simulate upstream latency
  setTimeout(() => {
    res.json({
      id: "mock-1",
      model: "mock-model",
      choices: [{ index: 0, message: { role: "assistant", content: "mock answer" } }],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
    });
  }, 500);
});

app.listen(PORT, () => {
  console.log(`Mock LLM server listening on port ${PORT}`);
});
