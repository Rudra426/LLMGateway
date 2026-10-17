const express = require('express');
const proxyRoutes = require('./routes/proxy');
const errorHandler = require('./middleware/errorHandler');
const env = require('./config/env');
const connectMongo = require('./db/mongo');
const logger = require('./services/logger');

const auth = require('./middleware/auth');

const app = express();

// Body parser with 1mb limit

app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});


// Register auth middleware specifically for proxy route
app.use('/v1/chat/completions', auth);
app.use(proxyRoutes);
app.use('/admin', require('./routes/admin'));

// Catch-all error handler
app.use(errorHandler);

// Connect to MongoDB before listening
connectMongo().then(() => {
  logger.startPeriodicFlush();

  const server = app.listen(env.PORT, () => {
    console.log(`Gateway server listening on port ${env.PORT}`);
  });

  const shutdown = async () => {
    console.log('Shutting down server...');
    logger.stopPeriodicFlush();
    await logger.flushNow();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});

